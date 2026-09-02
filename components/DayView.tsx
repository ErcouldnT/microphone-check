import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import i18n from '@/i18n';
import { CalendarEvent } from '@/db/events';
import { RelationshipCounter, getCountersForDate, getDaysDifference } from '@/db/counters';
import { UserRole } from '@/db/settings';
import { NoteItem } from '@/db/notes';
import { getLocalDateString } from '@/utils/date';
import EventCompletionToggle, { CompletedBadge } from './EventCompletionToggle';

interface DayViewProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  events: CalendarEvent[];
  counters?: RelationshipCounter[];
  sessionMap: Record<string, number>;
  myRole?: UserRole;
  myName?: string;
  partnerName?: string;
  onAddEvent: (dateStr: string, time?: string) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onToggleCompleted?: (event: CalendarEvent) => void;
  dayNotes?: NoteItem[];
  onEditNote?: (dateStr: string) => void;
}

/** Every hour of the day, 00:00 through 23:00 (the last row covers 23:59). */
const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);

export default function DayView({
  currentDate,
  onDateChange,
  events,
  counters = [],
  sessionMap,
  myRole = 'male',
  myName = '',
  partnerName = '',
  onAddEvent,
  onEditEvent,
  onToggleCompleted,
  dayNotes = [],
  onEditNote,
}: DayViewProps) {
  const dateStr = getLocalDateString(currentDate);
  const todayStr = getLocalDateString(new Date());
  const micCount = sessionMap[dateStr] || 0;

  const dayEvents = events.filter(e => e.startDate <= dateStr && e.endDate >= dateStr);
  const dayCounters = getCountersForDate(counters, dateStr);
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

  const handleToday = () => {
    onDateChange(new Date());
  };

  const getFormattedDate = () => {
    const day = currentDate.getDate();
    const month = i18n.t(`months.${currentDate.getMonth()}`);
    const year = currentDate.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const getTargetBadgeLabel = (target: string) => {
    if (target === 'both') return i18n.t('forBoth');
    if (target === 'male') return myRole === 'male' ? (myName || `${i18n.t('forYou')} 👨`) : (partnerName || `${i18n.t('forPartner')} 👨`);
    if (target === 'female') return myRole === 'female' ? (myName || `${i18n.t('forYou')} 👩`) : (partnerName || `${i18n.t('forPartner')} 👩`);
    if (target === 'you') return i18n.t('forYou');
    if (target === 'partner') return i18n.t('forPartner');
    return target;
  };

  return (
    <View className="flex-1">
      {/* Day Navigator */}
      <View className="flex-row justify-between items-center mb-4">
        <TouchableOpacity onPress={handlePrevDay} className="p-2">
          <FontAwesome name="chevron-left" size={20} color="#00FFFF" />
        </TouchableOpacity>

        <TouchableOpacity onPress={handleToday} className="items-center">
          <Text className="text-white font-extrabold text-lg">{getFormattedDate()}</Text>
          {dateStr === todayStr && (
            <Text className="text-neonCyan text-[11px] font-bold mt-0.5">{i18n.t('today')}</Text>
          )}
          {micCount > 0 && (
            <View className="flex-row items-center bg-cyan-950/80 px-2.5 py-0.5 rounded-full border border-neonCyan/40 mt-1">
              <FontAwesome name="microphone" size={10} color="#00FFFF" style={{ marginRight: 4 }} />
              <Text className="text-neonCyan text-[11px] font-bold">{micCount} mikrofon</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleNextDay} className="p-2">
          <FontAwesome name="chevron-right" size={20} color="#00FFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Milestone Card on this Day */}
        {dayCounters.length > 0 && (
          <View className="mb-4 space-y-2">
            {dayCounters.map(c => {
              const diff = getDaysDifference(c.targetDate, c.type);
              const isUntil = c.type === 'until';

              return (
                <View
                  key={c.id}
                  className="bg-pink-950/40 border border-neonPink/60 p-3.5 rounded-2xl flex-row items-center justify-between mb-2"
                >
                  <View className="flex-row items-center flex-1 mr-2">
                    <Text className="text-2xl mr-2.5">{c.icon || '❤️'}</Text>
                    <View className="flex-1">
                      <Text className="text-neonPink font-extrabold text-sm">{c.title}</Text>
                      <Text className="text-gray-400 text-xs mt-0.5">
                        {isUntil
                          ? (diff === 0 ? i18n.t('todayIsTheDay') : `${Math.abs(diff)} ${i18n.t('daysLeft')}`)
                          : (diff === 0 ? i18n.t('todayIsTheDay') : `${Math.abs(diff)} ${i18n.t('daysAgo')}`)}
                      </Text>
                    </View>
                  </View>
                  <View className="bg-pink-950 border border-neonPink px-2.5 py-1 rounded-full">
                    <Text className="text-neonPink text-[10px] font-bold">{i18n.t('milestone')}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Daily Notes (a day can hold several) */}
        {dayNotes.length > 0 && (
          <View className="mb-4">
            <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">
              {i18n.t('notes')} ({dayNotes.length})
            </Text>
            {dayNotes.map(note => (
              <TouchableOpacity
                key={note.noteId}
                onPress={() => onEditNote && onEditNote(dateStr)}
                className="bg-purple-950/50 border border-purple-800/60 p-3.5 rounded-2xl mb-2 flex-row items-center justify-between"
              >
                <View className="flex-row items-center flex-1 mr-2">
                  <FontAwesome name="pencil-square" size={16} color="#c084fc" style={{ marginRight: 8 }} />
                  <Text className="text-purple-200 text-xs flex-1" numberOfLines={2}>
                    {note.content}
                  </Text>
                </View>
                <FontAwesome name="chevron-right" size={12} color="#c084fc" />
              </TouchableOpacity>
            ))}
          </View>
        )}

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
                className={`border p-3 rounded-xl mb-2 flex-row justify-between items-center ${
                  e.completed ? 'opacity-60' : ''
                }`}
              >
                <View className="mr-3">
                  <EventCompletionToggle event={e} onToggle={onToggleCompleted} />
                </View>
                <View className="flex-1 mr-2">
                  <Text
                    style={{ color: e.color || '#00FFFF' }}
                    className={`font-extrabold text-sm ${e.completed ? 'line-through' : ''}`}
                  >
                    {e.title}
                  </Text>
                  {e.startDate !== e.endDate && (
                    <Text className="text-gray-400 text-[10px] mt-0.5">
                      {e.startDate} ➔ {e.endDate}
                    </Text>
                  )}
                </View>
                <View
                  className="px-2 py-0.5 rounded text-[9px]"
                  style={{ backgroundColor: `${e.color || '#00FFFF'}30` }}
                >
                  <Text style={{ color: e.color || '#00FFFF' }} className="text-[10px] font-bold">
                    {getTargetBadgeLabel(e.target)}
                  </Text>
                </View>
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
                        className={`bg-gray-900 p-2.5 rounded-r-xl mb-1.5 flex-row justify-between items-center ${
                          e.completed ? 'opacity-60' : ''
                        }`}
                      >
                        <View className="mr-2.5">
                          <EventCompletionToggle event={e} onToggle={onToggleCompleted} size="sm" />
                        </View>
                        <View className="flex-1 mr-2">
                          <Text
                            className={`text-white font-bold text-xs ${e.completed ? 'line-through text-gray-500' : ''}`}
                            numberOfLines={1}
                          >
                            {e.title}
                          </Text>
                          <Text className="text-gray-400 text-[10px]">
                            {e.startTime} - {e.endTime}
                          </Text>
                        </View>
                        <View
                          className="px-1.5 py-0.5 rounded text-[9px]"
                          style={{ backgroundColor: `${e.color || '#00FFFF'}20` }}
                        >
                          <Text style={{ color: e.color || '#00FFFF' }} className="text-[9px] font-bold">
                            {getTargetBadgeLabel(e.target)}
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
