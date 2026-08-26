import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable("sessions", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(), // ISO Date String YYYY-MM-DD
    count: integer("count").default(0).notNull(),
    createdAt: integer("created_at").$defaultFn(() => Date.now()),
});

export const settings = sqliteTable("settings", {
    key: text("key").primaryKey(),
    value: text("value").notNull(),
});

export const notes = sqliteTable("notes", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull().unique(), // ISO Date String YYYY-MM-DD
    content: text("content").notNull(),
    createdAt: integer("created_at").$defaultFn(() => Date.now()),
    updatedAt: integer("updated_at").$defaultFn(() => Date.now()),
});

