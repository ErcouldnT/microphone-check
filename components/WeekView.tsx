import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import i18n from '@/i18n';
import { CalendarEvent } from '@/db/events';

interface WeekViewProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (dateStr: string) => void;
  events: CalendarEvent[];
  sessionMap: Record<string, number>;
  onAddEvent: (dateStr: string) => void;
  onEditEvent: (event: CalendarEvent) => void;
}

export default function WeekView({
  currentDate,
  onDateChange,
  selectedDate,
  onSelectDate,
  events,
  sessionMap,
  onAddEvent,
  onEditEvent,
}: WeekViewProps) {
  // Get 7 days for the week of currentDate starting on Monday
  const getDaysOfWeek = (d: Date) => {
    const date = new Date(d);
    const dayOfWeek = date.getDay(); // 0(Sun) - 6(Sat)
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const monday = new Date(date);
    monday.setDate(date.getDate() + diffToMonday);

    const week = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      const str = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      week.push({ date: day, dateStr: str });
    }
    return week;
  };

  const weekDays = getDaysOfWeek(currentDate);
  const daysShort = i18n.t('daysShort') as unknown as string[];

  const handlePrevWeek = () => {
    const prev = new Date(currentDate);
    prev.setDate(currentDate.getDate() - 7);
    onDateChange(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentDate);
    next.setDate(currentDate.getDate() + 7);
    onDateChange(next);
  };

  return (
    <View className="flex-1">
      {/* Week Header Navigator */}
      <View className="flex-row justify-between items-center mb-4">
        <TouchableOpacity onPress={handlePrevWeek} className="p-2">
          <FontAwesome name="chevron-left" size={20} color="#00FFFF" />
        </TouchableOpacity>

        <Text className="text-white font-extrabold text-lg">
          {weekDays[0].date.getDate()} {i18n.t(`months.${weekDays[0].date.getMonth()}`)} -{' '}
          {weekDays[6].date.getDate()} {i18n.t(`months.${weekDays[6].date.getMonth()}`)}
        </Text>

        <TouchableOpacity onPress={handleNextWeek} className="p-2">
          <FontAwesome name="chevron-right" size={20} color="#00FFFF" />
        </TouchableOpacity>
      </View>

      {/* 7-Day Vertical Agenda */}
      <ScrollView showsVerticalScrollIndicator={false} className="space-y-3 pb-8">
        {weekDays.map((item, idx) => {
          const isSelected = item.dateStr === selectedDate;
          const isToday = new Date().toDateString() === item.date.toDateString();
          const dayEvents = events.filter(e => e.startDate <= item.dateStr && e.endDate >= item.dateStr);
          const micCount = sessionMap[item.dateStr] || 0;

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
              {/* Day Row Header */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => onSelectDate(item.dateStr)}
                className="flex-row justify-between items-center pb-2.5 border-b border-gray-800/80"
              >
                <View className="flex-row items-center">
                  <View
                    className={`w-9 h-9 rounded-xl items-center justify-center mr-2.5 ${
                      isToday ? 'bg-neonCyan' : isSelected ? 'bg-cyan-950 border border-neonCyan' : 'bg-gray-900'
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
                      {daysShort[idx]}
                    </Text>
                    <Text className="text-gray-500 text-[10px]">
                      {item.date.getDate()} {i18n.t(`months.${item.date.getMonth()}`)}
                    </Text>
                  </View>
                </View>

                <View className="flex-row items-center">
                  {micCount > 0 && (
                    <View className="flex-row items-center bg-cyan-950/80 px-2 py-1 rounded-lg border border-neonCyan/40 mr-2">
                      <FontAwesome name="microphone" size={10} color="#00FFFF" style={{ marginRight: 4 }} />
                      <Text className="text-neonCyan text-xs font-bold">{micCount}</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    onPress={() => onAddEvent(item.dateStr)}
                    className="w-7 h-7 rounded-full bg-gray-800 items-center justify-center"
                  >
                    <FontAwesome name="plus" size={10} color="#00FFFF" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>

              {/* Day Events */}
              {dayEvents.length === 0 ? (
                <Text className="text-gray-600 text-xs italic mt-2.5 ml-1">
                  {i18n.t('noEventsForDay')}
                </Text>
              ) : (
                <View className="mt-2.5 space-y-1.5">
                  {dayEvents.map((e) => (
                    <TouchableOpacity
                      key={e.id}
                      activeOpacity={0.8}
                      onPress={() => onEditEvent(e)}
                      style={{ borderLeftColor: e.color || '#00FFFF', borderLeftWidth: 3 }}
                      className="bg-gray-900/90 p-2.5 rounded-r-xl flex-row items-center justify-between mb-1.5"
                    >
                      <View className="flex-1 mr-2">
                        <Text className="text-white font-bold text-xs" numberOfLines={1}>
                          {e.title}
                        </Text>
                        <Text className="text-gray-400 text-[10px] mt-0.5">
                          {e.isAllDay ? i18n.t('allDay') : `${e.startTime || ''} - ${e.endTime || ''}`}
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
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
