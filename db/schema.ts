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

// A day can hold any number of notes. `noteId` is the stable identity used for
// cross-device sync; the autoincrement `id` stays local to this device.
export const notes = sqliteTable("notes", {
    id: integer("id").primaryKey({ autoIncrement: true }),
    noteId: text("note_id").notNull().unique(),
    date: text("date").notNull(), // ISO Date String YYYY-MM-DD
    content: text("content").notNull(),
    createdAt: integer("created_at").$defaultFn(() => Date.now()),
    updatedAt: integer("updated_at").$defaultFn(() => Date.now()),
});

export const events = sqliteTable("events", {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    startDate: text("start_date").notNull(), // YYYY-MM-DD
    endDate: text("end_date").notNull(),     // YYYY-MM-DD
    startTime: text("start_time"),           // HH:mm (optional)
    endTime: text("end_time"),               // HH:mm (optional)
    isAllDay: integer("is_all_day").default(1).notNull(),
    color: text("color").notNull(),          // Hex code e.g. #00FFFF, #FF007F, #FACC15
    target: text("target").notNull(),        // 'you', 'partner', 'both'
    completed: integer("completed").default(0).notNull(), // 0 = pending, 1 = done
    author: text("author"),
    createdAt: integer("created_at").$defaultFn(() => Date.now()),
    updatedAt: integer("updated_at").$defaultFn(() => Date.now()),
});

export const counters = sqliteTable("counters", {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    targetDate: text("target_date").notNull(), // YYYY-MM-DD
    type: text("type").notNull(),              // 'since' (e.g. first meet) or 'until' (e.g. next meet)
    icon: text("icon"),                        // emoji or icon name
    createdAt: integer("created_at").$defaultFn(() => Date.now()),
    updatedAt: integer("updated_at").$defaultFn(() => Date.now()),
});
