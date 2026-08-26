import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";

const DATABASE_NAME = "microphone_check.db";

export const expoDb = openDatabaseSync(DATABASE_NAME);
export const db = drizzle(expoDb);

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
      date TEXT UNIQUE NOT NULL,
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
};
