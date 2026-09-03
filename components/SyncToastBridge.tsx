import { useEffect } from 'react';
import { useRouter } from 'expo-router';

import { syncService } from '@/services/syncService';
import { useCalendarData } from './CalendarDataProvider';
import { ToastVariant, useToast } from './ui/Toast';

const VARIANT_BY_TYPE: Record<string, ToastVariant> = {
  event: 'event',
  note: 'note',
  counter: 'reminder',
};

/**
 * Routes sync notifications into the shared toast host.
 *
 * Keeps syncService free of UI concerns: it publishes a payload, this decides
 * how it is surfaced.
 */
export default function SyncToastBridge() {
  const { showToast } = useToast();
  const { requestFocusDate } = useCalendarData();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = syncService.addNotificationListener(payload => {
      showToast({
        title: payload.title,
        message: payload.message,
        variant: VARIANT_BY_TYPE[payload.type] ?? 'info',
        // Tapping the toast opens the day it is about, same as the
        // notification it mirrors.
        onPress: payload.date
          ? () => {
              requestFocusDate(payload.date!);
              router.navigate('/(tabs)/calendar');
            }
          : undefined,
      });
    });
    return () => {
      unsubscribe();
    };
  }, [showToast, requestFocusDate, router]);

  return null;
}
