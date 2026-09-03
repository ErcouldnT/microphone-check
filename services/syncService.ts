import { getSetting, setSetting, removeSetting, getApiKey, setApiKey } from '@/db/settings';
import { db } from '@/db/client';
import { sessions, events, counters } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { NoteItem, getAllNotes, upsertNote, deleteNote, bulkSetNotes } from '@/db/notes';
import { CalendarEvent, getAllEvents, saveEvent, deleteEvent, bulkSetEvents } from '@/db/events';
import { RelationshipCounter, getAllCounters, saveCounter, deleteCounter, bulkSetCounters } from '@/db/counters';
import { notificationService, scheduleLocalNotification } from './notificationService';
import i18n from '@/i18n';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'local';

export interface SessionUpdatedPayload {
  date: string;
  count: number;
  author?: string;
  timestamp: number;
}

export interface NoteUpdatedPayload {
  noteId: string;
  date: string;
  content: string;
  author?: string;
  timestamp: number;
  /** 'delete' means the note was removed on the other device. */
  action: 'upsert' | 'delete';
}

export interface NotificationPayload {
  id: string;
  title: string;
  message: string;
  type: 'event' | 'note' | 'counter';
  /** Day the notice is about, so tapping it can open that day. */
  date?: string;
  timestamp: number;
}

type StatusListener = (status: ConnectionStatus) => void;
type SessionListener = (payload: SessionUpdatedPayload) => void;
type NoteListener = (payload: NoteUpdatedPayload) => void;
type EventListener = (event: CalendarEvent, action: 'upsert' | 'delete') => void;
type CounterListener = (counter: RelationshipCounter, action: 'upsert' | 'delete') => void;
type NotificationListener = (payload: NotificationPayload) => void;
type SyncListener = () => void;

class SyncService {
  private static instance: SyncService;

  private serverUrl: string = 'https://cal.erkut.dev';
  private roomCode: string | null = null;
  private status: ConnectionStatus = 'local';
  private ws: WebSocket | null = null;
  private reconnectTimer: any = null;
  private pingInterval: any = null;
  private deviceId: string = '';
  private apiKey: string = '';

  private statusListeners: Set<StatusListener> = new Set();
  private sessionListeners: Set<SessionListener> = new Set();
  private noteListeners: Set<NoteListener> = new Set();
  private eventListeners: Set<EventListener> = new Set();
  private counterListeners: Set<CounterListener> = new Set();
  private notificationListeners: Set<NotificationListener> = new Set();
  private syncListeners: Set<SyncListener> = new Set();

  private constructor() {
    this.deviceId = 'dev_' + Math.random().toString(36).substring(2, 10);
  }

  public static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  public async init() {
    this.apiKey = await getApiKey();

    const savedDeviceId = await getSetting('device_id');
    if (savedDeviceId) {
      this.deviceId = savedDeviceId;
    } else {
      this.deviceId = 'dev_' + Math.random().toString(36).substring(2, 12);
      await setSetting('device_id', this.deviceId);
    }

    const savedUrl = await getSetting('server_url');
    if (savedUrl) {
      this.serverUrl = savedUrl;
    }

    const savedRoom = await getSetting('room_code');
    if (savedRoom) {
      this.roomCode = savedRoom.toUpperCase().trim();
      this.connect();
    } else {
      this.setStatus('local');
    }
  }

  public getStatus(): ConnectionStatus {
    return this.status;
  }

  public getRoomCode(): string | null {
    return this.roomCode;
  }

  public getDeviceId(): string {
    return this.deviceId;
  }

  public getServerUrl(): string {
    return this.serverUrl;
  }

  public getApiKeyValue(): string {
    return this.apiKey;
  }

  public async updateApiKey(key: string) {
    this.apiKey = key.trim();
    await setApiKey(this.apiKey);
    if (this.roomCode) {
      this.disconnect();
      this.connect();
    }
  }

