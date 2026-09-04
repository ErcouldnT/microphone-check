import { CalendarEvent } from '@/db/events';

/**
 * Whether a plan is already behind us on the given day.
 *
 * Used by the today-plan surfaces (in-app card and the home screen widgets),
 * which show what is still ahead rather than a full log of the day.
 *
 * A plan counts as finished when it has been marked completed, or when its
 * clock time on that day has passed. All-day plans stay listed all day.
 */
export const isEventFinished = (
  event: CalendarEvent,
  dateStr: string,
  now: Date = new Date()
): boolean => {
  if (event.completed) return true;
  if (event.isAllDay) return false;

  // Multi-day plans are only "past" once their final day is behind us.
  if (event.endDate < dateStr) return true;
  if (event.endDate !== dateStr) return false;

  const reference = event.endTime || event.startTime;
  if (!reference) return false;

  const [hours, minutes] = reference.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return false;

  const endOfEvent = new Date(now);
  endOfEvent.setHours(hours, minutes, 0, 0);
  return now.getTime() > endOfEvent.getTime();
};

/** Chronological order: all-day plans first, then by start time. */
const byStartTime = (a: CalendarEvent, b: CalendarEvent): number => {
  if (a.isAllDay !== b.isAllDay) return a.isAllDay ? -1 : 1;
  return (a.startTime || '').localeCompare(b.startTime || '');
};

/** Every plan covering the date, in display order. */
export const getEventsForDay = (events: CalendarEvent[], dateStr: string): CalendarEvent[] =>
  events.filter(e => e.startDate <= dateStr && e.endDate >= dateStr).sort(byStartTime);

/** Plans still ahead on the date — finished and completed ones removed. */
export const getRemainingEventsForDay = (
  events: CalendarEvent[],
  dateStr: string,
  now: Date = new Date()
): CalendarEvent[] => getEventsForDay(events, dateStr).filter(e => !isEventFinished(e, dateStr, now));

/**
 * Plans from earlier days that were never ticked off.
 *
 * Deliberately not moved forward automatically: rewriting the date would
 * destroy the record of when something was actually planned, makes no sense
 * for a plan tied to an occasion, and in a shared calendar two devices would
 * race each other doing it. The person decides what happens to each one.
 */
export const getMissedEvents = (
  events: CalendarEvent[],
  todayStr: string
): CalendarEvent[] =>
  events
    .filter(e => !e.completed && e.endDate < todayStr)
    .sort((a, b) => b.startDate.localeCompare(a.startDate) || byStartTime(a, b));
