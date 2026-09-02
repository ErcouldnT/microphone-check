import React from 'react';
import { Tabs } from 'expo-router';

import i18n from '@/i18n';
import {
  CalendarIcon,
  IconColor,
  SettingsIcon,
  StatsIcon,
  TodayIcon,
} from '@/components/ui/icons';

const ACTIVE = IconColor.cyan;
const INACTIVE = '#5B5B66';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          backgroundColor: '#08080C',
          borderTopColor: '#1F1F27',
          borderTopWidth: 1,
          height: 64,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: i18n.t('today'),
          tabBarIcon: ({ color }) => <TodayIcon size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: i18n.t('calendar'),
          tabBarIcon: ({ color }) => <CalendarIcon size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: i18n.t('stats'),
          tabBarIcon: ({ color }) => <StatsIcon size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: i18n.t('settings'),
          tabBarIcon: ({ color }) => <SettingsIcon size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
