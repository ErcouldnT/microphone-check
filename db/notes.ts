import { db } from './client';
import { notes } from './schema';
import { eq } from 'drizzle-orm';

export interface NoteItem {
  id?: number;
  date: string;
  content: string;
  createdAt?: number;
  updatedAt?: number;
}

export const getAllNotes = async (): Promise<NoteItem[]> => {
  try {
    const allNotes = await db.select().from(notes);
    return allNotes.map((n: { id: number; date: string; content: string; createdAt: number | null; updatedAt: number | null }) => ({
      id: n.id,
      date: n.date,
      content: n.content,
      createdAt: n.createdAt ?? undefined,
      updatedAt: n.updatedAt ?? undefined,
    }));
  } catch (e) {
    console.error('Error fetching all notes:', e);
    return [];
  }
};

export const getNoteByDate = async (date: string): Promise<string | null> => {
  try {
    const result = await db.select().from(notes).where(eq(notes.date, date));
    if (result.length > 0) {
      return result[0].content;
    }
    return null;
  } catch (e) {
    console.error(`Error getting note for date ${date}:`, e);
    return null;
  }
};

export const setNoteByDate = async (date: string, content: string): Promise<void> => {
  try {
    const trimmed = content.trim();
    const existing = await db.select().from(notes).where(eq(notes.date, date));

    if (!trimmed) {
      // Empty content -> Delete note
      if (existing.length > 0) {
        await db.delete(notes).where(eq(notes.date, date));
      }
      return;
    }

    const now = Date.now();
    if (existing.length > 0) {
      await db.update(notes)
        .set({ content: trimmed, updatedAt: now })
        .where(eq(notes.date, date));
    } else {
      await db.insert(notes).values({
        date,
        content: trimmed,
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch (e) {
    console.error(`Error setting note for date ${date}:`, e);
  }
};

export const deleteNoteByDate = async (date: string): Promise<void> => {
  try {
    await db.delete(notes).where(eq(notes.date, date));
  } catch (e) {
    console.error(`Error deleting note for date ${date}:`, e);
  }
};
