import { db } from './client';
import { notes } from './schema';
import { eq, asc } from 'drizzle-orm';

export interface NoteItem {
  /** Local row id. Not stable across devices — use `noteId` for sync. */
  id?: number;
  /** Stable cross-device identity. */
  noteId: string;
  date: string;
  content: string;
  createdAt?: number;
  updatedAt?: number;
}

export const generateNoteId = (): string =>
  `n_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;

type NoteRow = {
  id: number;
  noteId: string;
  date: string;
  content: string;
  createdAt: number | null;
  updatedAt: number | null;
};

const toNoteItem = (n: NoteRow): NoteItem => ({
  id: n.id,
  noteId: n.noteId,
  date: n.date,
  content: n.content,
  createdAt: n.createdAt ?? undefined,
  updatedAt: n.updatedAt ?? undefined,
});

export const getAllNotes = async (): Promise<NoteItem[]> => {
  try {
    const rows = await db.select().from(notes).orderBy(asc(notes.date), asc(notes.id));
    return rows.map(toNoteItem);
  } catch (e) {
    console.error('Error fetching all notes:', e);
    return [];
  }
};

/** Every note recorded for a day, oldest first. */
export const getNotesForDate = async (date: string): Promise<NoteItem[]> => {
  try {
    const rows = await db.select().from(notes).where(eq(notes.date, date)).orderBy(asc(notes.id));
    return rows.map(toNoteItem);
  } catch (e) {
    console.error(`Error getting notes for date ${date}:`, e);
    return [];
  }
};

export const getNoteById = async (noteId: string): Promise<NoteItem | null> => {
  try {
    const rows = await db.select().from(notes).where(eq(notes.noteId, noteId));
    return rows.length > 0 ? toNoteItem(rows[0]) : null;
  } catch (e) {
    console.error(`Error getting note ${noteId}:`, e);
    return null;
  }
};

/** Appends a new note to a day. Returns the stored note, or null if blank. */
export const addNote = async (date: string, content: string): Promise<NoteItem | null> => {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const now = Date.now();
  const item: NoteItem = {
    noteId: generateNoteId(),
    date,
    content: trimmed,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await db.insert(notes).values(item);
    return item;
  } catch (e) {
    console.error(`Error adding note for date ${date}:`, e);
    return null;
  }
};

/**
 * Inserts or updates a note by its stable `noteId`. Blank content deletes it,
 * which keeps the wire protocol's "empty means removed" convention working.
 */
export const upsertNote = async (note: NoteItem): Promise<void> => {
  try {
    const trimmed = note.content?.trim() ?? '';
    const existing = await db.select().from(notes).where(eq(notes.noteId, note.noteId));

    if (!trimmed) {
      if (existing.length > 0) {
        await db.delete(notes).where(eq(notes.noteId, note.noteId));
      }
      return;
    }

    const now = Date.now();
    if (existing.length > 0) {
      await db.update(notes)
        .set({ date: note.date, content: trimmed, updatedAt: note.updatedAt ?? now })
        .where(eq(notes.noteId, note.noteId));
    } else {
      await db.insert(notes).values({
        noteId: note.noteId,
        date: note.date,
        content: trimmed,
        createdAt: note.createdAt ?? now,
        updatedAt: note.updatedAt ?? now,
      });
    }
  } catch (e) {
    console.error(`Error upserting note ${note.noteId}:`, e);
  }
};

export const deleteNote = async (noteId: string): Promise<void> => {
  try {
    await db.delete(notes).where(eq(notes.noteId, noteId));
  } catch (e) {
    console.error(`Error deleting note ${noteId}:`, e);
  }
};

/** Replaces the whole local note set — used when a full sync payload arrives. */
export const bulkSetNotes = async (list: Array<Partial<NoteItem>>): Promise<void> => {
  try {
    await db.delete(notes);
    const now = Date.now();
    for (const n of list) {
      const trimmed = n.content?.trim();
      if (!n.date || !trimmed) continue;
      await db.insert(notes).values({
        // Older servers send date-keyed notes with no id; mint one locally.
        noteId: n.noteId || generateNoteId(),
        date: n.date,
        content: trimmed,
        createdAt: n.createdAt ?? now,
        updatedAt: n.updatedAt ?? now,
      });
    }
  } catch (e) {
    console.error('Error in bulkSetNotes:', e);
  }
};

// ---------------------------------------------------------------------------
// Legacy single-note-per-day helpers, kept so older callers keep working.
// ---------------------------------------------------------------------------

/** Content of a day's first note, or null. */
export const getNoteByDate = async (date: string): Promise<string | null> => {
  const list = await getNotesForDate(date);
  return list.length > 0 ? list[0].content : null;
};

/** Replaces a day's notes with a single note (blank clears the day). */
export const setNoteByDate = async (date: string, content: string): Promise<void> => {
  try {
    const trimmed = content.trim();
    const existing = await getNotesForDate(date);

    if (!trimmed) {
      await db.delete(notes).where(eq(notes.date, date));
      return;
    }

    if (existing.length > 0) {
      const now = Date.now();
      await db.update(notes)
        .set({ content: trimmed, updatedAt: now })
        .where(eq(notes.noteId, existing[0].noteId));
      for (const extra of existing.slice(1)) {
        await db.delete(notes).where(eq(notes.noteId, extra.noteId));
      }
    } else {
      await addNote(date, trimmed);
    }
  } catch (e) {
    console.error(`Error setting note for date ${date}:`, e);
  }
};

export const deleteNoteByDate = async (date: string): Promise<void> => {
  try {
    await db.delete(notes).where(eq(notes.date, date));
  } catch (e) {
    console.error(`Error deleting notes for date ${date}:`, e);
  }
};
