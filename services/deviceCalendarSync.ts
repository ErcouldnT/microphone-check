import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

import { CalendarEvent } from '@/db/events';
import { getSetting, setSetting } from '@/db/settings';
import { parseLocalDate } from '@/utils/date';

const CALENDAR_ID_KEY = 'device_calendar_id';
const SYNC_ENABLED_KEY = 'device_calendar_sync_enabled';
const CALENDAR_TITLE = 'Microphone Check';

export interface DeviceCalendar {
  id: string;
  title: string;
  source: string;
}

export const isDeviceSyncEnabled = async (): Promise<boolean> =>
  (await getSetting(SYNC_ENABLED_KEY)) === '1';

export const setDeviceSyncEnabled = async (enabled: boolean): Promise<void> => {
  await setSetting(SYNC_ENABLED_KEY, enabled ? '1' : '0');
};

export const getSelectedCalendarId = async (): Promise<string | null> =>
  getSetting(CALENDAR_ID_KEY);

export const setSelectedCalendarId = async (id: string): Promise<void> => {
  await setSetting(CALENDAR_ID_KEY, id);
};

/** Asks for calendar access. Returns false when the user declines. */
export const requestCalendarAccess = async (): Promise<boolean> => {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
};

/**
 * Writable calendars on the device.
 *
 * A Google account added to the phone shows up here as its own calendar, so
 * writing to it is what makes plans appear in Google Calendar — no separate
 * OAuth flow is involved.
 */
export const listWritableCalendars = async (): Promise<DeviceCalendar[]> => {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  return calendars
    .filter(c => c.allowsModifications)
    .map(c => ({
      id: c.id,
      title: c.title,
      source: typeof c.source === 'string' ? c.source : (c.source?.name ?? ''),
    }));
};

/** Creates a calendar owned by this app, used when the user picks no target. */
const createAppCalendar = async (): Promise<string> => {
  const defaultSource =
    Platform.OS === 'ios'
      ? await Calendar.getDefaultCalendarAsync().then(c => c.source)
      : { isLocalAccount: true, name: CALENDAR_TITLE, type: Calendar.SourceType.LOCAL };

  return Calendar.createCalendarAsync({
    title: CALENDAR_TITLE,
    color: '#00FFFF',
    entityType: Calendar.EntityTypes.EVENT,
    sourceId: Platform.OS === 'ios' ? (defaultSource as Calendar.Source).id : undefined,
    source: defaultSource as Calendar.Source,
    name: CALENDAR_TITLE,
    ownerAccount: 'personal',
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });
};

/** The calendar plans are written to, creating one the first time if needed. */
export const resolveTargetCalendarId = async (): Promise<string> => {
  const saved = await getSelectedCalendarId();
  if (saved) {
    const calendars = await listWritableCalendars();
    if (calendars.some(c => c.id === saved)) return saved;
  }

  const created = await createAppCalendar();
  await setSelectedCalendarId(created);
  return created;
};

/** Start and end instants for a plan, as the device calendar expects them. */
const toInstants = (event: CalendarEvent): { start: Date; end: Date } => {
  const start = parseLocalDate(event.startDate);
  const end = parseLocalDate(event.endDate);

  if (event.isAllDay) {
    start.setHours(0, 0, 0, 0);
    // All-day ranges are exclusive of the end day on both platforms.
    end.setDate(end.getDate() + 1);
    end.setHours(0, 0, 0, 0);
    return { start, end };
  }

  const [sh, sm] = (event.startTime ?? '00:00').split(':').map(Number);
  const [eh, em] = (event.endTime ?? event.startTime ?? '23:59').split(':').map(Number);
  start.setHours(Number.isFinite(sh) ? sh : 0, Number.isFinite(sm) ? sm : 0, 0, 0);
  end.setHours(Number.isFinite(eh) ? eh : 23, Number.isFinite(em) ? em : 59, 0, 0);

  if (end.getTime() <= start.getTime()) {
    end.setTime(start.getTime() + 60 * 60 * 1000);
  }
  return { start, end };
};

/**
 * Pushes plans into the phone's calendar.
 *
 * Existing entries this app wrote are cleared first so the target calendar
 * mirrors the app rather than accumulating duplicates.
 */
export const syncEventsToDeviceCalendar = async (
  events: CalendarEvent[]
): Promise<{ synced: number }> => {
  const calendarId = await resolveTargetCalendarId();

  // Clear the window we are about to rewrite.
  const from = new Date();
  from.setMonth(from.getMonth() - 6);
  const to = new Date();
  to.setMonth(to.getMonth() + 18);

  const existing = await Calendar.getEventsAsync([calendarId], from, to);
  await Promise.all(
    existing.map(e =>
      Calendar.deleteEventAsync(e.id).catch(() => {
        /* already gone */
      })
    )
  );

  let synced = 0;
  for (const event of events) {
    const { start, end } = toInstants(event);
    if (end < from || start > to) continue;

    try {
      await Calendar.createEventAsync(calendarId, {
        title: event.completed ? `✓ ${event.title}` : event.title,
        notes: event.description,
        startDate: start,
        endDate: end,
        allDay: event.isAllDay,
      });
      synced += 1;
    } catch (e: any) {
      console.warn('Could not write event to device calendar:', e?.message);
    }
  }

  return { synced };
};
