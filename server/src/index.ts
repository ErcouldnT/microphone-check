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
  bulkUpsertRoomNotes
} from './db.js';
import { roomManager } from './rooms.js';
import { ClientMessage, ServerMessage } from './types.js';

// Initialize Database
initDb();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

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
    const { customCode, initialEntries, initialNotes } = req.body || {};
    const room = createRoom(customCode);

    if (Array.isArray(initialEntries) && initialEntries.length > 0) {
      bulkUpsertCalendarEntries(room.id, initialEntries);
    }

    if (Array.isArray(initialNotes) && initialNotes.length > 0) {
      bulkUpsertRoomNotes(room.id, initialNotes);
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

    res.json({
      success: true,
      roomCode: room.code,
      roomId: room.id,
      entries,
      notes
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

    res.json({
      success: true,
      roomCode: room.code,
      roomId: room.id,
      entries,
      notes
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Bulk push local entries and notes to room
app.post('/api/rooms/:code/push-all', (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const { entries, notes, author } = req.body;

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
        notes.map((n: any) => ({ date: n.date, content: n.content, updatedBy: author }))
      );
    }

    // Broadcast full sync to connected clients in room
    const allEntries = getRoomEntries(room.id);
    const allNotes = getRoomNotes(room.id);

    roomManager.broadcastToRoom(room.code, {
      type: 'SYNC_DATA',
      entries: allEntries,
      notes: allNotes
    });

    res.json({
      success: true,
      entriesCount: entries?.length || 0,
      notesCount: notes?.length || 0
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server attached to HTTP server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket, req) => {
  // Support roomCode passed via query params (e.g. ?room=MIC-1234&device=xyz)
  try {
    const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
    const queryRoom = url.searchParams.get('room');
    const queryDevice = url.searchParams.get('deviceId');

    if (queryRoom) {
      const room = getRoomByCode(queryRoom);
      if (room) {
        const membersCount = roomManager.joinRoom(ws, room.code, room.id, queryDevice || undefined);
        const entries = getRoomEntries(room.id);
        const notes = getRoomNotes(room.id);

        const joinedMsg: ServerMessage = {
          type: 'ROOM_JOINED',
          roomCode: room.code,
          membersCount
        };
        ws.send(JSON.stringify(joinedMsg));

        const syncMsg: ServerMessage = {
          type: 'SYNC_DATA',
          entries,
          notes
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

        const joinedMsg: ServerMessage = {
          type: 'ROOM_JOINED',
          roomCode: room.code,
          membersCount
        };
        ws.send(JSON.stringify(joinedMsg));

        const syncMsg: ServerMessage = {
          type: 'SYNC_DATA',
          entries,
          notes
        };
        ws.send(JSON.stringify(syncMsg));
        return;
      }

      if (msg.type === 'UPDATE_SESSION') {
        const client = roomManager.getClient(ws);
        const roomCode = msg.roomCode || client?.roomCode;

        if (!roomCode) {
          const errMsg: ServerMessage = { type: 'ERROR', message: 'Not connected to any room' };
          return ws.send(JSON.stringify(errMsg));
        }

        const room = getRoomByCode(roomCode);
        if (!room) {
          const errMsg: ServerMessage = { type: 'ERROR', message: 'Room does not exist' };
          return ws.send(JSON.stringify(errMsg));
        }

        // Save in SQLite DB
        upsertCalendarEntry(room.id, msg.date, msg.count, msg.author);

        // Broadcast to all other clients in the room in real-time
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

        if (!roomCode) {
          const errMsg: ServerMessage = { type: 'ERROR', message: 'Not connected to any room' };
          return ws.send(JSON.stringify(errMsg));
        }

        const room = getRoomByCode(roomCode);
        if (!room) {
          const errMsg: ServerMessage = { type: 'ERROR', message: 'Room does not exist' };
          return ws.send(JSON.stringify(errMsg));
        }

        // Save note in SQLite DB
        upsertRoomNote(room.id, msg.date, msg.content, msg.author);

        // Broadcast note update in real-time
        const noteMsg: ServerMessage = {
          type: 'NOTE_UPDATED',
          date: msg.date,
          content: msg.content,
          author: msg.author,
          timestamp: Date.now()
        };

        roomManager.broadcastToRoom(room.code, noteMsg, ws);
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

server.listen(PORT, () => {
  console.log(`🚀 Microphone Check Calendar Server running on port ${PORT}`);
  console.log(`📡 WebSocket endpoint ready at ws://localhost:${PORT}`);
});
