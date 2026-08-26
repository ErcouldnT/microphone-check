import { getSetting, setSetting, removeSetting } from '@/db/settings';
import { db } from '@/db/client';
import { sessions } from '@/db/schema';
import { eq } from 'drizzle-orm';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'local';

export interface CalendarSyncEntry {
  date: string;
  count: number;
}

export interface SessionUpdatedPayload {
  date: string;
  count: number;
  author?: string;
  timestamp: number;
}

type StatusListener = (status: ConnectionStatus) => void;
type SessionListener = (payload: SessionUpdatedPayload) => void;
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

  private statusListeners: Set<StatusListener> = new Set();
  private sessionListeners: Set<SessionListener> = new Set();
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

  public getServerUrl(): string {
    return this.serverUrl;
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
    return `${wsUrl}/ws?room=${encodeURIComponent(this.roomCode || '')}&deviceId=${encodeURIComponent(this.deviceId)}`;
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

        // Send explicit JOIN_ROOM in case query params weren't processed
        this.sendWsMessage({
          type: 'JOIN_ROOM',
          roomCode: this.roomCode!,
          deviceId: this.deviceId
        });

        // Sync with REST endpoint to ensure everything is up to date
        this.syncWithServer();
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

  private async handleWsMessage(msg: any) {
    switch (msg.type) {
      case 'SESSION_UPDATED': {
        const { date, count, author, timestamp } = msg;
        await this.applySessionUpdateToLocalDb(date, count);
        this.sessionListeners.forEach(listener => listener({ date, count, author, timestamp }));
        this.syncListeners.forEach(listener => listener());
        break;
      }
      case 'SYNC_DATA': {
        if (Array.isArray(msg.entries)) {
          await this.applyFullSyncToLocalDb(msg.entries);
          this.syncListeners.forEach(listener => listener());
        }
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
          // Clean duplicate rows if any
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
      // Clear local sessions and replace with server room data
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

  // Send update to server when user changes a count in UI
  public async sendSessionUpdate(date: string, count: number) {
    if (!this.roomCode) return;

    this.sendWsMessage({
      type: 'UPDATE_SESSION',
      roomCode: this.roomCode,
      date,
      count,
      deviceId: this.deviceId
    });
  }

  // REST: Create Room
  public async createRoom(includeLocalData: boolean = true): Promise<{ success: boolean; roomCode?: string; error?: string }> {
    try {
      let initialEntries: Array<{ date: string; count: number }> = [];
      if (includeLocalData) {
        const localSessions = await db.select().from(sessions);
        initialEntries = localSessions.map((s: { date: string; count: number }) => ({ date: s.date, count: s.count }));
      }

      const res = await fetch(`${this.serverUrl}/api/rooms/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialEntries })
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomCode: formattedCode })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error || 'Odaya katılınamadı' };
      }

      this.roomCode = formattedCode;
      await setSetting('room_code', formattedCode);

      if (Array.isArray(data.entries)) {
        await this.applyFullSyncToLocalDb(data.entries);
        this.syncListeners.forEach(listener => listener());
      }

      this.disconnect();
      this.connect();

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Bağlantı hatası' };
    }
  }

  // REST: Fetch full room state
  public async syncWithServer(): Promise<void> {
    if (!this.roomCode) return;
    try {
      const res = await fetch(`${this.serverUrl}/api/rooms/${this.roomCode}/sync`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.entries)) {
          await this.applyFullSyncToLocalDb(data.entries);
          this.syncListeners.forEach(listener => listener());
        }
      }
    } catch (e) {
      console.warn('Sync with server failed:', e);
    }
  }

  // REST: Push all local data to room
  public async pushAllLocalData(): Promise<{ success: boolean; error?: string }> {
    if (!this.roomCode) return { success: false, error: 'Oda seçili değil' };
    try {
      const localSessions = await db.select().from(sessions);
      const entries = localSessions.map((s: { date: string; count: number }) => ({ date: s.date, count: s.count }));

      const res = await fetch(`${this.serverUrl}/api/rooms/${this.roomCode}/push-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries, author: this.deviceId })
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
