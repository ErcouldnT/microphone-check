import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';

import i18n from '@/i18n';
import { CalendarEvent } from '@/db/events';
import { UserRole, getMyRole } from '@/db/settings';
import { parseLocalDate } from '@/utils/date';

/** Marks the notifications this module owns, so it only cancels its own. */
export const EVENT_REMINDER_KIND = 'event-start';

/** All-day plans have no clock time; remind about them in the morning. */
const ALL_DAY_REMINDER_HOUR = 9;

/**
 * iOS allows at most 64 pending local notifications. Stay well under that so
 * other features (and the OS itself) keep room.
 */
const MAX_SCHEDULED_REMINDERS = 48;

/** Moment an event begins, or null when it is already in the past. */
const getEventStart = (event: CalendarEvent): Date | null => {
  if (!event.startDate) return null;

  const start = parseLocalDate(event.startDate);
  if (Number.isNaN(start.getTime())) return null;

  if (!event.isAllDay && event.startTime) {
    const [hours, minutes] = event.startTime.split(':').map(Number);
    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
      start.setHours(hours, minutes, 0, 0);
      return start;
    }
  }

  start.setHours(ALL_DAY_REMINDER_HOUR, 0, 0, 0);
  return start;
};

/** When the plan runs, for the notification body. */
const describeWindow = (event: CalendarEvent): string => {
  if (event.isAllDay || !event.startTime) return String(i18n.t('allDay'));
  return event.endTime ? `${event.startTime}–${event.endTime}` : event.startTime;
};

const getReminderBody = (event: CalendarEvent): string =>
  String(
    i18n.t(event.target === 'both' ? 'bothDoingNow' : 'youDoingNow', {
      title: event.title,
      time: describeWindow(event),
    })
  );

/**
 * Whether this device should raise a local reminder for the plan.
 *
 * Only the person a plan belongs to (or both of them, for a shared plan) is
 * reminded locally. Telling the other person that their partner just started
 * something is the server's job, which keeps the two from doubling up.
 */
const isMine = (event: CalendarEvent, myRole: UserRole): boolean => {
  if (event.target === 'both') return true;
  return event.target === myRole || event.target === 'you';
};

/** Cancels every reminder previously scheduled by this module. */
export const cancelEventReminders = async (): Promise<void> => {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter(n => (n.content?.data as any)?.kind === EVENT_REMINDER_KIND)
        .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier))
    );
  } catch (e: any) {
    console.warn('Could not cancel event reminders:', e?.message);
  }
};

/**
 * Rebuilds the whole set of "starting now" reminders from the current events.
 *
 * Called whenever events change (local edit or a sync push), so the schedule
 * always matches what is actually in the calendar. Completed and past events
 * are skipped.
 */
export const rescheduleEventReminders = async (
  events: CalendarEvent[],
  myRole?: UserRole
): Promise<number> => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return 0;

    await cancelEventReminders();

    const role = myRole ?? (await getMyRole());
    const now = Date.now();

    const upcoming = events
      .filter(e => !e.completed && isMine(e, role))
      .map(e => ({ event: e, start: getEventStart(e) }))
      .filter((x): x is { event: CalendarEvent; start: Date } => x.start !== null)
      .filter(x => x.start.getTime() > now)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, MAX_SCHEDULED_REMINDERS);

    for (const { event, start } of upcoming) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: String(i18n.t('happeningNow')),
          body: getReminderBody(event),
          sound: 'default',
          data: {
            kind: EVENT_REMINDER_KIND,
            eventId: event.id,
            date: event.startDate,
          },
        },
        trigger: {
          type: SchedulableTriggerInputTypes.DATE,
          date: start,
        },
      });
    }

    return upcoming.length;
  } catch (e: any) {
    console.warn('Could not reschedule event reminders:', e?.message);
    return 0;
  }
};
