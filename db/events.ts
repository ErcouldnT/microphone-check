import { db } from './client';
import { events } from './schema';
import { eq, and, lte, gte } from 'drizzle-orm';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string;   // HH:mm
  isAllDay: boolean;
  color: string;     // e.g. #00FFFF, #FF007F, #FACC15, #10B981, #A855F7
  target: 'male' | 'female' | 'both' | 'you' | 'partner';
  /** Whether the plan has been carried out. Defaults to false. */
  completed?: boolean;
  author?: string;
  createdAt?: number;
  updatedAt?: number;
}

export const getAllEvents = async (): Promise<CalendarEvent[]> => {
  try {
    const list = await db.select().from(events);
    return list.map(e => ({
      id: e.id,
      title: e.title,
      description: e.description ?? undefined,
      startDate: e.startDate,
      endDate: e.endDate,
      startTime: e.startTime ?? undefined,
      endTime: e.endTime ?? undefined,
      isAllDay: Boolean(e.isAllDay),
      color: e.color,
      target: e.target as 'you' | 'partner' | 'both',
      completed: Boolean(e.completed),
      author: e.author ?? undefined,
      createdAt: e.createdAt ?? undefined,
      updatedAt: e.updatedAt ?? undefined,
    }));
  } catch (err) {
    console.error('Error getting all events:', err);
    return [];
  }
};

export const getEventsForDate = async (dateStr: string): Promise<CalendarEvent[]> => {
  try {
    const all = await getAllEvents();
    return all.filter(e => e.startDate <= dateStr && e.endDate >= dateStr);
  } catch (err) {
    console.error(`Error getting events for date ${dateStr}:`, err);
    return [];
  }
};

export const saveEvent = async (event: CalendarEvent): Promise<void> => {
  try {
    const now = Date.now();
    const existing = await db.select().from(events).where(eq(events.id, event.id));
    if (existing.length > 0) {
      await db.update(events).set({
        title: event.title,
        description: event.description ?? null,
        startDate: event.startDate,
        endDate: event.endDate,
        startTime: event.startTime ?? null,
        endTime: event.endTime ?? null,
        isAllDay: event.isAllDay ? 1 : 0,
        color: event.color,
        target: event.target,
        completed: event.completed ? 1 : 0,
        author: event.author ?? null,
        updatedAt: now,
      }).where(eq(events.id, event.id));
    } else {
      await db.insert(events).values({
        id: event.id,
        title: event.title,
        description: event.description ?? null,
        startDate: event.startDate,
        endDate: event.endDate,
        startTime: event.startTime ?? null,
        endTime: event.endTime ?? null,
        isAllDay: event.isAllDay ? 1 : 0,
        color: event.color,
        target: event.target,
        completed: event.completed ? 1 : 0,
        author: event.author ?? null,
        createdAt: event.createdAt ?? now,
        updatedAt: now,
      });
    }
  } catch (err) {
    console.error('Error saving event:', err);
  }
};

export const deleteEvent = async (id: string): Promise<void> => {
  try {
    await db.delete(events).where(eq(events.id, id));
  } catch (err) {
    console.error(`Error deleting event ${id}:`, err);
  }
};

export const bulkSetEvents = async (list: CalendarEvent[]): Promise<void> => {
  try {
    await db.delete(events);
    for (const e of list) {
      await saveEvent(e);
    }
  } catch (err) {
    console.error('Error in bulkSetEvents:', err);
  }
};

/**
 * Flips an event's completion flag and returns the updated event so the caller
 * can broadcast it, or null when the event no longer exists locally.
 */
export const setEventCompleted = async (
  id: string,
  completed: boolean
): Promise<CalendarEvent | null> => {
  try {
    const rows = await db.select().from(events).where(eq(events.id, id));
    if (rows.length === 0) return null;

    const now = Date.now();
    await db.update(events)
      .set({ completed: completed ? 1 : 0, updatedAt: now })
      .where(eq(events.id, id));

    const e = rows[0];
    return {
      id: e.id,
      title: e.title,
      description: e.description ?? undefined,
      startDate: e.startDate,
      endDate: e.endDate,
      startTime: e.startTime ?? undefined,
      endTime: e.endTime ?? undefined,
      isAllDay: Boolean(e.isAllDay),
      color: e.color,
      target: e.target as 'you' | 'partner' | 'both',
      completed,
      author: e.author ?? undefined,
      createdAt: e.createdAt ?? undefined,
      updatedAt: now,
    };
  } catch (err) {
    console.error(`Error toggling completion for event ${id}:`, err);
    return null;
  }
};
