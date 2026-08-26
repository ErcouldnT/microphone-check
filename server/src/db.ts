import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { CalendarEntry, Room } from './types.js';

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'calendar.db');

// Ensure data directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(dbPath);

// Enable WAL mode for better concurrency performance
db.pragma('journal_mode = WAL');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      created_at INTEGER NOT NULL,
      last_active_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS calendar_entries (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      date TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      updated_by TEXT,
      FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      UNIQUE(room_id, date)
    );

    CREATE INDEX IF NOT EXISTS idx_entries_room_date ON calendar_entries(room_id, date);
    CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
  `);
}

// Generate friendly 6-digit room code like MIC-8492
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid 0/O, 1/I confusion
  let code = 'MIC-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function createRoom(customCode?: string): Room {
  let code = customCode ? customCode.toUpperCase().trim() : generateRoomCode();
  let attempts = 0;

  while (attempts < 10) {
    try {
      const id = crypto.randomUUID();
      const now = Date.now();
      const stmt = db.prepare(`
        INSERT INTO rooms (id, code, created_at, last_active_at)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(id, code, now, now);
      return { id, code, createdAt: now, lastActiveAt: now };
    } catch (err: any) {
      if (err.message && err.message.includes('UNIQUE constraint failed: rooms.code')) {
        code = generateRoomCode();
        attempts++;
      } else {
        throw err;
      }
    }
  }
  throw new Error('Failed to generate a unique room code. Please try again.');
}

export function getRoomByCode(code: string): Room | null {
  const stmt = db.prepare('SELECT id, code, created_at as createdAt, last_active_at as lastActiveAt FROM rooms WHERE code = ?');
  const room = stmt.get(code.toUpperCase().trim()) as Room | undefined;
  return room || null;
}

export function touchRoom(roomId: string) {
  const stmt = db.prepare('UPDATE rooms SET last_active_at = ? WHERE id = ?');
  stmt.run(Date.now(), roomId);
}

export function getRoomEntries(roomId: string): CalendarEntry[] {
  const stmt = db.prepare(`
    SELECT id, room_id as roomId, date, count, updated_at as updatedAt, updated_by as updatedBy
    FROM calendar_entries
    WHERE room_id = ?
    ORDER BY date ASC
  `);
  return stmt.all(roomId) as CalendarEntry[];
}

export function upsertCalendarEntry(roomId: string, date: string, count: number, updatedBy?: string): CalendarEntry {
  const now = Date.now();
  touchRoom(roomId);

  if (count <= 0) {
    const deleteStmt = db.prepare('DELETE FROM calendar_entries WHERE room_id = ? AND date = ?');
    deleteStmt.run(roomId, date);
    return { roomId, date, count: 0, updatedAt: now, updatedBy };
  }

  const id = crypto.randomUUID();
  const upsertStmt = db.prepare(`
    INSERT INTO calendar_entries (id, room_id, date, count, updated_at, updated_by)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(room_id, date) DO UPDATE SET
      count = excluded.count,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by
  `);
  upsertStmt.run(id, roomId, date, count, now, updatedBy || null);

  return { id, roomId, date, count, updatedAt: now, updatedBy };
}

export function bulkUpsertCalendarEntries(roomId: string, entries: Array<{ date: string; count: number; updatedBy?: string }>) {
  const now = Date.now();
  touchRoom(roomId);

  const insertStmt = db.prepare(`
    INSERT INTO calendar_entries (id, room_id, date, count, updated_at, updated_by)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(room_id, date) DO UPDATE SET
      count = excluded.count,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by
  `);

  const deleteStmt = db.prepare('DELETE FROM calendar_entries WHERE room_id = ? AND date = ?');

  const transaction = db.transaction((items: Array<{ date: string; count: number; updatedBy?: string }>) => {
    for (const item of items) {
      if (item.count <= 0) {
        deleteStmt.run(roomId, item.date);
      } else {
        insertStmt.run(crypto.randomUUID(), roomId, item.date, item.count, now, item.updatedBy || null);
      }
    }
  });

  transaction(entries);
}
