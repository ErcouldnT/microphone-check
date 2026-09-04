import { Platform } from 'react-native';

import i18n from '@/i18n';
import { CalendarEvent } from '@/db/events';
import { UserRole } from '@/db/settings';
import { getLocalDateString, parseLocalDate } from '@/utils/date';
import { getPersonLabels, resolveTarget } from '@/utils/labels';
import { RunningPlan, areLiveActivitiesEnabled, setRunningPlan } from '@/modules/home-widget';

/** Instant a plan's clock time falls on, or null for an all-day plan. */
const instantOn = (dateStr: string, time: string | undefined): number | null => {
  if (!time) return null;
  const [hours, minutes] = time.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  const at = parseLocalDate(dateStr);
  at.setHours(hours, minutes, 0, 0);
  return at.getTime();
};

/**
 * The timed plan happening right now, if any.
 *
 * All-day plans are skipped: a Live Activity is a countdown, and a whole day
 * has nothing meaningful to count down to.
 */
export const findRunningPlan = (
  events: CalendarEvent[],
  now: Date = new Date()
): CalendarEvent | null => {
  const today = getLocalDateString(now);
  const stamp = now.getTime();

  const running = events.filter(event => {
    if (event.completed || event.isAllDay) return false;
    if (event.startDate > today || event.endDate < today) return false;

    const start = instantOn(event.startDate, event.startTime);
    const end = instantOn(event.endDate, event.endTime ?? event.startTime);
    if (start === null || end === null || end <= start) return false;

    return stamp >= start && stamp < end;
  });

  // If several overlap, the one ending soonest is the most useful to count down.
  return (
    running.sort((a, b) => {
      const endA = instantOn(a.endDate, a.endTime ?? a.startTime) ?? 0;
      const endB = instantOn(b.endDate, b.endTime ?? b.startTime) ?? 0;
      return endA - endB;
    })[0] ?? null
  );
};

/**
 * Keeps the Live Activity in step with what is actually running.
 *
 * Called whenever plans change and on a timer, so the activity appears when a
 * plan starts and clears when it ends or is ticked off.
 */
export const syncRunningPlanActivity = (
  events: CalendarEvent[],
  myRole: UserRole,
  myName: string,
  partnerName: string,
  now: Date = new Date()
): void => {
  if (Platform.OS !== 'ios' || !areLiveActivitiesEnabled()) return;

  const event = findRunningPlan(events, now);
  if (!event) {
    setRunningPlan(null);
    return;
  }

  const labels = getPersonLabels(myRole, myName, partnerName);
  const kind = resolveTarget(event.target, myRole);

  const plan: RunningPlan = {
    planId: event.id,
    title: event.title,
    who:
      kind === 'both'
        ? labels.both
        : kind === 'partner'
          ? labels.partner
          : String(i18n.t('happeningNowShort')),
    startedAt: instantOn(event.startDate, event.startTime) ?? now.getTime(),
    endsAt: instantOn(event.endDate, event.endTime ?? event.startTime) ?? now.getTime(),
    colorHex: event.color || '#00FFFF',
    isPartner: kind === 'partner',
  };

  setRunningPlan(plan);
};
