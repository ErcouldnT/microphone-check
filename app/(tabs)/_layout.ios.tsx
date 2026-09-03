import React from 'react';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';

import i18n from '@/i18n';
import { IconColor } from '@/components/ui/icons';

/**
 * iOS uses the platform's own tab bar rather than the JS-drawn one.
 *
 * Going through UITabBarController means the tab bar is whatever the OS
 * currently draws — including the Liquid Glass treatment on iOS 26 — and it
 * picks up the system behaviours (minimise on scroll, accessibility, haptics)
 * for free. Android keeps the shared JS bar in `_layout.tsx`.
 */
export default function NativeTabLayout() {
  return (
    <NativeTabs
      // Keep the Liquid Glass material but in its dark variant: an explicit
      // backgroundColor would flatten the glass, while the default follows the
      // system appearance and came up white against this app.
      blurEffect="systemChromeMaterialDark"
      tintColor={IconColor.cyan}
      iconColor={{ default: '#8A8A94', selected: IconColor.cyan }}
      labelStyle={{ color: '#8A8A94' }}
      badgeBackgroundColor={IconColor.pink}
    >
      <NativeTabs.Trigger name="index">
        <Icon sf="sparkles" />
        <Label>{i18n.t('today')}</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="calendar">
        <Icon sf="calendar" />
        <Label>{i18n.t('calendar')}</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="stats">
        <Icon sf="chart.bar" />
        <Label>{i18n.t('stats')}</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <Icon sf="gearshape" />
        <Label>{i18n.t('settings')}</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
