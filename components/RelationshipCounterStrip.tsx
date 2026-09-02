import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import i18n from '@/i18n';
import { RelationshipCounter, getDaysDifference } from '@/db/counters';
import { useCalendarData } from './CalendarDataProvider';
import CounterEditorModal from './CounterEditorModal';
import { AddIcon, HideIcon, IconColor, IconSize, PastIcon } from './ui/icons';

/**
 * Horizontal strip of relationship counters.
 *
 * Countdowns whose date has gone by are hidden by default — they would
 * otherwise sit here showing negative days — but stay reachable behind the
 * toggle so they can still be edited or deleted.
 */
export default function RelationshipCounterStrip() {
  const { counters } = useCalendarData();
  const [showPast, setShowPast] = useState(false);
  const [editing, setEditing] = useState<RelationshipCounter | null>(null);
  const [creating, setCreating] = useState(false);

  const isPastCountdown = (c: RelationshipCounter) =>
    c.type === 'until' && getDaysDifference(c.targetDate, 'until') < 0;

  const pastCount = counters.filter(isPastCountdown).length;
  const visible = showPast ? counters : counters.filter(c => !isPastCountdown(c));

  return (
    <View className="mb-4">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
        {visible.map(counter => {
          const diff = getDaysDifference(counter.targetDate, counter.type);
          const isUntil = counter.type === 'until';
          const past = isPastCountdown(counter);

          return (
            <TouchableOpacity
              key={counter.id}
              activeOpacity={0.85}
              onPress={() => setEditing(counter)}
              className={`mr-3 p-3.5 rounded-2xl border flex-row items-center ${
                past
                  ? 'bg-gray-900/60 border-gray-700 opacity-60'
                  : isUntil
                    ? 'bg-purple-950/40 border-purple-600/50'
                    : 'bg-pink-950/40 border-neonPink/50'
              }`}
            >
              <Text className="text-2xl mr-2.5">{counter.icon || '❤️'}</Text>
              <View>
                <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                  {counter.title}
                  {past ? ` · ${i18n.t('passed')}` : ''}
                </Text>
                <View className="flex-row items-baseline mt-0.5">
                  <Text
                    className={`text-xl font-extrabold mr-1.5 ${
                      isUntil ? 'text-purple-400' : 'text-neonPink'
                    }`}
                  >
                    {Math.abs(diff)}
                  </Text>
                  <Text className="text-gray-400 text-xs font-semibold">
                    {diff === 0
                      ? i18n.t('todayIsTheDay')
                      : i18n.t(
                          isUntil
                            ? diff > 0 ? 'daysLeft' : 'daysAgo'
                            : diff >= 0 ? 'daysAgo' : 'daysLeft'
                        )}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {pastCount > 0 && (
          <TouchableOpacity
            onPress={() => setShowPast(v => !v)}
            className="bg-gray-900 border border-gray-800 px-3.5 mr-3 rounded-2xl items-center justify-center flex-row"
          >
            {showPast ? (
              <HideIcon size={IconSize.sm} color={IconColor.muted} />
            ) : (
              <PastIcon size={IconSize.sm} color={IconColor.muted} />
            )}
            <Text className="text-gray-400 text-xs font-bold ml-1.5">
              {showPast ? i18n.t('hidePastCounters') : `${i18n.t('showPastCounters')} (${pastCount})`}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={() => setCreating(true)}
          className="bg-gray-900 border border-gray-800 px-3.5 rounded-2xl items-center justify-center flex-row"
        >
          <AddIcon size={IconSize.sm} color={IconColor.cyan} />
          <Text className="text-neonCyan text-xs font-bold ml-1.5">{i18n.t('addCounter')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <CounterEditorModal
        visible={creating || editing !== null}
        counter={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
    </View>
  );
}
