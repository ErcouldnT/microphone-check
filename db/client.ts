import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";

const DATABASE_NAME = "microphone_check.db";

export const expoDb = openDatabaseSync(DATABASE_NAME);
export const db = drizzle(expoDb);

/** Column names currently present on a table (empty if the table does not exist). */
const getTableColumns = async (table: string): Promise<string[]> => {
    try {
        const rows = await expoDb.getAllAsync<{ name: string }>(`PRAGMA table_info(${table});`);
        return rows.map(r => r.name);
    } catch {
        return [];
    }
};

/**
 * v3.1 — a day may now hold more than one note.
 *
 * The legacy `notes` table declared `date TEXT UNIQUE`, which SQLite cannot drop
 * with ALTER TABLE, so the table is rebuilt and the existing rows are carried
 * over. Each migrated row gets a generated `note_id` so it keeps a stable
 * identity for sync.
 */
const migrateNotesToMultiPerDay = async () => {
    const columns = await getTableColumns('notes');
    if (columns.length === 0 || columns.includes('note_id')) return;

    await expoDb.execAsync(`
    PRAGMA foreign_keys=off;
    BEGIN TRANSACTION;
    ALTER TABLE notes RENAME TO notes_legacy_v3;
    CREATE TABLE notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id TEXT NOT NULL UNIQUE,
      date TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER,
      updated_at INTEGER
    );
    INSERT INTO notes (note_id, date, content, created_at, updated_at)
      SELECT lower(hex(randomblob(8))), date, content, created_at, updated_at
      FROM notes_legacy_v3
      WHERE content IS NOT NULL AND trim(content) != '';
    DROP TABLE notes_legacy_v3;
    COMMIT;
    PRAGMA foreign_keys=on;
  `);
};

/** v3.1 — events can be marked completed / not completed. */
const migrateEventsCompleted = async () => {
    const columns = await getTableColumns('events');
    if (columns.length === 0 || columns.includes('completed')) return;

    await expoDb.execAsync(
        `ALTER TABLE events ADD COLUMN completed INTEGER NOT NULL DEFAULT 0;`
    );
};

export const initDb = async () => {
    // Manual migrations
    await expoDb.execAsync(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      count INTEGER DEFAULT 0 NOT NULL,
      created_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id TEXT NOT NULL UNIQUE,
      date TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER,
      updated_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
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
      author TEXT,
      created_at INTEGER,
      updated_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS counters (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      target_date TEXT NOT NULL,
      type TEXT NOT NULL,
      icon TEXT,
      created_at INTEGER,
      updated_at INTEGER
    );
  `);

    // Schema upgrades for databases created by earlier versions
    await migrateNotesToMultiPerDay();
    await migrateEventsCompleted();

    await expoDb.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_notes_date ON notes(date);
    CREATE INDEX IF NOT EXISTS idx_events_dates ON events(start_date, end_date);
  `);
};
