import {
  getRoomPushTargets,
  getRoomTimedEventsBetween,
  getRoomsWithPushTargets,
  markReminderSent,
  pruneReminderLog,
} from './db.js';
import { sendExpoPushNotifications } from './push.js';

/** How often the scheduler looks for plans that just started. */
const TICK_MS = 60_000;

/** Used when a room has no device that reported one yet. */
const FALLBACK_TIMEZONE = 'Europe/Istanbul';

interface WallClock {
  date: string;
  time: string;
}

/**
 * The wall clock in a given timezone.
 *
 * Plans are stored as local times ("17:45"), with no offset attached. Reading
 * the server's own clock therefore fired them off by the UTC offset — a plan at
 * 17:45 in Istanbul was announced when the server, running in UTC, reached
 * 17:45, three hours late.
 */
const wallClockIn = (timezone: string, instant: Date): WallClock => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(instant);

  const get = (type: string) => parts.find(part => part.type === type)?.value ?? '00';
  // hourCycle h23 still renders midnight as "24" in some ICU builds.
  const hour = get('hour') === '24' ? '00' : get('hour');

  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${hour}:${get('minute')}`,
  };
};

/** Shifts a "YYYY-MM-DD" by whole days. */
const shiftDate = (date: string, days: number): string => {
  const [y, m, d] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
};

const isValidTimezone = (timezone: string | null | undefined): timezone is string => {
  if (!timezone) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
};

/**
 * Tells the other person when a plan begins.
 *
 * Devices schedule their own local reminders for their own plans, so this only
 * covers the case the device cannot: letting the partner know that the plan
 * that just started is the other one's. The device whose plan it is is skipped,
 * which keeps the two mechanisms from doubling up.
 */
const notifyEventStart = async (instant: Date) => {
  for (const room of getRoomsWithPushTargets()) {
    const roomZone = isValidTimezone(room.timezone) ? room.timezone : FALLBACK_TIMEZONE;

    // Widen the window by a day either side: "today" differs between zones.
    const spread = wallClockIn('UTC', instant).date;
    const from = shiftDate(spread, -1);
    const to = shiftDate(spread, 1);

    const candidates = getRoomTimedEventsBetween(room.roomId, from, to);
    if (candidates.length === 0) continue;

    const targets = getRoomPushTargets(room.roomId);
    if (targets.length === 0) continue;

    // Each plan is judged in the zone it was written in, so a couple split
    // across two zones still gets each plan announced at its own local time.
    const events = candidates.filter(event => {
      const zone = isValidTimezone(event.timezone ?? null) ? event.timezone! : roomZone;
      const nowThere = wallClockIn(zone, instant);
      return event.startDate === nowThere.date && event.startTime === nowThere.time;
    });

    for (const event of events) {
      const zone = isValidTimezone(event.timezone ?? null) ? event.timezone! : roomZone;
      const { date, time } = wallClockIn(zone, instant);
      // Whose plan is it? Name comes from that person's own device registration.
      const owner = targets.find(target => target.role && target.role === event.target);
      const ownerName = owner?.displayName?.trim();

      for (const target of targets) {
        // Their own plan: their device already raised a local reminder.
        if (target.role && target.role === event.target) continue;
        if (event.target === 'both') continue;

        const key = `${event.id}:${date}:${time}:${target.deviceId}`;
        if (!markReminderSent(key)) continue;

        const window = event.endTime ? `${event.startTime}–${event.endTime}` : event.startTime;

        await sendExpoPushNotifications([target.pushToken], {
          title: ownerName ? `${ownerName} şu an meşgul` : 'Partnerinin planı başladı',
          body: ownerName
            ? `${ownerName} şu an "${event.title}" yapıyor · ${window}`
            : `"${event.title}" şu an başladı · ${window}`,
          data: { eventId: event.id, date, kind: 'event-start' },
        });
      }
    }
  }
};

let timer: NodeJS.Timeout | null = null;

/** Starts the once-a-minute scheduler. Safe to call once at boot. */
export function startEventReminderScheduler() {
  if (timer) return;

  timer = setInterval(() => {
    const now = new Date();
    notifyEventStart(now).catch(err =>
      console.error('Event start reminder failed:', err?.message ?? err)
    );

    if (now.getUTCMinutes() === 0) pruneReminderLog();
  }, TICK_MS);

  console.log('⏰ Event start reminder scheduler running');
}

export function stopEventReminderScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
