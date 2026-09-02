import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import i18n from '@/i18n';
import { CalendarEvent } from '@/db/events';
import { NoteItem } from '@/db/notes';
import { RelationshipCounter, getCountersForDate } from '@/db/counters';
import { UserRole } from '@/db/settings';
import { getLocalDateString } from '@/utils/date';
import { getEventsForDay, getRemainingEventsForDay } from '@/utils/todayPlan';
import EventCompletionToggle from './EventCompletionToggle';

const MAX_VISIBLE = 4;

interface TodayPlanCardProps {
  events: CalendarEvent[];
  notes?: NoteItem[];
  counters?: RelationshipCounter[];
  myRole?: UserRole;
  onPressDate?: (dateStr: string) => void;
  onEditEvent?: (event: CalendarEvent) => void;
  onToggleCompleted?: (event: CalendarEvent) => void;
}

/**
 * "Today's plan" summary pinned above the calendar — the in-app twin of the
 * home screen widgets. Plans that already finished today are hidden, so the
 * card always answers "what is left today".
 */
export default function TodayPlanCard({
  events,
  notes = [],
  counters = [],
  myRole = 'male',
  onPressDate,
  onEditEvent,
  onToggleCompleted,
}: TodayPlanCardProps) {
  // Re-evaluate on a timer so plans drop off as their end time passes.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const todayStr = getLocalDateString(now);
  const allToday = getEventsForDay(events, todayStr);
  const remaining = getRemainingEventsForDay(events, todayStr, now);
  // Only plans actually ticked off count as completed. Plans hidden merely
  // because their time has passed are counted separately.
  const doneCount = allToday.filter(e => e.completed).length;
  const pastCount = allToday.length - remaining.length - doneCount;

  const visible = remaining.slice(0, MAX_VISIBLE);
  const overflow = remaining.length - visible.length;

  const todayNotes = notes.filter(n => n.date === todayStr);
  const todayCounters = getCountersForDate(counters, todayStr);

  const partnerRole: UserRole = myRole === 'male' ? 'female' : 'male';
  const targetEmoji = (target: string) => {
    if (target === 'both') return '✨';
    if (target === partnerRole || target === 'partner') return '💖';
    return '👤';
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => onPressDate && onPressDate(todayStr)}
      className="bg-gray-950 border border-neonCyan/40 rounded-3xl p-4 mb-4"
    >
      {/* Header */}
      <View className="flex-row justify-between items-center mb-3">
        <View className="flex-row items-center">
          <View className="w-2 h-2 rounded-full bg-neonCyan mr-2" />
          <Text className="text-neonCyan text-xs font-extrabold uppercase tracking-wider">
            {i18n.t('todaysPlan')}
          </Text>
        </View>
        <Text className="text-gray-500 text-[11px] font-bold">
          {now.getDate()} {i18n.t(`months.${now.getMonth()}`)}
        </Text>
      </View>

      {visible.length === 0 ? (
        <View className="py-3 items-center">
          <Text className="text-gray-500 text-xs">
            {allToday.length > 0
              ? `✅ ${doneCount + pastCount} / ${allToday.length}`
              : i18n.t('noPlanToday')}
          </Text>
        </View>
      ) : (
        <View>
          {visible.map(e => (
            <TouchableOpacity
              key={e.id}
              activeOpacity={0.8}
              onPress={() => onEditEvent && onEditEvent(e)}
              className="flex-row items-center mb-2"
            >
              <EventCompletionToggle event={e} onToggle={onToggleCompleted} size="sm" />

              <View
                className="w-1 h-8 rounded-full mx-2.5"
                style={{ backgroundColor: e.color || '#00FFFF' }}
              />

              <Text className="text-gray-400 text-[11px] font-mono w-11">
                {e.isAllDay ? '--:--' : e.startTime || '--:--'}
              </Text>

              <Text className="text-white text-xs font-bold flex-1 mx-1.5" numberOfLines={1}>
                {e.title}
              </Text>

              <Text className="text-xs">{targetEmoji(e.target)}</Text>
            </TouchableOpacity>
          ))}

          {overflow > 0 && (
            <Text className="text-gray-500 text-[11px] font-bold ml-8 mt-0.5">
              + {i18n.t('moreItems', { count: overflow })}
            </Text>
          )}
        </View>
      )}

      {/* Footer chips */}
      {(todayNotes.length > 0 || todayCounters.length > 0 || doneCount > 0 || pastCount > 0) && (
        <View className="flex-row items-center flex-wrap gap-2 mt-2 pt-2.5 border-t border-gray-900">
          {doneCount > 0 && (
            <View className="flex-row items-center bg-green-950/60 border border-green-600/40 px-2 py-0.5 rounded-md">
              <FontAwesome name="check" size={9} color="#4ade80" style={{ marginRight: 4 }} />
              <Text className="text-green-400 text-[10px] font-bold">
                {doneCount} {i18n.t('completed')}
              </Text>
            </View>
          )}

          {pastCount > 0 && (
            <View className="flex-row items-center bg-gray-900 border border-gray-700 px-2 py-0.5 rounded-md">
              <FontAwesome name="history" size={9} color="#9ca3af" style={{ marginRight: 4 }} />
              <Text className="text-gray-400 text-[10px] font-bold">
                {pastCount} {i18n.t('passed')}
              </Text>
            </View>
          )}

          {todayNotes.length > 0 && (
            <View className="flex-row items-center bg-purple-950/60 border border-purple-700/50 px-2 py-0.5 rounded-md">
              <FontAwesome name="pencil-square" size={9} color="#c084fc" style={{ marginRight: 4 }} />
              <Text className="text-purple-300 text-[10px] font-bold">
                {todayNotes.length} {i18n.t('noteCountSuffix')}
              </Text>
            </View>
          )}

          {todayCounters.map(c => (
            <View
              key={c.id}
              className="flex-row items-center bg-pink-950/60 border border-neonPink/40 px-2 py-0.5 rounded-md"
            >
              <Text className="text-[10px] mr-1">{c.icon || '❤️'}</Text>
              <Text className="text-neonPink text-[10px] font-bold" numberOfLines={1}>
                {c.title}
              </Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}
