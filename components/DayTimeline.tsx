import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import i18n from '@/i18n';
import { CalendarEvent } from '@/db/events';
import { getCountersForDate, getDaysDifference } from '@/db/counters';
import { getLocalDateString, parseLocalDate } from '@/utils/date';
import { colorForTarget, labelForTarget, resolveTarget } from '@/utils/labels';
import { useCalendarData } from './CalendarDataProvider';
import EventCompletionToggle from './EventCompletionToggle';
import { AddIcon, IconColor, IconSize, NextIcon, NoteIcon, PrevIcon } from './ui/icons';

/** Every hour of the day, 00:00 through 23:00 (the last row covers 23:59). */
const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);

interface DayTimelineProps {
  date: string;
  onDateChange: (date: string) => void;
  events: CalendarEvent[];
  onAddEvent: (date: string, time?: string) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onEditNotes: (date: string) => void;
}

/** Hour-by-hour view of a single day, covering the full 00:00–23:59 span. */
export default function DayTimeline({
  date,
  onDateChange,
  events,
  onAddEvent,
  onEditEvent,
  onEditNotes,
}: DayTimelineProps) {
  const data = useCalendarData();
  const todayStr = getLocalDateString();

  const dayEvents = events.filter(e => e.startDate <= date && e.endDate >= date);
  const allDayEvents = dayEvents.filter(e => e.isAllDay);
  const timedEvents = dayEvents.filter(e => !e.isAllDay);
  const dayNotes = data.notesByDate[date] ?? [];
  const dayCounters = getCountersForDate(data.counters, date);

  const shiftDay = (delta: number) => {
    const next = parseLocalDate(date);
    next.setDate(next.getDate() + delta);
    onDateChange(getLocalDateString(next));
  };

  const formatted = () => {
    const [y, m, d] = date.split('-').map(Number);
    return `${d} ${i18n.t(`months.${m - 1}`)} ${y}`;
  };

  const renderEventRow = (event: CalendarEvent, compact = false) => {
    const tint = colorForTarget(resolveTarget(event.target, data.myRole));
    return (
      <TouchableOpacity
        key={event.id}
        activeOpacity={0.8}
        onPress={() => onEditEvent(event)}
        style={{ borderLeftColor: event.color || IconColor.cyan, borderLeftWidth: 3 }}
        className={`bg-gray-900 p-2.5 rounded-r-xl mb-1.5 flex-row items-center ${
          event.completed ? 'opacity-60' : ''
        }`}
      >
        <EventCompletionToggle event={event} onToggle={data.toggleEventCompleted} size="sm" />

        <View className="flex-1 mx-2.5">
          <Text
            className={`font-bold text-xs ${
              event.completed ? 'text-gray-500 line-through' : 'text-white'
            }`}
            numberOfLines={1}
          >
            {event.title}
          </Text>
          <Text className="text-gray-400 text-[10px]">
            {compact
              ? event.startDate !== event.endDate
                ? `${event.startDate} → ${event.endDate}`
                : String(i18n.t('allDay'))
              : `${event.startTime ?? ''} – ${event.endTime ?? ''}`}
          </Text>
        </View>

        <View className="px-1.5 py-0.5 rounded" style={{ backgroundColor: `${tint}20` }}>
          <Text className="text-[9px] font-bold" style={{ color: tint }}>
            {labelForTarget(event.target, data.myRole, data.myName, data.partnerName)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1">
      <View className="flex-row justify-between items-center mb-4">
        <TouchableOpacity onPress={() => shiftDay(-1)} className="p-2">
          <PrevIcon size={IconSize.lg} color={IconColor.cyan} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => onDateChange(todayStr)} className="items-center">
          <Text className="text-white font-extrabold text-lg">{formatted()}</Text>
          {date === todayStr && (
            <Text className="text-neonCyan text-[11px] font-bold mt-0.5">{i18n.t('today')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => shiftDay(1)} className="p-2">
          <NextIcon size={IconSize.lg} color={IconColor.cyan} />
        </TouchableOpacity>
      </View>

      {dayCounters.map(counter => {
        const diff = getDaysDifference(counter.targetDate, counter.type);
        return (
          <View
            key={counter.id}
            className="bg-pink-950/40 border border-neonPink/60 p-3.5 rounded-2xl flex-row items-center mb-3"
          >
            <Text className="text-2xl mr-2.5">{counter.icon || '❤️'}</Text>
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

      {dayNotes.length > 0 && (
        <View className="mb-4">
          <View className="flex-row items-center mb-2">
            <NoteIcon size={IconSize.sm} color={IconColor.purple} />
            <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-1.5">
              {i18n.t('notes')} ({dayNotes.length})
            </Text>
          </View>
          {dayNotes.map(note => (
            <TouchableOpacity
              key={note.noteId}
              onPress={() => onEditNotes(date)}
              className="bg-purple-950/40 border border-purple-800/60 p-3.5 rounded-2xl mb-2"
            >
              <Text className="text-purple-200 text-xs" numberOfLines={2}>
                {note.content}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {allDayEvents.length > 0 && (
        <View className="mb-4">
          <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">
            {i18n.t('allDay')} ({allDayEvents.length})
          </Text>
          {allDayEvents.map(event => renderEventRow(event, true))}
        </View>
      )}

      <View className="border-t border-gray-800 pt-3">
        {HOURS.map(hour => {
          const hourEvents = timedEvents.filter(e =>
            e.startTime?.startsWith(hour.substring(0, 2))
          );

          return (
            <View
              key={hour}
              className="flex-row min-h-[52px] border-b border-gray-900 items-start py-2"
            >
              <Text className="text-gray-500 font-mono text-xs w-14 mt-1">{hour}</Text>

              <View className="flex-1 pl-2">
                {hourEvents.length > 0 ? (
                  hourEvents.map(event => renderEventRow(event))
                ) : (
                  <TouchableOpacity
                    onPress={() => onAddEvent(date, hour)}
                    className="h-9 rounded-lg border border-dashed border-gray-800/60 justify-center px-3 flex-row items-center"
                  >
                    <AddIcon size={IconSize.xs} color="#374151" />
                    <Text className="text-gray-700 text-[11px] ml-1.5">{i18n.t('addEvent')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
