import { requireOptionalNativeModule } from 'expo-modules-core';

/** One row as the home screen widgets render it. */
export interface WidgetPlanItem {
  title: string;
  /** "HH:mm", or null for an all-day plan. */
  time: string | null;
  color: string;
  /** 'me' | 'partner' | 'both' — already resolved from the device's role. */
  target: 'me' | 'partner' | 'both';
  /** Ticked off, or its time has already gone by. */
  done: boolean;
}

export interface TodayPlanSnapshot {
  date: string;
  dateLabel: string;
  title: string;
  emptyLabel: string;
  items: WidgetPlanItem[];
}

/** One running plan, as the Live Activity renders it. */
export interface RunningPlan {
  planId: string;
  title: string;
  /** Already resolved to a display name. */
  who: string;
  /** Epoch milliseconds. */
  startedAt: number;
  endsAt: number;
  colorHex: string;
  isPartner: boolean;
}

interface HomeWidgetNativeModule {
  setTodayPlan(json: string): boolean;
  refresh(): boolean;
  isSupported(): boolean;
  areLiveActivitiesEnabled?(): boolean;
  startPlanActivity?(json: string): boolean;
  endPlanActivity?(): boolean;
}

// Absent in Expo Go and on web, where there is no home screen widget.
const HomeWidget = requireOptionalNativeModule<HomeWidgetNativeModule>('HomeWidget');

export const isHomeWidgetAvailable = (): boolean => {
  try {
    return Boolean(HomeWidget?.isSupported());
  } catch {
    return false;
  }
};

/**
 * Publishes today's plan to the home screen widgets.
 *
 * Android reads the app database directly and only needs the nudge; iOS needs
 * the snapshot because its widget extension runs in a separate process.
 */
export const setTodayPlanSnapshot = (snapshot: TodayPlanSnapshot): void => {
  if (!HomeWidget) return;
  try {
    HomeWidget.setTodayPlan(JSON.stringify(snapshot));
  } catch (e: any) {
    console.warn('Could not update home widget:', e?.message);
  }
};

/** Redraws the widgets without changing the stored snapshot. */
export const refreshHomeWidgets = (): void => {
  if (!HomeWidget) return;
  try {
    HomeWidget.refresh();
  } catch (e: any) {
    console.warn('Could not refresh home widget:', e?.message);
  }
};

/** Whether the OS will show Live Activities for this app right now. */
export const areLiveActivitiesEnabled = (): boolean => {
  try {
    return Boolean(HomeWidget?.areLiveActivitiesEnabled?.());
  } catch {
    return false;
  }
};

/**
 * Shows the plan that is running as a Live Activity, or clears it.
 *
 * Passing null ends whatever is showing, which is what happens when the plan
 * finishes or is ticked off.
 */
export const setRunningPlan = (plan: RunningPlan | null): void => {
  if (!HomeWidget) return;
  try {
    if (plan) {
      HomeWidget.startPlanActivity?.(JSON.stringify(plan));
    } else {
      HomeWidget.endPlanActivity?.();
    }
  } catch (e: any) {
    console.warn('Could not update the running-plan activity:', e?.message);
  }
};
