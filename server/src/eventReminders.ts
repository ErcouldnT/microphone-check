import {
  getEventsStartingAt,
  getRoomPushTargets,
  markReminderSent,
  pruneReminderLog,
} from './db.js';
import { sendExpoPushNotifications } from './push.js';

/** How often the scheduler looks for plans that just started. */
const TICK_MS = 60_000;

const pad = (value: number) => String(value).padStart(2, '0');

const currentDate = (now: Date) =>
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

const currentTime = (now: Date) => `${pad(now.getHours())}:${pad(now.getMinutes())}`;

/**
 * Tells the other person when a plan begins.
 *
 * Devices schedule their own local reminders for their own plans, so this only
 * covers the case the device cannot: letting the partner know that the plan
 * that just started is the other one's. The device whose plan it is is skipped,
 * which keeps the two mechanisms from doubling up.
 */
const notifyEventStart = async (now: Date) => {
  const date = currentDate(now);
  const time = currentTime(now);

  const events = getEventsStartingAt(date, time);
  if (events.length === 0) return;

  for (const event of events) {
    const targets = getRoomPushTargets(event.roomId);
    if (targets.length === 0) continue;

    // Whose plan is it? Name comes from that person's own device registration.
    const owner = targets.find(t => t.role && t.role === event.target);
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

    // Keep the dedupe log from growing without bound.
    if (now.getMinutes() === 0) pruneReminderLog();
  }, TICK_MS);

  console.log('⏰ Event start reminder scheduler running');
}

export function stopEventReminderScheduler() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
