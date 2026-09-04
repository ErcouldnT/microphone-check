import React, { useMemo, useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';

import i18n from '@/i18n';
import { CalendarEvent } from '@/db/events';
import { getMissedEvents } from '@/utils/todayPlan';
import { useCalendarData } from './CalendarDataProvider';
import { useToast } from './ui/Toast';
import {
  CheckIcon,
  CollapseIcon,
  DeleteIcon,
  ExpandIcon,
  IconColor,
  IconSize,
  PastIcon,
  TodayIcon,
} from './ui/icons';

const COLLAPSED_COUNT = 3;

interface MissedPlansCardProps {
  today: string;
}

/**
 * Plans from earlier days that were never completed.
 *
 * They are surfaced rather than moved forward on their own: silently
 * rewriting the date would lose when the plan was actually meant to happen,
 * and in a shared calendar both devices would try it at once. Each one gets
 * three one-tap outcomes instead.
 */
export default function MissedPlansCard({ today }: MissedPlansCardProps) {
  const data = useCalendarData();
  const { showToast } = useToast();
  const [expanded, setExpanded] = useState(false);

  const missed = useMemo(() => getMissedEvents(data.events, today), [data.events, today]);
  if (missed.length === 0) return null;

  const visible = expanded ? missed : missed.slice(0, COLLAPSED_COUNT);

  const moveToToday = async (event: CalendarEvent) => {
    // Keep the plan's length; just slide the whole span onto today.
    const start = new Date(`${event.startDate}T00:00:00`);
    const end = new Date(`${event.endDate}T00:00:00`);
    const spanDays = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));

    const newEnd = new Date(`${today}T00:00:00`);
    newEnd.setDate(newEnd.getDate() + spanDays);
    const pad = (n: number) => String(n).padStart(2, '0');
    const newEndStr = `${newEnd.getFullYear()}-${pad(newEnd.getMonth() + 1)}-${pad(newEnd.getDate())}`;

    await data.saveCalendarEvent({
      id: event.id,
      title: event.title,
      description: event.description,
      startDate: today,
      endDate: newEndStr,
      isAllDay: event.isAllDay,
      startTime: event.startTime,
      endTime: event.endTime,
      color: event.color,
      target: event.target,
      completed: false,
      timezone: event.timezone,
    });
    showToast({ title: String(i18n.t('movedToToday')), variant: 'success' });
  };

  const remove = (event: CalendarEvent) => {
    Alert.alert(String(i18n.t('deleteEvent')), String(i18n.t('deleteEventConfirm')), [
      { text: String(i18n.t('cancel')), style: 'cancel' },
      {
        text: String(i18n.t('delete')),
        style: 'destructive',
        onPress: () => data.removeCalendarEvent(event.id),
      },
    ]);
  };

  const formatDay = (value: string) => {
    const [, m, d] = value.split('-').map(Number);
    return `${d} ${i18n.t(`months.${m - 1}`)}`;
  };

  return (
    <View className="bg-gray-950 border border-yellow-500/30 rounded-3xl p-4 mb-4">
      <View className="flex-row items-center justify-between mb-1">
        <View className="flex-row items-center">
          <PastIcon size={IconSize.md} color={IconColor.yellow} />
          <Text className="text-yellow-400 text-xs font-bold uppercase tracking-wider ml-2">
            {i18n.t('missedPlans')} ({missed.length})
          </Text>
        </View>

        {missed.length > COLLAPSED_COUNT && (
          <TouchableOpacity onPress={() => setExpanded(v => !v)} className="p-1">
            {expanded ? (
              <CollapseIcon size={IconSize.md} color={IconColor.muted} />
            ) : (
              <ExpandIcon size={IconSize.md} color={IconColor.muted} />
            )}
          </TouchableOpacity>
        )}
      </View>

      <Text className="text-gray-600 text-[11px] mb-3">{i18n.t('missedPlansHint')}</Text>

      {visible.map(event => (
        <View
          key={event.id}
          className="bg-black/40 border border-gray-900 rounded-2xl p-3 mb-2"
        >
          <View className="flex-row items-center mb-2.5">
            <View
              className="w-1 h-8 rounded-full mr-3"
              style={{ backgroundColor: event.color || IconColor.cyan }}
            />
            <View className="flex-1">
              <Text className="text-white font-bold text-sm" numberOfLines={1}>
                {event.title}
              </Text>
              <Text className="text-gray-500 text-[11px] mt-0.5">
                {formatDay(event.startDate)}
                {event.isAllDay ? '' : ` · ${event.startTime ?? ''}`}
              </Text>
            </View>
          </View>

          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => data.toggleEventCompleted(event)}
              className="flex-1 bg-green-950/60 border border-green-600/50 py-2 rounded-xl flex-row items-center justify-center"
            >
              <CheckIcon size={IconSize.xs} color={IconColor.green} />
              <Text className="text-green-400 text-[11px] font-bold ml-1.5" numberOfLines={1}>
                {i18n.t('completed')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => moveToToday(event)}
              className="flex-1 bg-cyan-950/60 border border-neonCyan/50 py-2 rounded-xl flex-row items-center justify-center"
            >
              <TodayIcon size={IconSize.xs} color={IconColor.cyan} />
              <Text className="text-neonCyan text-[11px] font-bold ml-1.5" numberOfLines={1}>
                {i18n.t('moveToToday')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => remove(event)}
              className="bg-red-950/60 border border-red-500/40 px-3 py-2 rounded-xl items-center justify-center"
            >
              <DeleteIcon size={IconSize.xs} color={IconColor.red} />
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
}
