import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import i18n from '@/i18n';
import { CalendarEvent } from '@/db/events';

interface DayViewProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  events: CalendarEvent[];
  sessionMap: Record<string, number>;
  onAddEvent: (dateStr: string, time?: string) => void;
  onEditEvent: (event: CalendarEvent) => void;
  dailyNote?: string;
  onEditNote?: (dateStr: string) => void;
}

const HOURS = [
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00',
  '20:00', '21:00', '22:00', '23:00'
];

export default function DayView({
  currentDate,
  onDateChange,
  events,
  sessionMap,
  onAddEvent,
  onEditEvent,
  dailyNote,
  onEditNote,
}: DayViewProps) {
  const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
  const micCount = sessionMap[dateStr] || 0;

  const dayEvents = events.filter(e => e.startDate <= dateStr && e.endDate >= dateStr);
  const allDayEvents = dayEvents.filter(e => e.isAllDay);
  const timedEvents = dayEvents.filter(e => !e.isAllDay);

  const handlePrevDay = () => {
    const prev = new Date(currentDate);
    prev.setDate(currentDate.getDate() - 1);
    onDateChange(prev);
  };

  const handleNextDay = () => {
    const next = new Date(currentDate);
    next.setDate(currentDate.getDate() + 1);
    onDateChange(next);
  };

  const getFormattedDate = () => {
    const day = currentDate.getDate();
    const month = i18n.t(`months.${currentDate.getMonth()}`);
    const year = currentDate.getFullYear();
    return `${day} ${month} ${year}`;
  };

  return (
    <View className="flex-1">
      {/* Day Navigator */}
      <View className="flex-row justify-between items-center mb-4">
        <TouchableOpacity onPress={handlePrevDay} className="p-2">
          <FontAwesome name="chevron-left" size={20} color="#00FFFF" />
        </TouchableOpacity>

        <View className="items-center">
          <Text className="text-white font-extrabold text-lg">{getFormattedDate()}</Text>
          {micCount > 0 && (
            <View className="flex-row items-center bg-cyan-950/80 px-2.5 py-0.5 rounded-full border border-neonCyan/40 mt-1">
              <FontAwesome name="microphone" size={10} color="#00FFFF" style={{ marginRight: 4 }} />
              <Text className="text-neonCyan text-[11px] font-bold">{micCount} mikrofon</Text>
            </View>
          )}
        </View>

        <TouchableOpacity onPress={handleNextDay} className="p-2">
          <FontAwesome name="chevron-right" size={20} color="#00FFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Daily Note Banner */}
        {dailyNote ? (
          <TouchableOpacity
            onPress={() => onEditNote && onEditNote(dateStr)}
            className="bg-purple-950/50 border border-purple-800/60 p-3.5 rounded-2xl mb-4 flex-row items-center justify-between"
          >
            <View className="flex-row items-center flex-1 mr-2">
              <FontAwesome name="pencil-square" size={16} color="#c084fc" style={{ marginRight: 8 }} />
              <Text className="text-purple-200 text-xs flex-1" numberOfLines={2}>
                {dailyNote}
              </Text>
            </View>
            <FontAwesome name="chevron-right" size={12} color="#c084fc" />
          </TouchableOpacity>
        ) : null}

        {/* All-Day Events Section */}
        {allDayEvents.length > 0 && (
          <View className="mb-4">
            <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">
              {i18n.t('allDay')} ({allDayEvents.length})
            </Text>
            {allDayEvents.map((e) => (
              <TouchableOpacity
                key={e.id}
                onPress={() => onEditEvent(e)}
                style={{ backgroundColor: `${e.color || '#00FFFF'}25`, borderColor: e.color || '#00FFFF' }}
                className="border p-3 rounded-xl mb-2 flex-row justify-between items-center"
              >
                <View className="flex-1 mr-2">
                  <Text style={{ color: e.color || '#00FFFF' }} className="font-extrabold text-sm">
                    {e.title}
                  </Text>
                  {e.startDate !== e.endDate && (
                    <Text className="text-gray-400 text-[10px] mt-0.5">
                      {e.startDate} ➔ {e.endDate}
                    </Text>
                  )}
                </View>
                <FontAwesome name="chevron-right" size={10} color={e.color || '#00FFFF'} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Hourly Timeline */}
        <View className="border-t border-gray-800 pt-3">
          {HOURS.map((hour) => {
            const hourEvents = timedEvents.filter(e => e.startTime?.startsWith(hour.substring(0, 2)));

            return (
              <View key={hour} className="flex-row min-h-[56px] border-b border-gray-900 items-start py-2">
                {/* Time Label */}
                <Text className="text-gray-500 font-mono text-xs w-14 mt-1">{hour}</Text>

                {/* Event or Add Placeholder */}
                <View className="flex-1 pl-2">
                  {hourEvents.length > 0 ? (
                    hourEvents.map((e) => (
                      <TouchableOpacity
                        key={e.id}
                        onPress={() => onEditEvent(e)}
                        style={{ borderLeftColor: e.color || '#00FFFF', borderLeftWidth: 3 }}
                        className="bg-gray-900 p-2.5 rounded-r-xl mb-1.5 flex-row justify-between items-center"
                      >
                        <View className="flex-1 mr-2">
                          <Text className="text-white font-bold text-xs" numberOfLines={1}>{e.title}</Text>
                          <Text className="text-gray-400 text-[10px]">
                            {e.startTime} - {e.endTime}
                          </Text>
                        </View>
                        <View
                          className="px-1.5 py-0.5 rounded text-[9px]"
                          style={{ backgroundColor: `${e.color || '#00FFFF'}20` }}
                        >
                          <Text style={{ color: e.color || '#00FFFF' }} className="text-[9px] font-bold">
                            {e.target === 'you' ? i18n.t('forYou') : e.target === 'partner' ? i18n.t('forPartner') : i18n.t('forBoth')}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))
                  ) : (
                    <TouchableOpacity
                      onPress={() => onAddEvent(dateStr, hour)}
                      className="h-9 rounded-lg border border-dashed border-gray-800/60 justify-center px-3"
                    >
                      <Text className="text-gray-700 text-[11px]">+ {i18n.t('addEvent')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
