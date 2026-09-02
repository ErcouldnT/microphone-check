import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import i18n from '@/i18n';
import { CalendarEvent } from '@/db/events';
import { getCountersForDate, getDaysDifference } from '@/db/counters';
import { getLocalDateString } from '@/utils/date';
import { getEventsForDay, getRemainingEventsForDay } from '@/utils/todayPlan';
import { colorForTarget, getPersonLabels, resolveTarget } from '@/utils/labels';
import { useCalendarData } from '@/components/CalendarDataProvider';
import DayActionModal, { ActionTab } from '@/components/DayActionModal';
import RelationshipCounterStrip from '@/components/RelationshipCounterStrip';
import SyncStatusPill from '@/components/SyncStatusPill';
import EventCompletionToggle from '@/components/EventCompletionToggle';
import {
  AddIcon,
  CalendarIcon,
  CompletedIcon,
  IconColor,
  IconSize,
  NoteIcon,
  PastIcon,
  ScheduleIcon,
} from '@/components/ui/icons';

/**
 * The landing tab: what is still ahead today, plus the day's notes and any
 * milestone falling on it. Deliberately holds no calendar grid — that lives on
 * its own tab now, which keeps this screen scannable at a glance.
 */
export default function TodayScreen() {
  const router = useRouter();
  const data = useCalendarData();

  // Re-evaluate on a timer so plans drop off as their end time passes.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalTab, setModalTab] = useState<ActionTab>('event');
  const [eventToEdit, setEventToEdit] = useState<CalendarEvent | null>(null);

  const today = getLocalDateString(now);
  const labels = getPersonLabels(data.myRole, data.myName, data.partnerName);

  const { remaining, doneCount, pastCount, total } = useMemo(() => {
    const all = getEventsForDay(data.events, today);
    const left = getRemainingEventsForDay(data.events, today, now);
    const done = all.filter(e => e.completed).length;
    return {
      remaining: left,
      doneCount: done,
      pastCount: all.length - left.length - done,
      total: all.length,
    };
  }, [data.events, today, now]);

  const todayNotes = data.notesByDate[today] ?? [];
  const todayCounters = getCountersForDate(data.counters, today);

  const openModal = (tab: ActionTab, event: CalendarEvent | null = null) => {
    setEventToEdit(event);
    setModalTab(tab);
    setModalVisible(true);
  };

  const formattedDate = `${now.getDate()} ${i18n.t(`months.${now.getMonth()}`)} ${now.getFullYear()}`;

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top', 'left', 'right']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Header */}
        <View className="flex-row justify-between items-start mb-5">
          <View className="flex-1 mr-3">
            <Text className="text-neonCyan text-xs font-extrabold uppercase tracking-widest">
              {i18n.t('today')}
            </Text>
            <Text className="text-white text-2xl font-extrabold mt-0.5">{formattedDate}</Text>
          </View>
          <SyncStatusPill />
        </View>

        {/* Milestones */}
        <RelationshipCounterStrip />

        {/* Remaining plans */}
        <View className="bg-gray-950 border border-gray-800 rounded-3xl p-4 mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <ScheduleIcon size={IconSize.md} color={IconColor.cyan} />
              <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-2">
                {i18n.t('remainingToday')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => openModal('event')}
              className="bg-neonCyan/15 border border-neonCyan px-3 py-1.5 rounded-full flex-row items-center"
            >
              <AddIcon size={IconSize.xs} color={IconColor.cyan} />
              <Text className="text-neonCyan text-xs font-bold ml-1.5">{i18n.t('addPlan')}</Text>
            </TouchableOpacity>
          </View>

          {remaining.length === 0 ? (
            <View className="py-6 items-center">
              <CompletedIcon size={IconSize.hero} color={IconColor.faint} />
              <Text className="text-gray-500 text-sm mt-2.5 text-center">
                {total > 0 ? i18n.t('nothingLeftToday') : i18n.t('noPlanToday')}
              </Text>
            </View>
          ) : (
            remaining.map(event => {
              const kind = resolveTarget(event.target, data.myRole);
              const who = kind === 'both' ? labels.both : kind === 'partner' ? labels.partner : labels.me;

              return (
                <TouchableOpacity
                  key={event.id}
                  activeOpacity={0.8}
                  onPress={() => openModal('event', event)}
                  className="flex-row items-center bg-black/40 border border-gray-900 rounded-2xl p-3 mb-2"
                >
                  <EventCompletionToggle event={event} onToggle={data.toggleEventCompleted} />

                  <View
                    className="w-1 h-9 rounded-full mx-3"
                    style={{ backgroundColor: event.color || IconColor.cyan }}
                  />

                  <View className="flex-1 mr-2">
                    <Text className="text-white font-bold text-sm" numberOfLines={1}>
                      {event.title}
                    </Text>
                    <Text className="text-gray-500 text-[11px] mt-0.5">
                      {event.isAllDay
                        ? i18n.t('allDay')
                        : `${event.startTime ?? ''}${event.endTime ? ` – ${event.endTime}` : ''}`}
                    </Text>
                  </View>

                  <View
                    className="px-2 py-0.5 rounded-md border"
                    style={{
                      borderColor: `${colorForTarget(kind)}66`,
                      backgroundColor: `${colorForTarget(kind)}1A`,
                    }}
                  >
                    <Text
                      className="text-[10px] font-bold"
                      style={{ color: colorForTarget(kind) }}
                      numberOfLines={1}
                    >
                      {who}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          {(doneCount > 0 || pastCount > 0) && (
            <View className="flex-row items-center gap-2 mt-1 pt-3 border-t border-gray-900">
              {doneCount > 0 && (
                <View className="flex-row items-center bg-green-950/60 border border-green-600/40 px-2 py-0.5 rounded-md">
                  <CompletedIcon size={IconSize.xs} color={IconColor.green} />
                  <Text className="text-green-400 text-[10px] font-bold ml-1">
                    {doneCount} {i18n.t('completed')}
                  </Text>
                </View>
              )}
              {pastCount > 0 && (
                <View className="flex-row items-center bg-gray-900 border border-gray-700 px-2 py-0.5 rounded-md">
                  <PastIcon size={IconSize.xs} color={IconColor.muted} />
                  <Text className="text-gray-400 text-[10px] font-bold ml-1">
                    {pastCount} {i18n.t('passed')}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Notes */}
        <View className="bg-gray-950 border border-gray-800 rounded-3xl p-4 mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <NoteIcon size={IconSize.md} color={IconColor.purple} />
              <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-2">
                {i18n.t('notes')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => openModal('note')}
              className="bg-purple-500/15 border border-purple-500 px-3 py-1.5 rounded-full flex-row items-center"
            >
              <AddIcon size={IconSize.xs} color={IconColor.purple} />
              <Text className="text-purple-300 text-xs font-bold ml-1.5">{i18n.t('addNote')}</Text>
            </TouchableOpacity>
          </View>

          {todayNotes.length === 0 ? (
            <Text className="text-gray-600 text-xs py-2">{i18n.t('noNotesForDay')}</Text>
          ) : (
            todayNotes.map((note, index) => (
              <TouchableOpacity
                key={note.noteId}
                onPress={() => openModal('note')}
                className="flex-row items-start bg-purple-950/30 border border-purple-900/60 rounded-2xl p-3 mb-2"
              >
                <Text className="text-purple-400/70 text-[11px] font-bold mr-2 mt-0.5">
                  {index + 1}.
                </Text>
                <Text className="text-purple-100 text-xs flex-1 leading-relaxed">{note.content}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Milestones falling on today */}
        {todayCounters.length > 0 && (
          <View className="bg-pink-950/25 border border-neonPink/40 rounded-3xl p-4 mb-4">
            {todayCounters.map(counter => {
              const diff = getDaysDifference(counter.targetDate, counter.type);
              return (
                <View key={counter.id} className="flex-row items-center">
                  <Text className="text-2xl mr-3">{counter.icon || '❤️'}</Text>
                  <View className="flex-1">
                    <Text className="text-neonPink font-extrabold text-sm">{counter.title}</Text>
                    <Text className="text-gray-400 text-xs mt-0.5">
                      {diff === 0
                        ? i18n.t('todayIsTheDay')
                        : `${Math.abs(diff)} ${i18n.t(counter.type === 'until' ? 'daysLeft' : 'daysAgo')}`}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Jump to the full calendar */}
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/calendar')}
          className="bg-gray-950 border border-gray-800 rounded-2xl p-3.5 flex-row items-center justify-center"
        >
          <CalendarIcon size={IconSize.md} color={IconColor.muted} />
          <Text className="text-gray-300 text-xs font-bold ml-2">{i18n.t('viewCalendar')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <DayActionModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        selectedDate={today}
        initialTab={modalTab}
        eventToEdit={eventToEdit}
        dayNotes={todayNotes}
      />
    </SafeAreaView>
  );
}