  public async setServerUrl(url: string) {
    let cleanUrl = url.trim().replace(/\/+$/, '');
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }
    this.serverUrl = cleanUrl;
    await setSetting('server_url', cleanUrl);

    if (this.roomCode) {
      this.disconnect();
      this.connect();
    }
  }

  public addStatusListener(listener: StatusListener) {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  public addSessionListener(listener: SessionListener) {
    this.sessionListeners.add(listener);
    return () => this.sessionListeners.delete(listener);
  }

  public addNoteListener(listener: NoteListener) {
    this.noteListeners.add(listener);
    return () => this.noteListeners.delete(listener);
  }

  public addEventListener(listener: EventListener) {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  public addCounterListener(listener: CounterListener) {
    this.counterListeners.add(listener);
    return () => this.counterListeners.delete(listener);
  }

  public addNotificationListener(listener: NotificationListener) {
    this.notificationListeners.add(listener);
    return () => this.notificationListeners.delete(listener);
  }

  public addSyncListener(listener: SyncListener) {
    this.syncListeners.add(listener);
    return () => this.syncListeners.delete(listener);
  }

  private setStatus(newStatus: ConnectionStatus) {
    this.status = newStatus;
    this.statusListeners.forEach(listener => listener(newStatus));
  }

  private getWsUrl(): string {
    let wsUrl = this.serverUrl;
    if (wsUrl.startsWith('https://')) {
      wsUrl = wsUrl.replace('https://', 'wss://');
    } else if (wsUrl.startsWith('http://')) {
      wsUrl = wsUrl.replace('http://', 'ws://');
    }
    return `${wsUrl}/ws?room=${encodeURIComponent(this.roomCode || '')}&deviceId=${encodeURIComponent(this.deviceId)}&apiKey=${encodeURIComponent(this.apiKey)}`;
  }

  public connect() {
    if (!this.roomCode) {
      this.setStatus('local');
      return;
    }

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus('connecting');

    try {
      const url = this.getWsUrl();
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.setStatus('connected');
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }

        // Start ping heartbeat
        this.startHeartbeat();

        this.sendWsMessage({
          type: 'JOIN_ROOM',
          roomCode: this.roomCode!,
          deviceId: this.deviceId
        });

        // Sync with REST endpoint
        this.syncWithServer();

        // Register Push Notification Token for closed-app notifications
        notificationService.sendTokenToServer(this.serverUrl, this.roomCode!, this.deviceId);
      };

      this.ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          await this.handleWsMessage(data);
        } catch (e) {
          console.error('Error parsing WS message:', e);
        }
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        if (this.roomCode) {
          this.setStatus('disconnected');
          this.scheduleReconnect();
        } else {
          this.setStatus('local');
        }
      };

      this.ws.onerror = (err) => {
        console.warn('WebSocket connection error:', err);
      };
    } catch (e) {
      console.error('Error initiating WebSocket connection:', e);
      this.setStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendWsMessage({ type: 'PING' });
      }
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.roomCode && this.status !== 'connected') {
        this.connect();
      }
    }, 3500);
  }

  public disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
  }

  private sendWsMessage(msg: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private notify(
    title: string,
    message: string,
    type: 'event' | 'note' | 'counter',
    date?: string
  ) {
    const payload: NotificationPayload = {
      id: Math.random().toString(36).substring(2, 9),
      title,
      message,
      type,
      date,
      timestamp: Date.now()
    };
    this.notificationListeners.forEach(listener => listener(payload));
    // `date` rides along so tapping the notification opens that day.
    scheduleLocalNotification(title, message, { type, date });
  }

  private async handleWsMessage(msg: any) {
    switch (msg.type) {
      case 'SESSION_UPDATED': {
        const { date, count, author, timestamp } = msg;
        await this.applySessionUpdateToLocalDb(date, count);
        this.sessionListeners.forEach(listener => listener({ date, count, author, timestamp }));
        this.syncListeners.forEach(listener => listener());
        break;
      }
      case 'NOTE_UPDATED': {
        const { date, content, author, timestamp } = msg;
        // Servers before v3.1 key notes by date only; mint a local id for those.
        const noteId: string = msg.noteId || `legacy_${date}`;

        await upsertNote({ noteId, date, content, updatedAt: timestamp });
        this.noteListeners.forEach(listener =>
          listener({ noteId, date, content, author, timestamp, action: 'upsert' })
        );
        this.syncListeners.forEach(listener => listener());

        if (author && author !== this.deviceId) {
          this.notify(String(i18n.t('notes')), content.substring(0, 80), 'note', date);
        }
        break;
      }

      case 'NOTE_DELETED': {
        const { noteId, date, author, timestamp } = msg;
        if (noteId) {
          await deleteNote(noteId);
          this.noteListeners.forEach(listener =>
            listener({ noteId, date, content: '', author, timestamp, action: 'delete' })
          );
          this.syncListeners.forEach(listener => listener());
        }
        break;
      }
      case 'EVENT_UPDATED': {
        const { event, author } = msg;
        if (event) {
          const previous = (await getAllEvents()).find(e => e.id === event.id);
          const completionChanged =
            Boolean(previous) && Boolean(previous!.completed) !== Boolean(event.completed);

          await saveEvent(event);
          this.eventListeners.forEach(listener => listener(event, 'upsert'));
          this.syncListeners.forEach(listener => listener());

          if (author && author !== this.deviceId) {
            if (completionChanged) {
              this.notify(
                event.completed ? i18n.t('completed') : i18n.t('notCompleted'),
                i18n.t(event.completed ? 'partnerCompletedEvent' : 'partnerUncompletedEvent', {
                  title: event.title,
                }),
                'event',
                event.startDate
              );
            } else {
              this.notify(
                String(i18n.t('scheduleUpdated')),
                `"${event.title}"`,
                'event',
                event.startDate
              );
            }
          }
        }
        break;
      }
      case 'EVENT_DELETED': {
        const { eventId, author } = msg;
        if (eventId) {
          await deleteEvent(eventId);
          this.eventListeners.forEach(listener => listener({ id: eventId } as any, 'delete'));
          this.syncListeners.forEach(listener => listener());
          if (author && author !== this.deviceId) {
            this.notify(i18n.t('scheduleUpdated'), i18n.t('eventRemoved'), 'event');
          }
        }
        break;
      }
      case 'COUNTER_UPDATED': {
        const { counter, author } = msg;
        if (counter) {
          await saveCounter(counter);
          this.counterListeners.forEach(listener => listener(counter, 'upsert'));
          this.syncListeners.forEach(listener => listener());
        }
        break;
      }
      case 'COUNTER_DELETED': {
        const { counterId } = msg;
        if (counterId) {
          await deleteCounter(counterId);
          this.counterListeners.forEach(listener => listener({ id: counterId } as any, 'delete'));
          this.syncListeners.forEach(listener => listener());
        }
        break;
      }
      case 'SYNC_DATA': {
        if (Array.isArray(msg.entries)) {
          await this.applyFullSyncToLocalDb(msg.entries);
        }
        if (Array.isArray(msg.notes)) {
          await bulkSetNotes(msg.notes);
        }
        if (Array.isArray(msg.events)) {
          await bulkSetEvents(msg.events);
        }
        if (Array.isArray(msg.counters)) {
          await bulkSetCounters(msg.counters);
        }
        this.syncListeners.forEach(listener => listener());
        break;
      }
      case 'ROOM_JOINED': {
        this.setStatus('connected');
        break;
      }
    }
  }

  private async applySessionUpdateToLocalDb(date: string, count: number) {
    try {
      const existing = await db.select().from(sessions).where(eq(sessions.date, date));
      if (count <= 0) {
        if (existing.length > 0) {
          await db.delete(sessions).where(eq(sessions.date, date));
        }
      } else {
        if (existing.length > 0) {
          await db.update(sessions).set({ count }).where(eq(sessions.id, existing[0].id));
          if (existing.length > 1) {
            for (let i = 1; i < existing.length; i++) {
              await db.delete(sessions).where(eq(sessions.id, existing[i].id));
            }
          }
        } else {
          await db.insert(sessions).values({ date, count });
        }
      }
    } catch (e) {
      console.error('Error applying remote session update to local SQLite:', e);
    }
  }

  private async applyFullSyncToLocalDb(entries: Array<{ date: string; count: number }>) {
    try {
      await db.delete(sessions);
      for (const item of entries) {
        if (item.date && item.count > 0) {
          await db.insert(sessions).values({
            date: item.date,
            count: item.count
          });
        }
      }
    } catch (e) {
      console.error('Error applying full sync to local SQLite:', e);
    }
  }

  // Send session counter update
  public async sendSessionUpdate(date: string, count: number) {
    if (!this.roomCode) return;
    this.sendWsMessage({
      type: 'UPDATE_SESSION',
      roomCode: this.roomCode,
      date,
      count,
      author: this.deviceId,
      senderToken: notificationService.getPushToken(),
    });
  }

  // Send note create/update. `noteId` lets a day carry several notes; servers
  // older than v3.1 ignore it and keep their single-note-per-day behaviour.
  public async sendNoteUpdate(note: NoteItem) {
    if (!this.roomCode) return;
    this.sendWsMessage({
      type: 'UPDATE_NOTE',
      roomCode: this.roomCode,
      noteId: note.noteId,
      date: note.date,
      content: note.content,
      author: this.deviceId,
      senderToken: notificationService.getPushToken(),
    });
  }

  // Send note delete
  public async sendNoteDelete(noteId: string, date: string) {
    if (!this.roomCode) return;
    this.sendWsMessage({
      type: 'DELETE_NOTE',
      roomCode: this.roomCode,
      noteId,
      date,
      author: this.deviceId,
      senderToken: notificationService.getPushToken(),
    });
  }

  // Send event create/update
  public async sendEventUpdate(event: CalendarEvent) {
    await saveEvent(event);
    this.syncListeners.forEach(listener => listener());

    if (!this.roomCode) return;
    this.sendWsMessage({
      type: 'UPDATE_EVENT',
      roomCode: this.roomCode,
      event,
      author: this.deviceId,
      senderToken: notificationService.getPushToken(),
    });
  }

  // Send event delete
  public async sendEventDelete(eventId: string) {
    await deleteEvent(eventId);
    this.syncListeners.forEach(listener => listener());

    if (!this.roomCode) return;
    this.sendWsMessage({
      type: 'DELETE_EVENT',
      roomCode: this.roomCode,
      eventId,
      author: this.deviceId,
      senderToken: notificationService.getPushToken(),
    });
  }

  // Send counter create/update
  public async sendCounterUpdate(counter: RelationshipCounter) {
    await saveCounter(counter);
    this.syncListeners.forEach(listener => listener());

    if (!this.roomCode) return;
    this.sendWsMessage({
      type: 'UPDATE_COUNTER',
      roomCode: this.roomCode,
      counter,
      author: this.deviceId,
      senderToken: notificationService.getPushToken(),
    });
  }

  // Send counter delete
  public async sendCounterDelete(counterId: string) {
    await deleteCounter(counterId);
    this.syncListeners.forEach(listener => listener());

    if (!this.roomCode) return;
    this.sendWsMessage({
      type: 'DELETE_COUNTER',
      roomCode: this.roomCode,
      counterId,
      author: this.deviceId,
      senderToken: notificationService.getPushToken(),
    });
  }

  // REST: Create Room
  public async createRoom(includeLocalData: boolean = true): Promise<{ success: boolean; roomCode?: string; error?: string }> {
    try {
      let initialEntries: Array<{ date: string; count: number }> = [];
      let initialNotes: Array<{ noteId: string; date: string; content: string }> = [];
      let initialEvents: CalendarEvent[] = [];
      let initialCounters: RelationshipCounter[] = [];

      if (includeLocalData) {
        const localSessions = await db.select().from(sessions);
        initialEntries = localSessions.map((s: { date: string; count: number }) => ({ date: s.date, count: s.count }));

        const localNotes = await getAllNotes();
        initialNotes = localNotes.map(n => ({ noteId: n.noteId, date: n.date, content: n.content }));

        initialEvents = await getAllEvents();
        initialCounters = await getAllCounters();
      }

      const res = await fetch(`${this.serverUrl}/api/rooms/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify({
          initialEntries,
          initialNotes,
          initialEvents,
          initialCounters
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Oda oluşturulamadı' };
      }

      this.roomCode = data.roomCode;
      await setSetting('room_code', data.roomCode);
      this.disconnect();
      this.connect();

      return { success: true, roomCode: data.roomCode };
    } catch (e: any) {
      return { success: false, error: e.message || 'Bağlantı hatası' };
    }
  }

  // REST: Join Room
  public async joinRoom(roomCode: string): Promise<{ success: boolean; error?: string }> {
    try {
      const formattedCode = roomCode.toUpperCase().trim();
      const res = await fetch(`${this.serverUrl}/api/rooms/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify({ roomCode: formattedCode })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Odaya katılınamadı' };
      }

      this.roomCode = formattedCode;
      await setSetting('room_code', formattedCode);

      if (Array.isArray(data.entries)) await this.applyFullSyncToLocalDb(data.entries);
      if (Array.isArray(data.notes)) await bulkSetNotes(data.notes);
      if (Array.isArray(data.events)) await bulkSetEvents(data.events);
      if (Array.isArray(data.counters)) await bulkSetCounters(data.counters);

      this.syncListeners.forEach(listener => listener());
      this.disconnect();
      this.connect();

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Bağlantı hatası' };
    }
  }

  // REST: Sync full room state
  public async syncWithServer(): Promise<void> {
    if (!this.roomCode) return;
    try {
      const res = await fetch(`${this.serverUrl}/api/rooms/${this.roomCode}/sync`, {
        headers: {
          'X-API-Key': this.apiKey,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (Array.isArray(data.entries)) await this.applyFullSyncToLocalDb(data.entries);
          if (Array.isArray(data.notes)) await bulkSetNotes(data.notes);
          if (Array.isArray(data.events)) await bulkSetEvents(data.events);
          if (Array.isArray(data.counters)) await bulkSetCounters(data.counters);
          this.syncListeners.forEach(listener => listener());
        }
      }
    } catch (e) {
      console.warn('Sync with server failed:', e);
    }
  }

  // REST: Push all local data
  public async pushAllLocalData(): Promise<{ success: boolean; error?: string }> {
    if (!this.roomCode) return { success: false, error: 'Oda seçili değil' };
    try {
      const localSessions = await db.select().from(sessions);
      const entries = localSessions.map((s: { date: string; count: number }) => ({ date: s.date, count: s.count }));

      const localNotes = await getAllNotes();
      const notesList = localNotes.map(n => ({ noteId: n.noteId, date: n.date, content: n.content }));

      const eventsList = await getAllEvents();
      const countersList = await getAllCounters();

      const res = await fetch(`${this.serverUrl}/api/rooms/${this.roomCode}/push-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify({
          entries,
          notes: notesList,
          events: eventsList,
          counters: countersList,
          author: this.deviceId
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        return { success: true };
      }
      return { success: false, error: data.error || 'Yükleme başarısız' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Bağlantı hatası' };
    }
  }

  // Leave room
  public async leaveRoom(): Promise<void> {
    this.disconnect();
    this.roomCode = null;
    await removeSetting('room_code');
    this.setStatus('local');
    this.syncListeners.forEach(listener => listener());
  }
}

export const syncService = SyncService.getInstance();
