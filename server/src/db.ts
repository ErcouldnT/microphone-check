import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { CalendarEntry, CalendarNote, CalendarEvent, RelationshipCounter, Room } from './types.js';

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

    CREATE TABLE IF NOT EXISTS room_notes (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      note_id TEXT NOT NULL,
      date TEXT NOT NULL,
      content TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      updated_by TEXT,
      FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      UNIQUE(room_id, note_id)
    );

    CREATE TABLE IF NOT EXISTS room_events (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      is_all_day INTEGER DEFAULT 1,
      color TEXT NOT NULL,
      target TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      timezone TEXT,
      author TEXT,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS room_counters (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      title TEXT NOT NULL,
      target_date TEXT NOT NULL,
      type TEXT NOT NULL,
      icon TEXT,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS room_push_tokens (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      push_token TEXT NOT NULL,
      platform TEXT,
      role TEXT,
      display_name TEXT,
      timezone TEXT,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      UNIQUE(room_id, device_id)
    );

    CREATE INDEX IF NOT EXISTS idx_entries_room_date ON calendar_entries(room_id, date);
    CREATE INDEX IF NOT EXISTS idx_notes_room_date ON room_notes(room_id, date);
    CREATE INDEX IF NOT EXISTS idx_events_room ON room_events(room_id);
    CREATE INDEX IF NOT EXISTS idx_counters_room ON room_counters(room_id);
    CREATE INDEX IF NOT EXISTS idx_push_room ON room_push_tokens(room_id);
    CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
  `);

  runV31Migrations();
}

function tableColumns(table: string): string[] {
  try {
    const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    return rows.map(r => r.name);
  } catch {
    return [];
  }
}

/**
 * v3.1 schema upgrades:
 *  - a day may hold several notes, so `room_notes` moves from UNIQUE(room_id, date)
 *    to UNIQUE(room_id, note_id). SQLite cannot drop a constraint in place, so the
 *    table is rebuilt with the existing rows carried over.
 *  - events gain a `completed` flag.
 */
function runV31Migrations() {
  const noteColumns = tableColumns('room_notes');
  if (noteColumns.length > 0 && !noteColumns.includes('note_id')) {
    db.exec(`
      PRAGMA foreign_keys=off;
      BEGIN TRANSACTION;
      ALTER TABLE room_notes RENAME TO room_notes_legacy_v3;
      CREATE TABLE room_notes (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        note_id TEXT NOT NULL,
        date TEXT NOT NULL,
        content TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        updated_by TEXT,
        FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        UNIQUE(room_id, note_id)
      );
      INSERT INTO room_notes (id, room_id, note_id, date, content, updated_at, updated_by)
        SELECT id, room_id, 'legacy_' || date, date, content, updated_at, updated_by
        FROM room_notes_legacy_v3
        WHERE content IS NOT NULL AND trim(content) != '';
      DROP TABLE room_notes_legacy_v3;
      COMMIT;
      PRAGMA foreign_keys=on;
    `);
    console.log('[migration] room_notes rebuilt for multi-note-per-day support');
  }

  const eventColumns = tableColumns('room_events');
  if (eventColumns.length > 0 && !eventColumns.includes('completed')) {
    db.exec(`ALTER TABLE room_events ADD COLUMN completed INTEGER NOT NULL DEFAULT 0;`);
    console.log('[migration] room_events.completed added');
  }

  if (eventColumns.length > 0 && !eventColumns.includes('timezone')) {
    db.exec(`ALTER TABLE room_events ADD COLUMN timezone TEXT;`);
    console.log('[migration] room_events.timezone added');
  }

  db.exec(`CREATE INDEX IF NOT EXISTS idx_notes_room_note ON room_notes(room_id, note_id);`);

  // Knowing which person a device belongs to lets the server word an
  // event-start push for its recipient ("Svetlana is doing this now") and skip
  // the device whose own plan it is.
  const tokenColumns = tableColumns('room_push_tokens');
  if (tokenColumns.length > 0 && !tokenColumns.includes('role')) {
    db.exec(`ALTER TABLE room_push_tokens ADD COLUMN role TEXT;`);
    db.exec(`ALTER TABLE room_push_tokens ADD COLUMN display_name TEXT;`);
    console.log('[migration] room_push_tokens.role/display_name added');
  }

  // Plans are stored in the couple's local wall-clock time, so the scheduler
  // has to evaluate them in that zone rather than the server's.
  if (tokenColumns.length > 0 && !tokenColumns.includes('timezone')) {
    db.exec(`ALTER TABLE room_push_tokens ADD COLUMN timezone TEXT;`);
    console.log('[migration] room_push_tokens.timezone added');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS sent_event_reminders (
      id TEXT PRIMARY KEY,
      sent_at INTEGER NOT NULL
    );
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

// Calendar Entries (Count)
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

// Calendar Notes
export function getRoomNotes(roomId: string): CalendarNote[] {
  const stmt = db.prepare(`
    SELECT id, room_id as roomId, note_id as noteId, date, content,
           updated_at as updatedAt, updated_by as updatedBy
    FROM room_notes
    WHERE room_id = ?
    ORDER BY date ASC, updated_at ASC
  `);
  return stmt.all(roomId) as CalendarNote[];
}

export function upsertRoomNote(
  roomId: string,
  noteId: string,
  date: string,
  content: string,
  updatedBy?: string
): CalendarNote {
  const now = Date.now();
  touchRoom(roomId);

  const trimmed = content.trim();
  if (!trimmed) {
    db.prepare('DELETE FROM room_notes WHERE room_id = ? AND note_id = ?').run(roomId, noteId);
    return { roomId, noteId, date, content: '', updatedAt: now, updatedBy };
  }

  const id = crypto.randomUUID();
  const upsertStmt = db.prepare(`
    INSERT INTO room_notes (id, room_id, note_id, date, content, updated_at, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(room_id, note_id) DO UPDATE SET
      date = excluded.date,
      content = excluded.content,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by
  `);
  upsertStmt.run(id, roomId, noteId, date, trimmed, now, updatedBy || null);

  return { id, roomId, noteId, date, content: trimmed, updatedAt: now, updatedBy };
}

export function deleteRoomNote(roomId: string, noteId: string) {
  touchRoom(roomId);
  db.prepare('DELETE FROM room_notes WHERE room_id = ? AND note_id = ?').run(roomId, noteId);
}

type IncomingNote = { noteId?: string; date: string; content: string; updatedBy?: string };

export function bulkUpsertRoomNotes(roomId: string, notes: IncomingNote[]) {
  const now = Date.now();
  touchRoom(roomId);

  const insertStmt = db.prepare(`
    INSERT INTO room_notes (id, room_id, note_id, date, content, updated_at, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(room_id, note_id) DO UPDATE SET
      date = excluded.date,
      content = excluded.content,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by
  `);

  const deleteStmt = db.prepare('DELETE FROM room_notes WHERE room_id = ? AND note_id = ?');

  const transaction = db.transaction((items: IncomingNote[]) => {
    for (const item of items) {
      // Clients older than v3.1 send date-keyed notes with no id.
      const noteId = item.noteId || `legacy_${item.date}`;
      const trimmed = item.content?.trim();
      if (!trimmed) {
        deleteStmt.run(roomId, noteId);
      } else {
        insertStmt.run(crypto.randomUUID(), roomId, noteId, item.date, trimmed, now, item.updatedBy || null);
      }
    }
  });

  transaction(notes);
}

// Calendar Events
export function getRoomEvents(roomId: string): CalendarEvent[] {
  const stmt = db.prepare(`
    SELECT id, room_id as roomId, title, description, start_date as startDate, end_date as endDate,
           start_time as startTime, end_time as endTime, is_all_day as isAllDay, color, target,
           completed, timezone, author, updated_at as updatedAt
    FROM room_events
    WHERE room_id = ?
    ORDER BY start_date ASC, start_time ASC
  `);
  const rows = stmt.all(roomId) as any[];
  return rows.map(r => ({
    id: r.id,
    roomId: r.roomId,
    title: r.title,
    description: r.description || undefined,
    startDate: r.startDate,
    endDate: r.endDate,
    startTime: r.startTime || undefined,
    endTime: r.endTime || undefined,
    isAllDay: Boolean(r.isAllDay),
    color: r.color,
    target: r.target,
    completed: Boolean(r.completed),
    timezone: r.timezone || undefined,
    author: r.author || undefined,
    updatedAt: r.updatedAt,
  }));
}

export function upsertRoomEvent(roomId: string, event: CalendarEvent, author?: string): CalendarEvent {
  const now = Date.now();
  touchRoom(roomId);

  const stmt = db.prepare(`
    INSERT INTO room_events (id, room_id, title, description, start_date, end_date, start_time, end_time, is_all_day, color, target, completed, timezone, author, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      is_all_day = excluded.is_all_day,
      color = excluded.color,
      target = excluded.target,
      completed = excluded.completed,
      timezone = COALESCE(excluded.timezone, room_events.timezone),
      author = excluded.author,
      updated_at = excluded.updated_at
  `);

  stmt.run(
    event.id,
    roomId,
    event.title,
    event.description || null,
    event.startDate,
    event.endDate,
    event.startTime || null,
    event.endTime || null,
    event.isAllDay ? 1 : 0,
    event.color,
    event.target,
    event.completed ? 1 : 0,
    event.timezone || null,
    author || event.author || null,
    now
  );

  return { ...event, roomId, author: author || event.author, updatedAt: now };
}

export function deleteRoomEvent(roomId: string, eventId: string) {
  touchRoom(roomId);
  const stmt = db.prepare('DELETE FROM room_events WHERE room_id = ? AND id = ?');
  stmt.run(roomId, eventId);
}

export function bulkUpsertRoomEvents(roomId: string, events: CalendarEvent[]) {
  const now = Date.now();
  touchRoom(roomId);

  const stmt = db.prepare(`
    INSERT INTO room_events (id, room_id, title, description, start_date, end_date, start_time, end_time, is_all_day, color, target, completed, timezone, author, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      is_all_day = excluded.is_all_day,
      color = excluded.color,
      target = excluded.target,
      completed = excluded.completed,
      timezone = COALESCE(excluded.timezone, room_events.timezone),
      author = excluded.author,
      updated_at = excluded.updated_at
  `);

  const transaction = db.transaction((items: CalendarEvent[]) => {
    for (const e of items) {
      stmt.run(
        e.id,
        roomId,
        e.title,
        e.description || null,
        e.startDate,
        e.endDate,
        e.startTime || null,
        e.endTime || null,
        e.isAllDay ? 1 : 0,
        e.color,
        e.target,
        e.completed ? 1 : 0,
        e.timezone || null,
        e.author || null,
        now
      );
    }
  });

  transaction(events);
}

// Relationship Counters
export function getRoomCounters(roomId: string): RelationshipCounter[] {
  const stmt = db.prepare(`
    SELECT id, room_id as roomId, title, target_date as targetDate, type, icon, updated_at as updatedAt
    FROM room_counters
    WHERE room_id = ?
    ORDER BY target_date ASC
  `);
  return stmt.all(roomId) as RelationshipCounter[];
}

export function upsertRoomCounter(roomId: string, counter: RelationshipCounter): RelationshipCounter {
  const now = Date.now();
  touchRoom(roomId);

  const stmt = db.prepare(`
    INSERT INTO room_counters (id, room_id, title, target_date, type, icon, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      target_date = excluded.target_date,
      type = excluded.type,
      icon = excluded.icon,
      updated_at = excluded.updated_at
  `);

  stmt.run(
    counter.id,
    roomId,
    counter.title,
    counter.targetDate,
    counter.type,
    counter.icon || null,
    now
  );

  return { ...counter, roomId, updatedAt: now };
}

export function deleteRoomCounter(roomId: string, counterId: string) {
  touchRoom(roomId);
  const stmt = db.prepare('DELETE FROM room_counters WHERE room_id = ? AND id = ?');
  stmt.run(roomId, counterId);
}

export function bulkUpsertRoomCounters(roomId: string, counters: RelationshipCounter[]) {
  const now = Date.now();
  touchRoom(roomId);

  const stmt = db.prepare(`
    INSERT INTO room_counters (id, room_id, title, target_date, type, icon, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      target_date = excluded.target_date,
      type = excluded.type,
      icon = excluded.icon,
      updated_at = excluded.updated_at
  `);

  const transaction = db.transaction((items: RelationshipCounter[]) => {
    for (const c of items) {
      stmt.run(c.id, roomId, c.title, c.targetDate, c.type, c.icon || null, now);
    }
  });

  transaction(counters);
}

// Push Notifications
export function upsertRoomPushToken(
  roomId: string,
  deviceId: string,
  pushToken: string,
  platform?: string,
  role?: string,
  displayName?: string,
  timezone?: string
) {
  const now = Date.now();
  const id = crypto.randomUUID();

  // Clean up any stale records with the same token to prevent duplicate sends across devices
  db.prepare('DELETE FROM room_push_tokens WHERE push_token = ?').run(pushToken);

  const stmt = db.prepare(`
    INSERT INTO room_push_tokens (id, room_id, device_id, push_token, platform, role, display_name, timezone, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(room_id, device_id) DO UPDATE SET
      push_token = excluded.push_token,
      platform = excluded.platform,
      role = COALESCE(excluded.role, room_push_tokens.role),
      display_name = COALESCE(excluded.display_name, room_push_tokens.display_name),
      timezone = COALESCE(excluded.timezone, room_push_tokens.timezone),
      updated_at = excluded.updated_at
  `);
  stmt.run(
    id, roomId, deviceId, pushToken, platform || null,
    role || null, displayName || null, timezone || null, now
  );
}

export interface PushTarget {
  deviceId: string;
  pushToken: string;
  role: string | null;
  displayName: string | null;
  timezone: string | null;
}

/** Everyone registered in a room, with who each device belongs to. */
export function getRoomPushTargets(roomId: string): PushTarget[] {
  const rows = db
    .prepare(
      `SELECT device_id as deviceId, push_token as pushToken, role,
              display_name as displayName, timezone
       FROM room_push_tokens WHERE room_id = ?`
    )
    .all(roomId) as PushTarget[];
  return rows.filter(r => Boolean(r.pushToken));
}

/** Rooms that have at least one registered device, with that room's timezone. */
export function getRoomsWithPushTargets(): Array<{ roomId: string; timezone: string | null }> {
  const rows = db
    .prepare(
      `SELECT room_id as roomId, MAX(timezone) as timezone
       FROM room_push_tokens
       GROUP BY room_id`
    )
    .all() as Array<{ roomId: string; timezone: string | null }>;
  return rows;
}

/**
 * Timed plans in one room whose start time falls in the given minute.
 *
 * The date and time are the room's own wall clock, not the server's — plans
 * are stored as local times, so evaluating them against the server's clock
 * fired them off by the UTC offset.
 */
export function getRoomTimedEventsBetween(
  roomId: string,
  fromDate: string,
  toDate: string
): Array<CalendarEvent & { roomId: string }> {
  const rows = db
    .prepare(
      `SELECT id, room_id as roomId, title, start_date as startDate, end_date as endDate,
              start_time as startTime, end_time as endTime, is_all_day as isAllDay,
              color, target, completed, timezone, author
       FROM room_events
       WHERE room_id = ? AND start_date BETWEEN ? AND ?
         AND is_all_day = 0 AND start_time IS NOT NULL
         AND COALESCE(completed, 0) = 0`
    )
    .all(roomId, fromDate, toDate) as any[];

  return rows.map(r => ({ ...r, isAllDay: Boolean(r.isAllDay), completed: Boolean(r.completed) }));
}

/** Guards against sending the same start reminder twice. */
export function markReminderSent(key: string): boolean {
  try {
    db.prepare('INSERT INTO sent_event_reminders (id, sent_at) VALUES (?, ?)').run(key, Date.now());
    return true;
  } catch {
    return false; // already recorded
  }
}

/** Drops reminder bookkeeping older than two days. */
export function pruneReminderLog() {
  db.prepare('DELETE FROM sent_event_reminders WHERE sent_at < ?').run(Date.now() - 2 * 86_400_000);
}

export function getRoomPushTokens(roomId: string, excludeDeviceId?: string, excludePushToken?: string): string[] {
  let query = 'SELECT DISTINCT push_token FROM room_push_tokens WHERE room_id = ?';
  const params: any[] = [roomId];

  if (excludeDeviceId) {
    query += ' AND device_id != ?';
    params.push(excludeDeviceId);
  }

  if (excludePushToken) {
    query += ' AND push_token != ?';
    params.push(excludePushToken);
  }

  const rows = db.prepare(query).all(...params) as Array<{ push_token: string }>;
  return Array.from(new Set(rows.map(r => r.push_token).filter(Boolean)));
}

export function getAllPushTokens(): string[] {
  const rows = db.prepare('SELECT DISTINCT push_token FROM room_push_tokens').all() as Array<{ push_token: string }>;
  return Array.from(new Set(rows.map(r => r.push_token).filter(Boolean)));
}
