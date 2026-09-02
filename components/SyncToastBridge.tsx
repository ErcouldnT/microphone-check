import { useEffect } from 'react';

import { syncService } from '@/services/syncService';
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

  useEffect(() => {
    const unsubscribe = syncService.addNotificationListener(payload => {
      showToast({
        title: payload.title,
        message: payload.message,
        variant: VARIANT_BY_TYPE[payload.type] ?? 'info',
      });
    });
    return () => {
      unsubscribe();
    };
  }, [showToast]);

  return null;
}
