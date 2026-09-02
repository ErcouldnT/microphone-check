import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import i18n from '@/i18n';
import { CalendarEvent } from '@/db/events';
import { getCountersForDate, getDaysDifference } from '@/db/counters';
import { colorForTarget, labelForTarget, resolveTarget } from '@/utils/labels';
import { useCalendarData } from './CalendarDataProvider';
import EventCompletionToggle, { CompletedBadge } from './EventCompletionToggle';
import { AddIcon, IconColor, IconSize, NoteIcon, ScheduleIcon } from './ui/icons';

interface DayScheduleProps {
  date: string;
  events: CalendarEvent[];
  onAddEvent: (date: string) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onEditNotes: (date: string) => void;
}

/** The selected day's plans, notes and milestones, shown under the grid. */
export default function DaySchedule({
  date,
  events,
  onAddEvent,
  onEditEvent,
  onEditNotes,
}: DayScheduleProps) {
  const data = useCalendarData();

  const dayEvents = events.filter(e => e.startDate <= date && e.endDate >= date);
  const dayNotes = data.notesByDate[date] ?? [];
  const dayCounters = getCountersForDate(data.counters, date);

  const formatted = () => {
    const [y, m, d] = date.split('-').map(Number);
    return `${d} ${i18n.t(`months.${m - 1}`)} ${y}`;
  };

  return (
    <View className="bg-gray-950 border border-gray-800 rounded-3xl p-4 mt-5">
      <View className="flex-row justify-between items-center mb-3 pb-3 border-b border-gray-800">
        <View className="flex-1 mr-2">
          <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider">
            {i18n.t('scheduleForDay')}
          </Text>
          <Text className="text-white font-extrabold text-lg mt-0.5">{formatted()}</Text>
        </View>

        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => onEditNotes(date)}
            className="bg-purple-500/15 border border-purple-500 px-2.5 py-1.5 rounded-full flex-row items-center"
          >
            <NoteIcon size={IconSize.xs} color={IconColor.purple} />
            <Text className="text-purple-300 text-xs font-bold ml-1">{dayNotes.length}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => onAddEvent(date)}
            className="bg-neonCyan/15 border border-neonCyan px-3 py-1.5 rounded-full flex-row items-center"
          >
            <AddIcon size={IconSize.xs} color={IconColor.cyan} />
            <Text className="text-neonCyan text-xs font-bold ml-1.5">{i18n.t('addEvent')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {dayCounters.map(counter => {
        const diff = getDaysDifference(counter.targetDate, counter.type);
        return (
          <View
            key={counter.id}
            className="bg-pink-950/40 border border-neonPink/60 p-3 rounded-2xl flex-row items-center mb-2"
          >
            <Text className="text-xl mr-2.5">{counter.icon || '❤️'}</Text>
            <View className="flex-1">
              <Text className="text-neonPink font-extrabold text-xs">{counter.title}</Text>
              <Text className="text-gray-400 text-[10px] mt-0.5">
                {diff === 0
                  ? i18n.t('todayIsTheDay')
                  : `${Math.abs(diff)} ${i18n.t(counter.type === 'until' ? 'daysLeft' : 'daysAgo')}`}
              </Text>
            </View>
          </View>
        );
      })}

      {dayNotes.map((note, index) => (
        <TouchableOpacity
          key={note.noteId}
          onPress={() => onEditNotes(date)}
          className="bg-purple-950/30 border border-purple-900/60 p-3 rounded-2xl mb-2 flex-row items-start"
        >
          {dayNotes.length > 1 && (
            <Text className="text-purple-400/70 text-[11px] font-bold mr-2">{index + 1}.</Text>
          )}
          <Text className="text-purple-100 text-xs flex-1" numberOfLines={2}>
            {note.content}
          </Text>
        </TouchableOpacity>
      ))}

      {dayEvents.length === 0 && dayNotes.length === 0 && dayCounters.length === 0 ? (
        <View className="py-6 items-center justify-center">
          <ScheduleIcon size={IconSize.hero} color={IconColor.faint} />
          <Text className="text-gray-500 text-sm font-medium text-center mt-2.5 mb-3">
            {i18n.t('noEventsForDay')}
          </Text>
          <TouchableOpacity
            onPress={() => onAddEvent(date)}
            className="bg-gray-900 border border-gray-700 px-4 py-2 rounded-xl flex-row items-center"
          >
            <AddIcon size={IconSize.sm} color={IconColor.cyan} />
            <Text className="text-white text-xs font-bold ml-1.5">{i18n.t('addEvent')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        dayEvents.map(event => {
          const kind = resolveTarget(event.target, data.myRole);
          const tint = colorForTarget(kind);

          return (
            <TouchableOpacity
              key={event.id}
              activeOpacity={0.8}
              onPress={() => onEditEvent(event)}
              className={`bg-gray-900 border border-gray-800/80 p-3 rounded-2xl flex-row items-center mb-2 ${
                event.completed ? 'opacity-60' : ''
              }`}
            >
              <EventCompletionToggle event={event} onToggle={data.toggleEventCompleted} />

              <View
                className="w-2 h-10 rounded-full mx-3"
                style={{ backgroundColor: event.color || IconColor.cyan }}
              />

              <View className="flex-1">
                <View className="flex-row items-center flex-wrap gap-1.5 mb-1">
                  <Text
                    className={`font-bold text-sm ${
                      event.completed ? 'text-gray-500 line-through' : 'text-white'
                    }`}
                    numberOfLines={1}
                  >
                    {event.title}
                  </Text>
                  <View
                    className="px-2 py-0.5 rounded-md border"
                    style={{ borderColor: `${tint}66`, backgroundColor: `${tint}1A` }}
                  >
                    <Text className="text-[10px] font-bold" style={{ color: tint }}>
                      {labelForTarget(event.target, data.myRole, data.myName, data.partnerName)}
                    </Text>
                  </View>
                  {event.completed ? <CompletedBadge /> : null}
                </View>

                <Text className="text-gray-400 text-xs">
                  {event.isAllDay
                    ? event.startDate !== event.endDate
                      ? `${event.startDate.substring(5)} → ${event.endDate.substring(5)}`
                      : String(i18n.t('allDay'))
                    : `${event.startTime ?? ''} – ${event.endTime ?? ''}`}
                </Text>

                {event.description ? (
                  <Text className="text-gray-500 text-[11px] mt-1" numberOfLines={1}>
                    {event.description}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
}
