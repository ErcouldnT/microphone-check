import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { sessions } from '@/db/schema';
import {
  CalendarEvent,
  deleteEvent,
  getAllEvents,
  saveEvent,
  setEventCompleted,
} from '@/db/events';
import {
  NoteItem,
  addNote,
  deleteNote,
  getAllNotes,
  upsertNote,
} from '@/db/notes';
import {
  RelationshipCounter,
  deleteCounter,
  getAllCounters,
  saveCounter,
} from '@/db/counters';
import {
  UserRole,
  getMyName,
  getMyRole,
  getPartnerName,
} from '@/db/settings';
import { ConnectionStatus, syncService } from '@/services/syncService';
import { rescheduleEventReminders } from '@/services/eventReminders';
import { publishTodayPlanToWidgets } from '@/services/widgetSync';

/** A request to bring a particular day into view, e.g. from a notification. */
export interface FocusRequest {
  date: string;
  /** Distinguishes repeat requests for the same day. */
  nonce: number;
}

export interface CalendarData {
  // Data
  events: CalendarEvent[];
  notesByDate: Record<string, NoteItem[]>;
  counters: RelationshipCounter[];
  sessionMap: Record<string, number>;

  // Profile
  myRole: UserRole;
  myName: string;
  partnerName: string;

  // Sync
  syncStatus: ConnectionStatus;
  roomCode: string | null;

  /** Set when something asks the calendar to jump to a day. */
  focusRequest: FocusRequest | null;
  requestFocusDate: (date: string) => void;

  // Actions
  reload: () => Promise<void>;
  saveCalendarEvent: (
    event: Omit<CalendarEvent, 'id' | 'author' | 'updatedAt'> & { id?: string }
  ) => Promise<void>;
  removeCalendarEvent: (id: string) => Promise<void>;
  toggleEventCompleted: (event: CalendarEvent) => Promise<void>;
  saveNote: (date: string, content: string, noteId?: string) => Promise<void>;
  removeNote: (noteId: string) => Promise<void>;
  saveRelationshipCounter: (
    counter: Omit<RelationshipCounter, 'id' | 'updatedAt'> & { id?: string }
  ) => Promise<void>;
  removeRelationshipCounter: (id: string) => Promise<void>;
  updateSessionCount: (date: string, delta: number) => Promise<void>;
}

const CalendarDataContext = createContext<CalendarData | null>(null);

export const useCalendarData = (): CalendarData => {
  const ctx = useContext(CalendarDataContext);
  if (!ctx) throw new Error('useCalendarData must be used inside CalendarDataProvider');
  return ctx;
};

const newId = () => Math.random().toString(36).substring(2, 11);

/**
 * Owns the calendar's data and every mutation on it.
 *
 * The today, calendar and settings tabs all read the same state from here, so
 * a change made on one is visible on the others without any of them reloading
 * independently.
 */
