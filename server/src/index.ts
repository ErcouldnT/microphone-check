import express, { Request, Response } from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import {
  initDb,
  createRoom,
  getRoomByCode,
  getRoomEntries,
  upsertCalendarEntry,
  bulkUpsertCalendarEntries,
  getRoomNotes,
  upsertRoomNote,
  deleteRoomNote,
  bulkUpsertRoomNotes,
  getRoomEvents,
  upsertRoomEvent,
  deleteRoomEvent,
  bulkUpsertRoomEvents,
  getRoomCounters,
  upsertRoomCounter,
  deleteRoomCounter,
  bulkUpsertRoomCounters,
  upsertRoomPushToken,
  getRoomPushTokens,
  getAllPushTokens
} from './db.js';
import { roomManager } from './rooms.js';
import { ClientMessage, ServerMessage } from './types.js';
import { sendExpoPushNotifications } from './push.js';
import { authMiddleware, validateWsAuth } from './auth.js';
import { startEventReminderScheduler } from './eventReminders.js';

// Initialize Database
initDb();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// Apply Authentication Middleware for all API routes
app.use('/api', authMiddleware);

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

// REST API Endpoints

// 1. Create a new Room
app.post('/api/rooms/create', (req: Request, res: Response) => {
  try {
    const { customCode, initialEntries, initialNotes, initialEvents, initialCounters } = req.body || {};
    const room = createRoom(customCode);

    if (Array.isArray(initialEntries) && initialEntries.length > 0) {
      bulkUpsertCalendarEntries(room.id, initialEntries);
    }

    if (Array.isArray(initialNotes) && initialNotes.length > 0) {
      bulkUpsertRoomNotes(room.id, initialNotes);
    }

    if (Array.isArray(initialEvents) && initialEvents.length > 0) {
      bulkUpsertRoomEvents(room.id, initialEvents);
    }

    if (Array.isArray(initialCounters) && initialCounters.length > 0) {
      bulkUpsertRoomCounters(room.id, initialCounters);
    }

    res.json({
      success: true,
      roomCode: room.code,
      roomId: room.id,
      createdAt: room.createdAt
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 2. Join / Validate a Room
app.post('/api/rooms/join', (req: Request, res: Response) => {
  try {
    const { roomCode } = req.body || {};
    if (!roomCode) {
      return res.status(400).json({ success: false, error: 'roomCode is required' });
    }

    const room = getRoomByCode(roomCode);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Oda bulunamadı (Room not found)' });
    }

    const entries = getRoomEntries(room.id);
    const notes = getRoomNotes(room.id);
    const events = getRoomEvents(room.id);
    const counters = getRoomCounters(room.id);

    res.json({
      success: true,
      roomCode: room.code,
      roomId: room.id,
      entries,
      notes,
      events,
      counters
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Sync full room data
app.get('/api/rooms/:code/sync', (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const room = getRoomByCode(code);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    const entries = getRoomEntries(room.id);
    const notes = getRoomNotes(room.id);
    const events = getRoomEvents(room.id);
    const counters = getRoomCounters(room.id);

    res.json({
      success: true,
      roomCode: room.code,
      roomId: room.id,
      entries,
      notes,
      events,
      counters
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Bulk push all local data to room
app.post('/api/rooms/:code/push-all', (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const { entries, notes, events, counters, author } = req.body;

    const room = getRoomByCode(code);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    if (Array.isArray(entries) && entries.length > 0) {
      bulkUpsertCalendarEntries(
        room.id,
        entries.map((e: any) => ({ date: e.date, count: e.count, updatedBy: author }))
      );
    }

    if (Array.isArray(notes) && notes.length > 0) {
      bulkUpsertRoomNotes(
        room.id,
        notes.map((n: any) => ({ noteId: n.noteId, date: n.date, content: n.content, updatedBy: author }))
      );
    }

    if (Array.isArray(events) && events.length > 0) {
      bulkUpsertRoomEvents(room.id, events);
    }

    if (Array.isArray(counters) && counters.length > 0) {
      bulkUpsertRoomCounters(room.id, counters);
    }

    // Broadcast full sync to connected clients in room
    const allEntries = getRoomEntries(room.id);
    const allNotes = getRoomNotes(room.id);
    const allEvents = getRoomEvents(room.id);
    const allCounters = getRoomCounters(room.id);

    roomManager.broadcastToRoom(room.code, {
      type: 'SYNC_DATA',
      entries: allEntries,
      notes: allNotes,
      events: allEvents,
      counters: allCounters
    });

    res.json({
      success: true,
      entriesCount: entries?.length || 0,
      notesCount: notes?.length || 0,
      eventsCount: events?.length || 0,
      countersCount: counters?.length || 0
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Register Push Notification Token
app.post('/api/rooms/:code/register-push-token', (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const { deviceId, pushToken, platform, role, displayName, timezone } = req.body;

    if (!deviceId || !pushToken) {
      return res.status(400).json({ success: false, error: 'Missing deviceId or pushToken' });
    }

    const room = getRoomByCode(code);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    upsertRoomPushToken(room.id, deviceId, pushToken, platform, role, displayName, timezone);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/test-push', async (req: Request, res: Response) => {
  try {
    const { title, body, roomCode } = req.body || {};
    let tokens: string[] = [];
    if (roomCode) {
      const room = getRoomByCode(roomCode);
      if (room) tokens = getRoomPushTokens(room.id);
    } else {
      tokens = getAllPushTokens();
    }

    if (tokens.length === 0) {
      return res.json({ success: false, message: 'No push tokens registered yet on server', tokensCount: 0 });
    }

    const messages = tokens.map(to => ({
      to,
      sound: 'default',
      title: title || '🔔 Test Bildirimi',
      body: body || 'Microphone Check bildirim sistemi başarıyla çalışıyor! 🎉',
      data: { test: true },
      priority: 'high',
      badge: 1,
      channelId: 'default',
    }));

    const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const expoResult = await expoRes.json();

    const ticketIds: string[] = [];
    if (Array.isArray(expoResult.data)) {
      for (const item of expoResult.data) {
        if (item.id) ticketIds.push(item.id);
      }
    }

    let receiptData = null;
    if (ticketIds.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const receiptRes = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: ticketIds }),
      });
      receiptData = await receiptRes.json();
    }

    res.json({
      success: true,
      message: `Notification sent to ${tokens.length} devices`,
      tokensCount: tokens.length,
      tokens,
      expoResult,
      receiptData
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const MONTHS_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

/** "2026-09-03" -> "3 Eylül". */
function formatDate(date: string): string {
  const [, month, day] = date.split('-').map(Number);
  if (!month || !day) return date;
  return `${day} ${MONTHS_TR[month - 1] ?? ''}`.trim();
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** Human-readable "when" for a plan, used in push bodies. */
function describeWhen(event: { startDate: string; endDate: string; isAllDay: boolean; startTime?: string }): string {
  if (event.startDate !== event.endDate) {
    return `${formatDate(event.startDate)} – ${formatDate(event.endDate)}`;
  }
  if (event.isAllDay || !event.startTime) return `${formatDate(event.startDate)} · tüm gün`;
  return `${formatDate(event.startDate)} · ${event.startTime}`;
}

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server attached to HTTP server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket, req) => {
  try {
    const isAuth = validateWsAuth(req.url || '', req.headers);
    if (!isAuth) {
      ws.close(4001, 'Unauthorized');
      return;
    }

    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const queryRoom = url.searchParams.get('room');
    const queryDevice = url.searchParams.get('deviceId');

    if (queryRoom) {
      const room = getRoomByCode(queryRoom);
      if (room) {
        const membersCount = roomManager.joinRoom(ws, room.code, room.id, queryDevice || undefined);
        const entries = getRoomEntries(room.id);
        const notes = getRoomNotes(room.id);
        const events = getRoomEvents(room.id);
        const counters = getRoomCounters(room.id);

        const joinedMsg: ServerMessage = {
          type: 'ROOM_JOINED',
          roomCode: room.code,
          membersCount
        };
        ws.send(JSON.stringify(joinedMsg));

        const syncMsg: ServerMessage = {
          type: 'SYNC_DATA',
          entries,
          notes,
          events,
          counters
        };
        ws.send(JSON.stringify(syncMsg));
      }
    }
  } catch (e) {
    console.error('URL parse error in WS connection:', e);
  }

  ws.on('message', (rawMessage: string) => {
    try {
      const msg: ClientMessage = JSON.parse(rawMessage.toString());

      if (msg.type === 'PING') {
        const pong: ServerMessage = { type: 'PONG' };
        return ws.send(JSON.stringify(pong));
      }

      if (msg.type === 'JOIN_ROOM') {
        const room = getRoomByCode(msg.roomCode);
        if (!room) {
          const errMsg: ServerMessage = {
            type: 'ERROR',
            message: `Oda bulunamadı: ${msg.roomCode}`
          };
          return ws.send(JSON.stringify(errMsg));
        }

        const membersCount = roomManager.joinRoom(ws, room.code, room.id, msg.deviceId);
        const entries = getRoomEntries(room.id);
        const notes = getRoomNotes(room.id);
        const events = getRoomEvents(room.id);
        const counters = getRoomCounters(room.id);

        const joinedMsg: ServerMessage = {
          type: 'ROOM_JOINED',
          roomCode: room.code,
          membersCount
        };
        ws.send(JSON.stringify(joinedMsg));

        const syncMsg: ServerMessage = {
          type: 'SYNC_DATA',
          entries,
          notes,
          events,
          counters
        };
        ws.send(JSON.stringify(syncMsg));
        return;
      }

      if (msg.type === 'UPDATE_SESSION') {
        const client = roomManager.getClient(ws);
        const roomCode = msg.roomCode || client?.roomCode;
        if (!roomCode) return ws.send(JSON.stringify({ type: 'ERROR', message: 'Not in room' }));

        const room = getRoomByCode(roomCode);
        if (!room) return ws.send(JSON.stringify({ type: 'ERROR', message: 'Room not found' }));

        upsertCalendarEntry(room.id, msg.date, msg.count, msg.author);

        const updateMsg: ServerMessage = {
          type: 'SESSION_UPDATED',
          date: msg.date,
          count: msg.count,
          author: msg.author,
          timestamp: Date.now()
        };
        roomManager.broadcastToRoom(room.code, updateMsg, ws);
        return;
      }

      if (msg.type === 'UPDATE_NOTE') {
        const client = roomManager.getClient(ws);
        const roomCode = msg.roomCode || client?.roomCode;
        if (!roomCode) return ws.send(JSON.stringify({ type: 'ERROR', message: 'Not in room' }));

        const room = getRoomByCode(roomCode);
        if (!room) return ws.send(JSON.stringify({ type: 'ERROR', message: 'Room not found' }));

        // Clients older than v3.1 omit noteId and keep one note per day.
        const noteId = msg.noteId || `legacy_${msg.date}`;
        upsertRoomNote(room.id, noteId, msg.date, msg.content, msg.author);

        const noteMsg: ServerMessage = {
          type: 'NOTE_UPDATED',
          noteId,
          date: msg.date,
          content: msg.content,
          author: msg.author,
          timestamp: Date.now()
        };
        roomManager.broadcastToRoom(room.code, noteMsg, ws);

        // Send push notification to devices in room that are in background/closed
        const senderDevice = msg.author || client?.deviceId;
        const pushTokens = getRoomPushTokens(room.id, senderDevice, (msg as any).senderToken);
        sendExpoPushNotifications(pushTokens, {
          title: 'Yeni not',
          body: `${formatDate(msg.date)} · ${truncate(msg.content, 80)}`,
          data: { roomCode: room.code, date: msg.date, noteId }
        });
        return;
      }

      if (msg.type === 'DELETE_NOTE') {
        const client = roomManager.getClient(ws);
        const roomCode = msg.roomCode || client?.roomCode;
        if (!roomCode) return ws.send(JSON.stringify({ type: 'ERROR', message: 'Not in room' }));

        const room = getRoomByCode(roomCode);
        if (!room) return ws.send(JSON.stringify({ type: 'ERROR', message: 'Room not found' }));

        deleteRoomNote(room.id, msg.noteId);

        const delNoteMsg: ServerMessage = {
          type: 'NOTE_DELETED',
          noteId: msg.noteId,
          date: msg.date,
          author: msg.author,
          timestamp: Date.now()
        };
        roomManager.broadcastToRoom(room.code, delNoteMsg, ws);
        return;
      }

      if (msg.type === 'UPDATE_EVENT') {
        const client = roomManager.getClient(ws);
        const roomCode = msg.roomCode || client?.roomCode;
        if (!roomCode) return ws.send(JSON.stringify({ type: 'ERROR', message: 'Not in room' }));

        const room = getRoomByCode(roomCode);
        if (!room) return ws.send(JSON.stringify({ type: 'ERROR', message: 'Room not found' }));

        const previous = getRoomEvents(room.id).find(e => e.id === msg.event.id);
        const isNew = !previous;
        const completionChanged =
          !isNew && Boolean(previous!.completed) !== Boolean(msg.event.completed);

        const saved = upsertRoomEvent(room.id, msg.event, msg.author);

        const eventMsg: ServerMessage = {
          type: 'EVENT_UPDATED',
          event: saved,
          author: msg.author,
          timestamp: Date.now()
        };
        roomManager.broadcastToRoom(room.code, eventMsg, ws);

        // Send push notification to devices in room that are in background/closed (excluding sender)
        const senderDevice = msg.author || client?.deviceId;
        const pushTokens = getRoomPushTokens(room.id, senderDevice, (msg as any).senderToken);

        const when = describeWhen(msg.event);
        const pushTitle = completionChanged
          ? (msg.event.completed ? 'Plan tamamlandı' : 'Plan yeniden açıldı')
          : isNew
            ? 'Yeni plan'
            : 'Plan güncellendi';
        const pushBody = completionChanged
          ? `"${msg.event.title}" · ${when}`
          : `"${msg.event.title}" · ${when}`;

        sendExpoPushNotifications(pushTokens, {
          title: pushTitle,
          body: pushBody,
          data: { roomCode: room.code, eventId: msg.event.id, date: msg.event.startDate }
        });
        return;
      }

      if (msg.type === 'DELETE_EVENT') {
        const client = roomManager.getClient(ws);
        const roomCode = msg.roomCode || client?.roomCode;
        if (!roomCode) return ws.send(JSON.stringify({ type: 'ERROR', message: 'Not in room' }));

        const room = getRoomByCode(roomCode);
        if (!room) return ws.send(JSON.stringify({ type: 'ERROR', message: 'Room not found' }));

        deleteRoomEvent(room.id, msg.eventId);

        const delMsg: ServerMessage = {
          type: 'EVENT_DELETED',
          eventId: msg.eventId,
          author: msg.author,
          timestamp: Date.now()
        };
        roomManager.broadcastToRoom(room.code, delMsg, ws);

        // Send push notification to devices in room that are in background/closed (excluding sender)
        const senderDevice = msg.author || client?.deviceId;
        const pushTokens = getRoomPushTokens(room.id, senderDevice, (msg as any).senderToken);
        sendExpoPushNotifications(pushTokens, {
          title: 'Plan silindi',
          body: 'Takvimden bir plan kaldırıldı.',
          data: { roomCode: room.code }
        });
        return;
      }

      if (msg.type === 'UPDATE_COUNTER') {
        const client = roomManager.getClient(ws);
        const roomCode = msg.roomCode || client?.roomCode;
        if (!roomCode) return ws.send(JSON.stringify({ type: 'ERROR', message: 'Not in room' }));

        const room = getRoomByCode(roomCode);
        if (!room) return ws.send(JSON.stringify({ type: 'ERROR', message: 'Room not found' }));

        const saved = upsertRoomCounter(room.id, msg.counter);

        const counterMsg: ServerMessage = {
          type: 'COUNTER_UPDATED',
          counter: saved,
          author: msg.author,
          timestamp: Date.now()
        };
        roomManager.broadcastToRoom(room.code, counterMsg, ws);

        // Send push notification to other devices in room
        const senderDevice = msg.author || client?.deviceId;
        const pushTokens = getRoomPushTokens(room.id, senderDevice, (msg as any).senderToken);
        sendExpoPushNotifications(pushTokens, {
          title: 'Yeni özel gün',
          body: `"${msg.counter.title}" · ${formatDate(msg.counter.targetDate)}`,
          data: { roomCode: room.code, counterId: msg.counter.id, date: msg.counter.targetDate }
        });
        return;
      }

      if (msg.type === 'DELETE_COUNTER') {
        const client = roomManager.getClient(ws);
        const roomCode = msg.roomCode || client?.roomCode;
        if (!roomCode) return ws.send(JSON.stringify({ type: 'ERROR', message: 'Not in room' }));

        const room = getRoomByCode(roomCode);
        if (!room) return ws.send(JSON.stringify({ type: 'ERROR', message: 'Room not found' }));

        deleteRoomCounter(room.id, msg.counterId);

        const delMsg: ServerMessage = {
          type: 'COUNTER_DELETED',
          counterId: msg.counterId,
          author: msg.author,
          timestamp: Date.now()
        };
        roomManager.broadcastToRoom(room.code, delMsg, ws);
        return;
      }
    } catch (err: any) {
      console.error('Error handling WebSocket message:', err);
      const errMsg: ServerMessage = { type: 'ERROR', message: 'Invalid message payload' };
      ws.send(JSON.stringify(errMsg));
    }
  });

  ws.on('close', () => {
    roomManager.leaveRoom(ws);
  });

  ws.on('error', (err) => {
    console.error('WebSocket client error:', err);
    roomManager.leaveRoom(ws);
  });
});

startEventReminderScheduler();

server.listen(PORT, () => {
  console.log(`🚀 Microphone Check Calendar Server running on port ${PORT}`);
  console.log(`📡 WebSocket endpoint ready at ws://localhost:${PORT}`);
});
