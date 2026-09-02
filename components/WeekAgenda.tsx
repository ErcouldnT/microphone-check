import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import i18n from '@/i18n';
import { CalendarEvent } from '@/db/events';
import { getCountersForDate } from '@/db/counters';
import { getLocalDateString } from '@/utils/date';
import { colorForTarget, labelForTarget, resolveTarget } from '@/utils/labels';
import { useCalendarData } from './CalendarDataProvider';
import EventCompletionToggle from './EventCompletionToggle';
import { AddIcon, IconColor, IconSize, NextIcon, NoteIcon, PrevIcon } from './ui/icons';

interface WeekAgendaProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  events: CalendarEvent[];
  onAddEvent: (date: string) => void;
  onEditEvent: (event: CalendarEvent) => void;
}

/** Seven-day vertical agenda for the week containing `currentDate`. */
export default function WeekAgenda({
  currentDate,
  onDateChange,
  selectedDate,
  onSelectDate,
  events,
  onAddEvent,
  onEditEvent,
}: WeekAgendaProps) {
  const data = useCalendarData();
  const todayStr = getLocalDateString();
  const daysShort = i18n.t('daysShort') as unknown as string[];

  const weekDays = (() => {
    const date = new Date(currentDate);
    const weekday = date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() + (weekday === 0 ? -6 : 1 - weekday));

    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      return { date: day, dateStr: getLocalDateString(day) };
    });
  })();

  const shiftWeek = (days: number) => {
    const next = new Date(currentDate);
    next.setDate(currentDate.getDate() + days);
    onDateChange(next);
  };

  return (
    <View className="flex-1">
      <View className="flex-row justify-between items-center mb-4">
        <TouchableOpacity onPress={() => shiftWeek(-7)} className="p-2">
          <PrevIcon size={IconSize.lg} color={IconColor.cyan} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            onDateChange(new Date());
            onSelectDate(todayStr);
          }}
          className="items-center"
        >
          <Text className="text-white font-extrabold text-base">
            {weekDays[0].date.getDate()} {i18n.t(`months.${weekDays[0].date.getMonth()}`)} –{' '}
            {weekDays[6].date.getDate()} {i18n.t(`months.${weekDays[6].date.getMonth()}`)}
          </Text>
          <Text className="text-neonCyan text-[11px] font-bold mt-0.5">{i18n.t('today')}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => shiftWeek(7)} className="p-2">
          <NextIcon size={IconSize.lg} color={IconColor.cyan} />
        </TouchableOpacity>
      </View>

      {weekDays.map((item, index) => {
        const isSelected = item.dateStr === selectedDate;
        const isToday = item.dateStr === todayStr;
        const dayEvents = events.filter(
          e => e.startDate <= item.dateStr && e.endDate >= item.dateStr
        );
        const noteCount = data.notesByDate[item.dateStr]?.length ?? 0;
        const dayCounters = getCountersForDate(data.counters, item.dateStr);

        return (
          <View
            key={item.dateStr}
            className={`p-3.5 rounded-2xl border mb-3 ${
              isSelected
                ? 'bg-gray-900 border-neonCyan'
                : isToday
                  ? 'bg-gray-950 border-gray-700'
                  : 'bg-black border-gray-800'
            }`}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => onSelectDate(item.dateStr)}
              className="flex-row justify-between items-center pb-2.5 border-b border-gray-800/80"
            >
              <View className="flex-row items-center">
                <View
                  className={`w-9 h-9 rounded-xl items-center justify-center mr-2.5 ${
                    isToday
                      ? 'bg-neonCyan'
                      : isSelected
                        ? 'bg-cyan-950 border border-neonCyan'
                        : 'bg-gray-900'
                  }`}
                >
                  <Text
                    className={`font-extrabold text-sm ${
                      isToday ? 'text-black' : isSelected ? 'text-neonCyan' : 'text-white'
                    }`}
                  >
                    {item.date.getDate()}
                  </Text>
                </View>

                <View>
                  <Text className="text-gray-400 text-xs font-bold uppercase">
                    {daysShort[index]}
                  </Text>
                  <Text className="text-gray-500 text-[10px]">
                    {item.date.getDate()} {i18n.t(`months.${item.date.getMonth()}`)}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center">
                {noteCount > 0 && (
                  <View className="flex-row items-center bg-purple-950/70 px-2 py-1 rounded-lg border border-purple-700/50 mr-2">
                    <NoteIcon size={IconSize.xs} color={IconColor.purple} />
                    <Text className="text-purple-300 text-xs font-bold ml-1">{noteCount}</Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={() => onAddEvent(item.dateStr)}
                  className="w-7 h-7 rounded-full bg-gray-800 items-center justify-center"
                >
                  <AddIcon size={IconSize.xs} color={IconColor.cyan} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>

            {dayCounters.map(counter => (
              <View
                key={counter.id}
                className="bg-pink-950/40 border border-neonPink/60 p-2 rounded-xl flex-row items-center mt-2"
              >
                <Text className="text-base mr-2">{counter.icon || '❤️'}</Text>
                <Text className="text-neonPink font-bold text-xs">{counter.title}</Text>
              </View>
            ))}

            {dayEvents.length === 0 && dayCounters.length === 0 ? (
              <Text className="text-gray-600 text-xs italic mt-2.5 ml-1">
                {i18n.t('noEventsForDay')}
              </Text>
            ) : (
              <View className="mt-2.5">
                {dayEvents.map(event => {
                  const tint = colorForTarget(resolveTarget(event.target, data.myRole));
                  return (
                    <TouchableOpacity
                      key={event.id}
                      activeOpacity={0.8}
                      onPress={() => onEditEvent(event)}
                      style={{ borderLeftColor: event.color || IconColor.cyan, borderLeftWidth: 3 }}
                      className={`bg-gray-900/90 p-2.5 rounded-r-xl flex-row items-center mb-1.5 ${
                        event.completed ? 'opacity-60' : ''
                      }`}
                    >
                      <EventCompletionToggle
                        event={event}
                        onToggle={data.toggleEventCompleted}
                        size="sm"
                      />

                      <View className="flex-1 mx-2.5">
                        <Text
                          className={`font-bold text-xs ${
                            event.completed ? 'text-gray-500 line-through' : 'text-white'
                          }`}
                          numberOfLines={1}
                        >
                          {event.title}
                        </Text>
                        <Text className="text-gray-400 text-[10px] mt-0.5">
                          {event.isAllDay
                            ? i18n.t('allDay')
                            : `${event.startTime ?? ''} – ${event.endTime ?? ''}`}
                        </Text>
                      </View>

                      <View
                        className="px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: `${tint}20` }}
                      >
                        <Text className="text-[9px] font-bold" style={{ color: tint }}>
                          {labelForTarget(event.target, data.myRole, data.myName, data.partnerName)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}
