import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

import { useCalendarData } from './CalendarDataProvider';

/** Pulls a "YYYY-MM-DD" out of a notification payload, if it carries one. */
const readDate = (response: Notifications.NotificationResponse | null): string | null => {
  const data = response?.notification?.request?.content?.data as
    | Record<string, unknown>
    | undefined;
  const date = data?.date;
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
};

/**
 * Opens the day a notification is about when the user taps it.
 *
 * Covers both directions: a tap while the app is running, and a cold start
 * where the tap is what launched the app — the latter has no live listener to
 * fire, so the last response is read once on mount.
 */
export default function NotificationRouter() {
  const router = useRouter();
  const { requestFocusDate } = useCalendarData();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    const go = (date: string | null, key: string) => {
      if (!date || handled.current === key) return;
      handled.current = key;
      requestFocusDate(date);
      router.navigate('/(tabs)/calendar');
    };

    // Cold start: the notification tap launched the app.
    Notifications.getLastNotificationResponseAsync()
      .then(response => {
        if (!response) return;
        go(readDate(response), response.notification.request.identifier);
      })
      .catch(() => {
        /* nothing pending */
      });

    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      go(readDate(response), `${response.notification.request.identifier}:${Date.now()}`);
    });

    return () => subscription.remove();
  }, [requestFocusDate, router]);

  return null;
}
