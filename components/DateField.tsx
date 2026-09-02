import React, { useState } from 'react';
import { Modal, Platform, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import i18n from '@/i18n';
import { getLocalDateString, parseLocalDate } from '@/utils/date';
import { CalendarIcon, IconColor, IconSize } from './ui/icons';

interface DateFieldProps {
  label: string;
  /** "YYYY-MM-DD" */
  value: string;
  onChange: (value: string) => void;
  /** Earliest selectable day, "YYYY-MM-DD". */
  minimumDate?: string;
}

/**
 * Tappable date field backed by the platform's native date picker.
 *
 * Mirrors TimeField: Android gets the system dialog, iOS gets the inline
 * picker in a confirm sheet since it has no dialog of its own.
 */
export default function DateField({ label, value, onChange, minimumDate }: DateFieldProps) {
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState<Date>(() => parseLocalDate(value || getLocalDateString()));

  const open = () => {
    setDraft(parseLocalDate(value || getLocalDateString()));
    setVisible(true);
  };

  const handleAndroidChange = (event: DateTimePickerEvent, date?: Date) => {
    setVisible(false);
    if (event.type === 'set' && date) onChange(getLocalDateString(date));
  };

  const formatted = () => {
    if (!value) return '--';
    const [y, m, d] = value.split('-').map(Number);
    if (!Number.isFinite(d)) return value;
    return `${d} ${i18n.t(`months.${m - 1}`)} ${y}`;
  };

  return (
    <View className="flex-1">
      <Text className="text-gray-400 text-xs font-bold uppercase mb-1.5">{label}</Text>

      <TouchableOpacity
        onPress={open}
        activeOpacity={0.8}
        className="bg-black border border-gray-800 px-3 py-2.5 rounded-xl flex-row items-center justify-center"
      >
        <CalendarIcon size={IconSize.sm} color={IconColor.cyan} style={{ marginRight: 6 }} />
        <Text className="text-white text-xs font-bold" numberOfLines={1}>
          {formatted()}
        </Text>
      </TouchableOpacity>

      {visible && Platform.OS === 'android' && (
        <DateTimePicker
          value={draft}
          mode="date"
          display="calendar"
          minimumDate={minimumDate ? parseLocalDate(minimumDate) : undefined}
          onChange={handleAndroidChange}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
          <View className="flex-1 justify-end bg-black/70">
            <View className="bg-gray-950 border-t border-gray-800 rounded-t-3xl p-4">
              <Text className="text-gray-400 text-xs font-bold uppercase mb-2">{label}</Text>

              <DateTimePicker
                value={draft}
                mode="date"
                display="inline"
                themeVariant="dark"
                minimumDate={minimumDate ? parseLocalDate(minimumDate) : undefined}
                onChange={(_e, date) => date && setDraft(date)}
                style={{ alignSelf: 'stretch' }}
              />

              <TouchableOpacity
                onPress={() => {
                  onChange(getLocalDateString(draft));
                  setVisible(false);
                }}
                className="bg-neonCyan py-3 rounded-xl items-center justify-center mt-2"
              >
                <Text className="text-black font-extrabold text-sm uppercase tracking-wider">
                  {i18n.t('done')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
