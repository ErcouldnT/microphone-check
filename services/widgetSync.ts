import i18n from '@/i18n';
import { CalendarEvent } from '@/db/events';
import { UserRole } from '@/db/settings';
import { getLocalDateString } from '@/utils/date';
import { getRemainingEventsForDay } from '@/utils/todayPlan';
import {
  TodayPlanSnapshot,
  WidgetPlanItem,
  setTodayPlanSnapshot,
} from '@/modules/home-widget';

/** Cap matches the row budget of the smallest widget size. */
const MAX_WIDGET_ITEMS = 5;

/**
 * Pushes the current "what is left today" list to the home screen widgets.
 *
 * The same finished-plan filtering as the in-app Today card is applied, so the
 * widget never shows a plan that is already over.
 */
export const publishTodayPlanToWidgets = (
  events: CalendarEvent[],
  myRole: UserRole
): void => {
  try {
    const now = new Date();
    const today = getLocalDateString(now);
    const partnerRole: UserRole = myRole === 'male' ? 'female' : 'male';

    const items: WidgetPlanItem[] = getRemainingEventsForDay(events, today, now)
      .slice(0, MAX_WIDGET_ITEMS)
      .map(e => ({
        title: e.title,
        time: e.isAllDay ? null : e.startTime ?? null,
        color: e.color || '#00FFFF',
        target:
          e.target === 'both'
            ? 'both'
            : e.target === partnerRole || e.target === 'partner'
            ? 'partner'
            : 'me',
      }));

    const snapshot: TodayPlanSnapshot = {
      date: today,
      dateLabel: `${now.getDate()} ${i18n.t(`months.${now.getMonth()}`)}`,
      title: String(i18n.t('todaysPlan')),
      emptyLabel: String(i18n.t('noPlanToday')),
      items,
    };

    setTodayPlanSnapshot(snapshot);
  } catch (e: any) {
    console.warn('Could not publish today plan to widgets:', e?.message);
  }
};
