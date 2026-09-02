import React, { useState } from 'react';
import { Modal, Platform, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import i18n from '@/i18n';

interface TimeFieldProps {
  label: string;
  /** "HH:mm" */
  value: string;
  onChange: (value: string) => void;
}

/** "HH:mm" -> Date (today's date, that clock time). Falls back to 10:00. */
const toDate = (value: string): Date => {
  const d = new Date();
  const [h, m] = (value || '').split(':').map(Number);
  d.setHours(Number.isFinite(h) ? h : 10, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
};

const toHHmm = (date: Date): string =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

/**
 * Tappable time field backed by the platform's native time picker.
 *
 * Android shows the system clock dialog, which dismisses itself. iOS has no
 * dialog of its own, so the spinner is presented in a small sheet with a
 * confirm button.
 */
export default function TimeField({ label, value, onChange }: TimeFieldProps) {
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState<Date>(() => toDate(value));

  const open = () => {
    setDraft(toDate(value));
    setVisible(true);
  };

  const handleAndroidChange = (event: DateTimePickerEvent, date?: Date) => {
    setVisible(false);
    if (event.type === 'set' && date) onChange(toHHmm(date));
  };

  return (
    <View className="flex-1">
      <Text className="text-gray-400 text-xs font-bold uppercase mb-1.5">{label}</Text>

      <TouchableOpacity
        onPress={open}
        activeOpacity={0.8}
        className="bg-black border border-gray-800 px-3 py-2.5 rounded-xl flex-row items-center justify-center"
      >
        <FontAwesome name="clock-o" size={12} color="#00FFFF" style={{ marginRight: 6 }} />
        <Text className="text-white text-sm font-mono font-bold">{value || '--:--'}</Text>
      </TouchableOpacity>

      {visible && Platform.OS === 'android' && (
        <DateTimePicker
          value={draft}
          mode="time"
          is24Hour
          display="clock"
          onChange={handleAndroidChange}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
          <View className="flex-1 justify-end bg-black/70">
            <View className="bg-gray-950 border-t border-gray-800 rounded-t-3xl p-4">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-gray-400 text-xs font-bold uppercase">{label}</Text>
                <TouchableOpacity onPress={() => setVisible(false)} className="p-1">
                  <FontAwesome name="times" size={18} color="#888" />
                </TouchableOpacity>
              </View>

              <DateTimePicker
                value={draft}
                mode="time"
                is24Hour
                display="spinner"
                themeVariant="dark"
                onChange={(_e, date) => date && setDraft(date)}
                style={{ alignSelf: 'stretch' }}
              />

              <TouchableOpacity
                onPress={() => {
                  onChange(toHHmm(draft));
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
