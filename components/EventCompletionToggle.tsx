import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import i18n from '@/i18n';
import { CalendarEvent } from '@/db/events';

interface EventCompletionToggleProps {
  event: CalendarEvent;
  onToggle?: (event: CalendarEvent) => void;
  size?: 'sm' | 'md';
}

/**
 * Round checkbox used in every schedule list to mark a plan done / not done.
 * Renders as a static indicator when no `onToggle` handler is supplied.
 */
export default function EventCompletionToggle({
  event,
  onToggle,
  size = 'md',
}: EventCompletionToggleProps) {
  const isDone = Boolean(event.completed);
  const box = size === 'sm' ? 'w-5 h-5' : 'w-6 h-6';
  const icon = size === 'sm' ? 9 : 11;

  const content = (
    <View
      className={`${box} rounded-full border-2 items-center justify-center ${
        isDone ? 'bg-green-500 border-green-500' : 'border-gray-600 bg-transparent'
      }`}
    >
      {isDone && <FontAwesome name="check" size={icon} color="#000" />}
    </View>
  );

  if (!onToggle) return content;

  return (
    <TouchableOpacity
      onPress={() => onToggle(event)}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isDone }}
      accessibilityLabel={isDone ? i18n.t('markNotCompleted') : i18n.t('markCompleted')}
    >
      {content}
    </TouchableOpacity>
  );
}

/** Small "Completed" pill shown next to a finished plan's title. */
export function CompletedBadge() {
  return (
    <View className="bg-green-950/80 border border-green-500/50 px-2 py-0.5 rounded-md">
      <Text className="text-[10px] text-green-400 font-bold">✓ {i18n.t('completed')}</Text>
    </View>
  );
}