export function CalendarDataProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [notesByDate, setNotesByDate] = useState<Record<string, NoteItem[]>>({});
  const [counters, setCounters] = useState<RelationshipCounter[]>([]);
  const [sessionMap, setSessionMap] = useState<Record<string, number>>({});

  const [myRole, setMyRole] = useState<UserRole>('male');
  const [myName, setMyName] = useState('');
  const [partnerName, setPartnerName] = useState('');

  const [syncStatus, setSyncStatus] = useState<ConnectionStatus>('local');
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);

  const requestFocusDate = useCallback((date: string) => {
    if (!date) return;
    setFocusRequest({ date, nonce: Date.now() });
  }, []);

  const reload = useCallback(async () => {
    try {
      const [role, name, partner] = await Promise.all([
        getMyRole(),
        getMyName(),
        getPartnerName(),
      ]);
      setMyRole(role);
      setMyName(name);
      setPartnerName(partner);

      const allSessions = await db.select().from(sessions);
      const sMap: Record<string, number> = {};
      allSessions.forEach(s => {
        sMap[s.date] = (sMap[s.date] || 0) + s.count;
      });
      setSessionMap(sMap);

      const allNotes = await getAllNotes();
      const nMap: Record<string, NoteItem[]> = {};
      allNotes.forEach(n => {
        if (!n.content?.trim()) return;
        (nMap[n.date] ||= []).push(n);
      });
      setNotesByDate(nMap);

      const allEvents = await getAllEvents();
      setEvents(allEvents);

      setCounters(await getAllCounters());

      // Keep the reminder schedule and the home screen widgets in step.
      rescheduleEventReminders(allEvents, role);
      publishTodayPlanToWidgets(allEvents, role);
    } catch (e) {
      console.error('Error loading calendar data:', e);
    }
  }, []);

  useEffect(() => {
    reload();
    setSyncStatus(syncService.getStatus());
    setRoomCode(syncService.getRoomCode());

    const unsubs = [
      syncService.addSessionListener(() => reload()),
      syncService.addNoteListener(() => reload()),
      syncService.addEventListener(() => reload()),
      syncService.addCounterListener(() => reload()),
      syncService.addSyncListener(() => {
        reload();
        setRoomCode(syncService.getRoomCode());
      }),
      syncService.addStatusListener(status => {
        setSyncStatus(status);
        setRoomCode(syncService.getRoomCode());
      }),
    ];

    return () => unsubs.forEach(unsub => unsub());
  }, [reload]);

  const saveCalendarEvent: CalendarData['saveCalendarEvent'] = useCallback(
    async eventData => {
      const full: CalendarEvent = {
        id: eventData.id || newId(),
        title: eventData.title,
        description: eventData.description,
        startDate: eventData.startDate,
        endDate: eventData.endDate,
        isAllDay: eventData.isAllDay,
        startTime: eventData.startTime,
        endTime: eventData.endTime,
        color: eventData.color,
        target: eventData.target,
        completed: eventData.completed ?? false,
        author: syncService.getDeviceId(),
        updatedAt: Date.now(),
      };
      await saveEvent(full);
      syncService.sendEventUpdate(full);
      await reload();
    },
    [reload]
  );

  const removeCalendarEvent = useCallback(
    async (id: string) => {
      await deleteEvent(id);
      syncService.sendEventDelete(id);
      await reload();
    },
    [reload]
  );

  const toggleEventCompleted = useCallback(
    async (event: CalendarEvent) => {
      const updated = await setEventCompleted(event.id, !event.completed);
      if (!updated) return;
      syncService.sendEventUpdate(updated);
      await reload();
    },
    [reload]
  );

  const saveNote = useCallback(
    async (date: string, content: string, noteId?: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      if (noteId) {
        const updated: NoteItem = { noteId, date, content: trimmed, updatedAt: Date.now() };
        await upsertNote(updated);
        syncService.sendNoteUpdate(updated);
      } else {
        const created = await addNote(date, trimmed);
        if (created) syncService.sendNoteUpdate(created);
      }
      await reload();
    },
    [reload]
  );

  const removeNote = useCallback(
    async (noteId: string) => {
      const note = Object.values(notesByDate)
        .flat()
        .find(n => n.noteId === noteId);
      await deleteNote(noteId);
      syncService.sendNoteDelete(noteId, note?.date ?? '');
      await reload();
    },
    [notesByDate, reload]
  );

  const saveRelationshipCounter: CalendarData['saveRelationshipCounter'] = useCallback(
    async counterData => {
      const full: RelationshipCounter = {
        id: counterData.id || newId(),
        title: counterData.title,
        targetDate: counterData.targetDate,
        type: counterData.type,
        icon: counterData.icon,
        updatedAt: Date.now(),
      };
      await saveCounter(full);
      syncService.sendCounterUpdate(full);
      await reload();
    },
    [reload]
  );

  const removeRelationshipCounter = useCallback(
    async (id: string) => {
      await deleteCounter(id);
      syncService.sendCounterDelete(id);
      await reload();
    },
    [reload]
  );

  const updateSessionCount = useCallback(
    async (date: string, delta: number) => {
      try {
        const existing = await db.select().from(sessions).where(eq(sessions.date, date));
        let next = 0;

        if (existing.length > 0) {
          next = existing.reduce((acc, cur) => acc + cur.count, 0) + delta;
          if (next <= 0) {
            next = 0;
            await db.delete(sessions).where(eq(sessions.date, date));
          } else {
            await db.update(sessions).set({ count: next }).where(eq(sessions.id, existing[0].id));
            for (const extra of existing.slice(1)) {
              await db.delete(sessions).where(eq(sessions.id, extra.id));
            }
          }
        } else if (delta > 0) {
          next = delta;
          await db.insert(sessions).values({ date, count: delta });
        }

        syncService.sendSessionUpdate(date, next);
        await reload();
      } catch (e) {
        console.error('Error updating session count:', e);
      }
    },
    [reload]
  );

  const value = useMemo<CalendarData>(
    () => ({
      events,
      notesByDate,
      counters,
      sessionMap,
      myRole,
      myName,
      partnerName,
      syncStatus,
      roomCode,
      focusRequest,
      requestFocusDate,
      reload,
      saveCalendarEvent,
      removeCalendarEvent,
      toggleEventCompleted,
      saveNote,
      removeNote,
      saveRelationshipCounter,
      removeRelationshipCounter,
      updateSessionCount,
    }),
    [
      events,
      notesByDate,
      counters,
      sessionMap,
      myRole,
      myName,
      partnerName,
      syncStatus,
      roomCode,
      focusRequest,
      requestFocusDate,
      reload,
      saveCalendarEvent,
      removeCalendarEvent,
      toggleEventCompleted,
      saveNote,
      removeNote,
      saveRelationshipCounter,
      removeRelationshipCounter,
      updateSessionCount,
    ]
  );

  return <CalendarDataContext.Provider value={value}>{children}</CalendarDataContext.Provider>;
}
