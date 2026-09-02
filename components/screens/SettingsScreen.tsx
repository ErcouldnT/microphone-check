import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import i18n from '@/i18n';
import { UserRole, setMyName, setMyRole, setPartnerName } from '@/db/settings';
import { useCalendarData } from '@/components/CalendarDataProvider';
import { useToast } from '@/components/ui/Toast';
import PairingModal from '@/components/PairingModal';
import {
  CalendarIcon,
  HeartIcon,
  IconColor,
  IconSize,
  MeIcon,
  PartnersIcon,
  SaveIcon,
  SyncIcon,
} from '@/components/ui/icons';
import {
  isDeviceSyncEnabled,
  requestCalendarAccess,
  setDeviceSyncEnabled,
  syncEventsToDeviceCalendar,
} from '@/services/deviceCalendarSync';

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View className="bg-gray-950 border border-gray-800 rounded-3xl p-4 mb-4">
      <View className="flex-row items-center mb-3">
        {icon}
        <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-2">
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

/**
 * Everything that configures the app: who is using this device, the shared
 * room, and whether plans are mirrored into the phone's calendar. These used
 * to be squeezed into the calendar header.
 */
export default function SettingsScreen() {
  const data = useCalendarData();
  const { showToast } = useToast();

  const [role, setRole] = useState<UserRole>(data.myRole);
  const [name, setName] = useState(data.myName);
  const [partner, setPartner] = useState(data.partnerName);
  const [pairingVisible, setPairingVisible] = useState(false);

  const [calendarSync, setCalendarSync] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setRole(data.myRole);
    setName(data.myName);
    setPartner(data.partnerName);
  }, [data.myRole, data.myName, data.partnerName]);

  useEffect(() => {
    isDeviceSyncEnabled().then(setCalendarSync);
  }, []);

  const saveProfile = async () => {
    await setMyRole(role);
    await setMyName(name.trim());
    await setPartnerName(partner.trim());
    await data.reload();
    showToast({ title: String(i18n.t('save')), variant: 'success' });
  };

  const toggleCalendarSync = async (next: boolean) => {
    if (next) {
      const granted = await requestCalendarAccess();
      if (!granted) {
        showToast({ title: String(i18n.t('calendarPermissionDenied')), variant: 'warning' });
        return;
      }
    }
    setCalendarSync(next);
    await setDeviceSyncEnabled(next);
  };

  const runCalendarSync = async () => {
    const granted = await requestCalendarAccess();
    if (!granted) {
      showToast({ title: String(i18n.t('calendarPermissionDenied')), variant: 'warning' });
      return;
    }

    setSyncing(true);
    try {
      const { synced } = await syncEventsToDeviceCalendar(data.events);
      showToast({
        title: String(i18n.t('calendarSync')),
        message: String(i18n.t('calendarSynced', { count: synced })),
        variant: 'success',
      });
    } catch (e: any) {
      Alert.alert(String(i18n.t('error')), e?.message ?? 'Calendar sync failed');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top', 'left', 'right']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Text className="text-white text-2xl font-extrabold mb-5">{i18n.t('settings')}</Text>

        <Section
          title={String(i18n.t('profile'))}
          icon={<MeIcon size={IconSize.md} color={IconColor.cyan} />}
        >
          <Text className="text-gray-400 text-xs font-bold uppercase mb-1.5">
            {i18n.t('whoAreYou')}
          </Text>
          <View className="flex-row gap-2 mb-4">
            {(['male', 'female'] as const).map(option => {
              const active = role === option;
              const tint = option === 'male' ? IconColor.cyan : IconColor.pink;
              return (
                <TouchableOpacity
                  key={option}
                  onPress={() => setRole(option)}
                  className="flex-1 py-3 rounded-xl border items-center justify-center"
                  style={{
                    borderColor: active ? tint : '#1F2937',
                    backgroundColor: active ? `${tint}22` : 'rgba(0,0,0,0.6)',
                  }}
                >
                  <Text
                    className="text-xs font-bold"
                    style={{ color: active ? tint : IconColor.muted }}
                  >
                    {i18n.t(option === 'male' ? 'maleOption' : 'femaleOption')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text className="text-gray-400 text-xs font-bold uppercase mb-1.5">
            {i18n.t('myName')}
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={String(i18n.t('namePlaceholder'))}
            placeholderTextColor="#555"
            className="bg-black border border-gray-800 text-white px-3.5 py-2.5 rounded-xl text-sm font-semibold mb-3"
          />

          <Text className="text-gray-400 text-xs font-bold uppercase mb-1.5">
            {i18n.t('partnerNameLabel')}
          </Text>
          <TextInput
            value={partner}
            onChangeText={setPartner}
            placeholder={String(i18n.t('namePlaceholder'))}
            placeholderTextColor="#555"
            className="bg-black border border-gray-800 text-white px-3.5 py-2.5 rounded-xl text-sm font-semibold mb-4"
          />

          <TouchableOpacity
            onPress={saveProfile}
            className="bg-neonCyan py-3 rounded-xl items-center justify-center flex-row"
          >
            <SaveIcon size={IconSize.sm} color="#000" />
            <Text className="text-black font-extrabold text-sm uppercase tracking-wider ml-2">
              {i18n.t('save')}
            </Text>
          </TouchableOpacity>
        </Section>

        <Section
          title={String(i18n.t('sharedCalendar'))}
          icon={<PartnersIcon size={IconSize.md} color={IconColor.pink} />}
        >
          {data.roomCode ? (
            <View className="flex-row items-center justify-between mb-3">
              <View>
                <Text className="text-gray-500 text-[11px] uppercase font-bold">
                  {i18n.t('activeRoom')}
                </Text>
                <Text className="text-white text-lg font-extrabold tracking-widest">
                  {data.roomCode}
                </Text>
              </View>
              <View className="flex-row items-center bg-gray-900 px-2.5 py-1 rounded-full border border-gray-700">
                <View
                  className={`w-2 h-2 rounded-full mr-1.5 ${
                    data.syncStatus === 'connected' ? 'bg-green-400' : 'bg-yellow-400'
                  }`}
                />
                <Text className="text-gray-300 text-[11px] font-bold">
                  {i18n.t(data.syncStatus === 'connected' ? 'live' : 'connecting')}
                </Text>
              </View>
            </View>
          ) : (
            <Text className="text-gray-500 text-xs mb-3">{i18n.t('shareCodeHelp')}</Text>
          )}

          <TouchableOpacity
            onPress={() => setPairingVisible(true)}
            className="bg-gray-900 border border-gray-700 py-3 rounded-xl items-center justify-center flex-row"
          >
            <HeartIcon size={IconSize.sm} color={IconColor.pink} />
            <Text className="text-white text-xs font-bold ml-2">
              {data.roomCode ? i18n.t('sharedCalendar') : i18n.t('pairWithFriend')}
            </Text>
          </TouchableOpacity>
        </Section>

        <Section
          title={String(i18n.t('calendarSync'))}
          icon={<CalendarIcon size={IconSize.md} color={IconColor.purple} />}
        >
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-gray-300 text-xs font-bold flex-1 mr-3">
              {i18n.t('syncToDeviceCalendar')}
            </Text>
            <Switch
              value={calendarSync}
              onValueChange={toggleCalendarSync}
              trackColor={{ false: '#374151', true: IconColor.purple }}
              thumbColor={calendarSync ? '#000' : '#9ca3af'}
            />
          </View>

          <Text className="text-gray-600 text-[11px] leading-relaxed mb-3">
            {i18n.t('syncToDeviceCalendarHelp')}
          </Text>

          <TouchableOpacity
            onPress={runCalendarSync}
            disabled={syncing}
            className={`border py-3 rounded-xl items-center justify-center flex-row ${
              syncing ? 'bg-gray-900 border-gray-800' : 'bg-purple-500/15 border-purple-500'
            }`}
          >
            <SyncIcon size={IconSize.sm} color={syncing ? IconColor.faint : IconColor.purple} />
            <Text
              className="text-xs font-bold ml-2"
              style={{ color: syncing ? IconColor.faint : IconColor.purple }}
            >
              {i18n.t('syncNow')}
            </Text>
          </TouchableOpacity>
        </Section>
      </ScrollView>

      <PairingModal visible={pairingVisible} onClose={() => setPairingVisible(false)} />
    </SafeAreaView>
  );
}
