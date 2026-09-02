import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

import i18n from '@/i18n';
import { useCalendarData } from './CalendarDataProvider';
import { IconColor, IconSize, OfflineIcon, OnlineIcon, PartnersIcon } from './ui/icons';

/**
 * Compact pairing/connection indicator. Tapping it goes to settings, where the
 * room can actually be managed.
 */
export default function SyncStatusPill() {
  const router = useRouter();
  const { syncStatus, roomCode } = useCalendarData();

  const goToSettings = () => router.push('/(tabs)/settings');

  if (!roomCode) {
    return (
      <TouchableOpacity
        onPress={goToSettings}
        className="flex-row items-center bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-full"
      >
        <PartnersIcon size={IconSize.sm} color={IconColor.cyan} />
        <Text className="text-neonCyan text-xs font-bold ml-1.5">{i18n.t('pairWithFriend')}</Text>
      </TouchableOpacity>
    );
  }

  const connected = syncStatus === 'connected';
  const connecting = syncStatus === 'connecting';
  const dotColor = connected ? 'bg-green-400' : connecting ? 'bg-yellow-400' : 'bg-red-400';

  return (
    <TouchableOpacity
      onPress={goToSettings}
      className="flex-row items-center bg-gray-900 border border-neonCyan/40 px-3 py-1.5 rounded-full"
    >
      <View className={`w-2 h-2 rounded-full ${dotColor} mr-2`} />
      <Text className="text-white text-xs font-bold tracking-wider mr-1.5">{roomCode}</Text>
      {connected ? (
        <OnlineIcon size={IconSize.xs} color={IconColor.cyan} />
      ) : (
        <OfflineIcon size={IconSize.xs} color={IconColor.muted} />
      )}
    </TouchableOpacity>
  );
}
