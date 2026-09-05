import i18n from '@/i18n';
import { CalendarEvent } from '@/db/events';
import { UserRole } from '@/db/settings';
import { getLocalDateString } from '@/utils/date';
import { getEventsForDay, isEventFinished } from '@/utils/todayPlan';
import {
  TodayPlanSnapshot,
  WidgetPlanItem,
  setTodayPlanSnapshot,
} from '@/modules/home-widget';

/**
 * Everything for the day is sent; the widget decides how many rows fit.
 * A WidgetKit widget cannot scroll, so the large family shows as many as it
 * can and reports the rest as a count.
 */
const MAX_WIDGET_ITEMS = 24;

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

    // Still-ahead plans first, then what is already behind us, flagged so the
    // widget can dim it rather than dropping it.
    const ordered = getEventsForDay(events, today)
      .map(e => ({ event: e, done: isEventFinished(e, today, now) }))
      .sort((a, b) => Number(a.done) - Number(b.done));

    const items: WidgetPlanItem[] = ordered
      .slice(0, MAX_WIDGET_ITEMS)
      .map(({ event: e, done }) => ({
        title: e.title,
        time: e.isAllDay ? null : e.startTime ?? null,
        color: e.color || '#00FFFF',
        target:
          e.target === 'both'
            ? 'both'
            : e.target === partnerRole || e.target === 'partner'
            ? 'partner'
            : 'me',
        done,
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
