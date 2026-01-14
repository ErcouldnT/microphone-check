import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";

const DATABASE_NAME = "microphone_check.db";

export const expoDb = openDatabaseSync(DATABASE_NAME);
export const db = drizzle(expoDb);

export const initDb = async () => {
    // Manual migration for simplicity in this MVP
    await expoDb.execAsync(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      count INTEGER DEFAULT 0 NOT NULL,
      created_at INTEGER
    );
  `);
};
