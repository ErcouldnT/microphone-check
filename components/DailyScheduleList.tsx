import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import i18n from '@/i18n';
import { CalendarEvent } from '@/db/events';
import { RelationshipCounter, getDaysDifference } from '@/db/counters';
import { UserRole } from '@/db/settings';
import { NoteItem } from '@/db/notes';
import EventCompletionToggle, { CompletedBadge } from './EventCompletionToggle';

interface DailyScheduleListProps {
  selectedDate: string; // YYYY-MM-DD
  events: CalendarEvent[];
  counters?: RelationshipCounter[];
  myRole?: UserRole;
  myName?: string;
  partnerName?: string;
  onAddEvent: (date: string) => void;
  onEditEvent: (event: CalendarEvent) => void;
  onToggleCompleted?: (event: CalendarEvent) => void;
  dayNotes?: NoteItem[];
  onEditNote?: (date: string) => void;
}

export default function DailyScheduleList({
  selectedDate,
  events,
  counters = [],
  myRole = 'male',
  myName = '',
  partnerName = '',
  onAddEvent,
  onEditEvent,
  onToggleCompleted,
  dayNotes = [],
  onEditNote,
}: DailyScheduleListProps) {
  // Format localized date
  const getFormattedDate = () => {
    if (!selectedDate) return '';
    const [y, m, d] = selectedDate.split('-').map(Number);
    const monthName = i18n.t(`months.${m - 1}`);
    return `${d} ${monthName} ${y}`;
  };

  const getTargetBadge = (target: string) => {
    const partnerRole = myRole === 'male' ? 'female' : 'male';
    const isMe = (target === myRole) || (target === 'you');
    const isPartner = (target === partnerRole) || (target === 'partner');

    if (target === 'both') {
      return (
        <View className="bg-yellow-950/80 border border-yellow-400/40 px-2 py-0.5 rounded-md flex-row items-center">
          <Text className="text-[10px] text-yellow-400 font-bold">✨ {i18n.t('forBoth')}</Text>
        </View>
      );
    }

    if (target === 'male' || (isMe && myRole === 'male') || (isPartner && myRole === 'female')) {
      const label = myRole === 'male'
        ? (myName ? `${myName} (Sen)` : `👤 ${i18n.t('forYou')} (👨)`)
        : (partnerName ? `${partnerName} (Partnerin)` : `💖 ${i18n.t('forPartner')} (👨)`);

      return (
        <View className="bg-cyan-950/80 border border-neonCyan/40 px-2 py-0.5 rounded-md flex-row items-center">
          <Text className="text-[10px] text-neonCyan font-bold">{label}</Text>
        </View>
      );
    }

    if (target === 'female' || (isMe && myRole === 'female') || (isPartner && myRole === 'male')) {
      const label = myRole === 'female'
        ? (myName ? `${myName} (Sen)` : `👤 ${i18n.t('forYou')} (👩)`)
        : (partnerName ? `${partnerName} (Partnerin)` : `💖 ${i18n.t('forPartner')} (👩)`);

      return (
        <View className="bg-pink-950/80 border border-neonPink/40 px-2 py-0.5 rounded-md flex-row items-center">
          <Text className="text-[10px] text-neonPink font-bold">{label}</Text>
        </View>
      );
    }

    return (
      <View className="bg-cyan-950/80 border border-neonCyan/40 px-2 py-0.5 rounded-md flex-row items-center">
        <Text className="text-[10px] text-neonCyan font-bold">👤 {target}</Text>
      </View>
    );
  };

  return (
    <View className="bg-gray-950 border border-gray-800 rounded-3xl p-4 mt-6 mb-8">
      {/* Header */}
      <View className="flex-row justify-between items-center mb-3 pb-3 border-b border-gray-800">
        <View>
          <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider">
            {i18n.t('scheduleForDay')}
          </Text>
          <Text className="text-white font-extrabold text-lg mt-0.5">
            {getFormattedDate()}
          </Text>
        </View>

        <View className="flex-row items-center gap-2">
          {onEditNote && (
            <TouchableOpacity
              onPress={() => onEditNote(selectedDate)}
              className="bg-neonPink/20 border border-neonPink px-2.5 py-1.5 rounded-full flex-row items-center"
            >
              <FontAwesome name="pencil" size={11} color="#FF007F" style={{ marginRight: 4 }} />
              <Text className="text-neonPink text-xs font-bold">Not</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => onAddEvent(selectedDate)}
            className="bg-neonCyan/20 border border-neonCyan px-3 py-1.5 rounded-full flex-row items-center"
          >
            <FontAwesome name="plus" size={11} color="#00FFFF" style={{ marginRight: 5 }} />
            <Text className="text-neonCyan text-xs font-bold">{i18n.t('addEvent')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Milestone Counters on this day (Automatic injection) */}
      {counters.length > 0 && (
        <View className="mb-3 space-y-2">
          {counters.map(c => {
            const diff = getDaysDifference(c.targetDate, c.type);
            const isUntil = c.type === 'until';

            return (
              <View
                key={c.id}
                className="bg-pink-950/40 border border-neonPink/60 p-3 rounded-2xl flex-row items-center justify-between mb-2"
              >
                <View className="flex-row items-center flex-1 mr-2">
                  <Text className="text-xl mr-2.5">{c.icon || '❤️'}</Text>
                  <View className="flex-1">
                    <Text className="text-neonPink font-extrabold text-xs">{c.title}</Text>
                    <Text className="text-gray-400 text-[10px] mt-0.5">
                      {isUntil
                        ? (diff === 0 ? i18n.t('todayIsTheDay') : `${Math.abs(diff)} ${i18n.t('daysLeft')}`)
                        : (diff === 0 ? i18n.t('todayIsTheDay') : `${Math.abs(diff)} ${i18n.t('daysAgo')}`)}
                    </Text>
                  </View>
                </View>
                <View className="bg-pink-950 border border-neonPink px-2 py-0.5 rounded-full">
                  <Text className="text-neonPink text-[10px] font-bold">{i18n.t('milestone')}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Daily note previews — a day can hold several */}
      {dayNotes.map((note, index) => (
        <TouchableOpacity
          key={note.noteId}
          onPress={() => onEditNote && onEditNote(selectedDate)}
          className="bg-purple-950/40 border border-purple-800/60 p-3 rounded-2xl mb-2 flex-row items-center justify-between"
        >
          <View className="flex-row items-center flex-1 mr-2">
            <FontAwesome name="pencil-square" size={14} color="#c084fc" style={{ marginRight: 8 }} />
            {dayNotes.length > 1 && (
              <Text className="text-purple-400/70 text-[11px] font-bold mr-1.5">{index + 1}.</Text>
            )}
            <Text className="text-purple-200 text-xs flex-1" numberOfLines={2}>
              {note.content}
            </Text>
          </View>
          <FontAwesome name="chevron-right" size={10} color="#c084fc" />
        </TouchableOpacity>
      ))}

      {/* Events List */}
      {events.length === 0 && counters.length === 0 && dayNotes.length === 0 ? (
        <View className="py-6 items-center justify-center">
          <FontAwesome name="calendar-o" size={28} color="#444" style={{ marginBottom: 8 }} />
          <Text className="text-gray-500 text-sm font-medium text-center mb-3">
            {i18n.t('noEventsForDay')}
          </Text>
          <TouchableOpacity
            onPress={() => onAddEvent(selectedDate)}
            className="bg-gray-900 border border-gray-700 px-4 py-2 rounded-xl flex-row items-center"
          >
            <FontAwesome name="plus" size={12} color="#00FFFF" style={{ marginRight: 6 }} />
            <Text className="text-white text-xs font-bold">{i18n.t('addEvent')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View className="space-y-2">
          {events.map((e) => {
            const isMultiDay = e.startDate !== e.endDate;
            return (
              <TouchableOpacity
                key={e.id}
                activeOpacity={0.8}
                onPress={() => onEditEvent(e)}
                className={`bg-gray-900 border border-gray-800/80 p-3 rounded-2xl flex-row items-center justify-between mb-2 ${
                  e.completed ? 'opacity-60' : ''
                }`}
              >
                <View className="flex-row items-center flex-1 mr-2">
                  <View className="mr-3">
                    <EventCompletionToggle event={e} onToggle={onToggleCompleted} />
                  </View>

                  {/* Left Colored Stripe */}
                  <View
                    className="w-2.5 h-10 rounded-full mr-3"
                    style={{ backgroundColor: e.color || '#00FFFF' }}
                  />

                  <View className="flex-1">
                    <View className="flex-row items-center mb-1 flex-wrap gap-1">
                      <Text
                        className={`font-bold text-sm mr-1 ${
                          e.completed ? 'text-gray-500 line-through' : 'text-white'
                        }`}
                        numberOfLines={1}
                      >
                        {e.title}
                      </Text>
                      {getTargetBadge(e.target)}
                      {e.completed ? <CompletedBadge /> : null}
                    </View>

                    {/* Time / Span details */}
                    <View className="flex-row items-center">
                      <FontAwesome name="clock-o" size={10} color="#888" style={{ marginRight: 4 }} />
                      <Text className="text-gray-400 text-xs">
                        {e.isAllDay
                          ? isMultiDay
                            ? `${e.startDate.substring(5)} ➔ ${e.endDate.substring(5)} (${i18n.t('allDay')})`
                            : i18n.t('allDay')
                          : `${e.startTime || ''} - ${e.endTime || ''}`}
                      </Text>
                    </View>

                    {/* Description preview */}
                    {e.description ? (
                      <Text className="text-gray-500 text-[11px] mt-1" numberOfLines={1}>
                        {e.description}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <FontAwesome name="angle-right" size={16} color="#666" />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}
