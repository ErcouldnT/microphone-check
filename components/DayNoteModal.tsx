import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import i18n from '@/i18n';

interface DayNoteModalProps {
  visible: boolean;
  date: string; // YYYY-MM-DD
  initialCount: number;
  initialNote: string;
  onClose: () => void;
  onSave: (date: string, count: number, note: string) => void;
  onDeleteNote: (date: string) => void;
}

export default function DayNoteModal({
  visible,
  date,
  initialCount,
  initialNote,
  onClose,
  onSave,
  onDeleteNote,
}: DayNoteModalProps) {
  const [count, setCount] = useState(initialCount);
  const [noteText, setNoteText] = useState(initialNote);

  useEffect(() => {
    if (visible) {
      setCount(initialCount);
      setNoteText(initialNote || '');
    }
  }, [visible, initialCount, initialNote]);

  const handleIncrement = () => setCount(prev => prev + 1);
  const handleDecrement = () => setCount(prev => Math.max(0, prev - 1));

  const handleSave = () => {
    onSave(date, count, noteText);
    onClose();
  };

  const handleDeleteNote = () => {
    Alert.alert(
      i18n.t('deleteNote'),
      i18n.t('leaveRoomConfirm') ? `${i18n.t('deleteNote')}?` : 'Delete note?',
      [
        { text: i18n.t('cancel'), style: 'cancel' },
        {
          text: i18n.t('deleteNote'),
          style: 'destructive',
          onPress: () => {
            setNoteText('');
            onDeleteNote(date);
            onClose();
          }
        }
      ]
    );
  };

  // Format date for title
  const getFormattedDate = () => {
    if (!date) return '';
    const [y, m, d] = date.split('-').map(Number);
    const monthName = i18n.t(`months.${m - 1}`);
    return `${d} ${monthName} ${y}`;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-black/80"
      >
        <View className="bg-gray-950 rounded-t-3xl border-t border-gray-800 p-6 max-h-[85%]">
          {/* Header */}
          <View className="flex-row justify-between items-center mb-5">
            <View className="flex-row items-center">
              <FontAwesome name="calendar-check-o" size={20} color="#00FFFF" style={{ marginRight: 8 }} />
              <Text className="text-xl font-bold text-white">{getFormattedDate()}</Text>
            </View>
            <TouchableOpacity onPress={onClose} className="p-2">
              <FontAwesome name="times" size={20} color="#888" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Microphone Counter Section */}
            <View className="bg-gray-900 border border-gray-800 p-4 rounded-2xl mb-5 flex-row justify-between items-center">
              <View>
                <Text className="text-gray-400 text-xs uppercase font-bold tracking-wider">
                  {i18n.t('microphoneCount')}
                </Text>
                <View className="flex-row items-center mt-1">
                  <FontAwesome name="microphone" size={16} color="#00FFFF" style={{ marginRight: 6 }} />
                  <Text className="text-2xl font-extrabold text-neonCyan">{count}</Text>
                </View>
              </View>

              <View className="flex-row items-center space-x-2">
                <TouchableOpacity
                  onPress={handleDecrement}
                  className="bg-gray-800 border border-gray-700 w-11 h-11 rounded-xl items-center justify-center mr-2"
                >
                  <FontAwesome name="minus" size={16} color="#FF007F" />
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleIncrement}
                  className="bg-gray-800 border border-neonCyan/50 w-11 h-11 rounded-xl items-center justify-center"
                >
                  <FontAwesome name="plus" size={16} color="#00FFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Note & Daily Plan Section */}
            <View className="bg-gray-900 border border-gray-800 p-4 rounded-2xl mb-6">
              <View className="flex-row items-center mb-3">
                <FontAwesome name="pencil-square-o" size={16} color="#c084fc" style={{ marginRight: 6 }} />
                <Text className="text-purple-400 font-bold text-sm uppercase tracking-wider">
                  {i18n.t('dailyNote')}
                </Text>
              </View>

              <TextInput
                value={noteText}
                onChangeText={setNoteText}
                placeholder={i18n.t('notePlaceholder')}
                placeholderTextColor="#555"
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                className="bg-black border border-gray-800 text-white p-3.5 rounded-xl min-h-[120px] text-base leading-6"
              />
            </View>

            {/* Action Buttons */}
            <View className="flex-row justify-between mb-4">
              {initialNote ? (
                <TouchableOpacity
                  onPress={handleDeleteNote}
                  className="bg-gray-900 border border-red-600/70 p-4 rounded-xl flex-row items-center justify-center w-[35%]"
                >
                  <FontAwesome name="trash" size={16} color="#ef4444" style={{ marginRight: 6 }} />
                  <Text className="text-red-400 font-bold text-sm">{i18n.t('deleteNote')}</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                onPress={handleSave}
                className={`bg-neonCyan p-4 rounded-xl flex-row items-center justify-center ${
                  initialNote ? 'w-[62%]' : 'w-full'
                }`}
              >
                <FontAwesome name="check" size={16} color="#000" style={{ marginRight: 6 }} />
                <Text className="text-black font-extrabold text-base">{i18n.t('saveNote')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
