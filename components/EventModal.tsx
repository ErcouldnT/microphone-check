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
  Alert,
  Switch
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import i18n from '@/i18n';
import { CalendarEvent } from '@/db/events';
import { UserRole } from '@/db/settings';

interface EventModalProps {
  visible: boolean;
  eventToEdit?: CalendarEvent | null;
  defaultDate?: string; // YYYY-MM-DD
  myRole?: UserRole;
  myName?: string;
  partnerName?: string;
  onClose: () => void;
  onSave: (event: CalendarEvent) => void;
  onDelete?: (eventId: string) => void;
}

const PRESET_COLORS = [
  { hex: '#00FFFF', label: 'Cyan' },
  { hex: '#FF007F', label: 'Neon Pink' },
  { hex: '#FACC15', label: 'Yellow' },
  { hex: '#10B981', label: 'Emerald' },
  { hex: '#A855F7', label: 'Purple' },
  { hex: '#FB923C', label: 'Orange' },
  { hex: '#38BDF8', label: 'Sky' },
];

export default function EventModal({
  visible,
  eventToEdit,
  defaultDate,
  myRole = 'male',
  myName = '',
  partnerName = '',
  onClose,
  onSave,
  onDelete,
}: EventModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isAllDay, setIsAllDay] = useState(true);
  const [startTime, setStartTime] = useState('12:00');
  const [endTime, setEndTime] = useState('13:00');
  const [target, setTarget] = useState<'male' | 'female' | 'both'>(myRole);
  const [color, setColor] = useState('#00FFFF');

  const partnerRole: UserRole = myRole === 'male' ? 'female' : 'male';

  useEffect(() => {
    if (visible) {
      if (eventToEdit) {
        setTitle(eventToEdit.title || '');
        setDescription(eventToEdit.description || '');
        setStartDate(eventToEdit.startDate || '');
        setEndDate(eventToEdit.endDate || eventToEdit.startDate || '');
        setIsAllDay(eventToEdit.isAllDay ?? true);
        setStartTime(eventToEdit.startTime || '12:00');
        setEndTime(eventToEdit.endTime || '13:00');
        
        // Normalize target (backward compatibility for 'you' / 'partner')
        let normalizedTarget: 'male' | 'female' | 'both' = 'both';
        if (eventToEdit.target === 'both') {
          normalizedTarget = 'both';
        } else if (eventToEdit.target === 'male' || eventToEdit.target === 'female') {
          normalizedTarget = eventToEdit.target;
        } else if (eventToEdit.target === 'you') {
          normalizedTarget = myRole;
        } else if (eventToEdit.target === 'partner') {
          normalizedTarget = partnerRole;
        }
        setTarget(normalizedTarget);
        setColor(eventToEdit.color || '#00FFFF');
      } else {
        const initialDate = defaultDate || new Date().toISOString().split('T')[0];
        setTitle('');
        setDescription('');
        setStartDate(initialDate);
        setEndDate(initialDate);
        setIsAllDay(true);
        setStartTime('12:00');
        setEndTime('13:00');
        setTarget(myRole);
        setColor(myRole === 'male' ? '#00FFFF' : '#FF007F');
      }
    }
  }, [visible, eventToEdit, defaultDate, myRole]);

  const handleTargetChange = (newTarget: 'male' | 'female' | 'both') => {
    setTarget(newTarget);
    if (!eventToEdit) {
      if (newTarget === 'male') setColor('#00FFFF');
      else if (newTarget === 'female') setColor('#FF007F');
      else if (newTarget === 'both') setColor('#FACC15');
    }
  };

  const handleSave = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert(i18n.t('error'), i18n.t('titlePlaceholder'));
      return;
    }

    const finalStart = startDate || new Date().toISOString().split('T')[0];
    const finalEnd = endDate && endDate >= finalStart ? endDate : finalStart;

    const event: CalendarEvent = {
      id: eventToEdit ? eventToEdit.id : Math.random().toString(36).substring(2, 11),
      title: trimmedTitle,
      description: description.trim() || undefined,
      startDate: finalStart,
      endDate: finalEnd,
      startTime: isAllDay ? undefined : startTime,
      endTime: isAllDay ? undefined : endTime,
      isAllDay,
      color,
      target,
    };

    onSave(event);
    onClose();
  };

  const handleDelete = () => {
    if (!eventToEdit || !onDelete) return;

    Alert.alert(
      i18n.t('deleteEvent'),
      i18n.t('deleteEventConfirm'),
      [
        { text: i18n.t('cancel'), style: 'cancel' },
        {
          text: i18n.t('deleteEvent'),
          style: 'destructive',
          onPress: () => {
            onDelete(eventToEdit.id);
            onClose();
          },
        },
      ]
    );
  };

  const myLabel = myName ? `${myName} (${myRole === 'male' ? '👨' : '👩'})` : (myRole === 'male' ? `${i18n.t('forYou')} (👨 ${i18n.t('forMale')})` : `${i18n.t('forYou')} (👩 ${i18n.t('forFemale')})`);
  const partnerLabel = partnerName ? `${partnerName} (${partnerRole === 'male' ? '👨' : '👩'})` : (partnerRole === 'male' ? `${i18n.t('forPartner')} (👨 ${i18n.t('forMale')})` : `${i18n.t('forPartner')} (👩 ${i18n.t('forFemale')})`);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-black/85"
      >
        <View className="bg-gray-950 rounded-t-3xl border-t border-gray-800 p-5 max-h-[90%]">
          {/* Header */}
          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-row items-center">
              <View
                className="w-3.5 h-3.5 rounded-full mr-2"
                style={{ backgroundColor: color }}
              />
              <Text className="text-xl font-extrabold text-white">
                {eventToEdit ? i18n.t('editEvent') : i18n.t('newEvent')}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} className="p-2">
              <FontAwesome name="times" size={20} color="#888" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Title Input */}
            <View className="mb-4">
              <Text className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-1.5">
                {i18n.t('eventTitle')}
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={i18n.t('titlePlaceholder')}
                placeholderTextColor="#555"
                className="bg-gray-900 border border-gray-800 text-white p-3.5 rounded-xl text-base font-semibold"
              />
            </View>

            {/* Target Selector (My Role vs Partner Role vs Both) */}
            <View className="mb-4">
              <Text className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-2">
                {i18n.t('assignTo')}
              </Text>
              <View className="flex-row bg-gray-900 border border-gray-800 p-1 rounded-xl">
                {/* My Role (Sen) */}
                <TouchableOpacity
                  onPress={() => handleTargetChange(myRole)}
                  className={`flex-1 py-2.5 rounded-lg items-center ${
                    target === myRole ? (myRole === 'male' ? 'bg-cyan-950 border border-neonCyan' : 'bg-pink-950 border border-neonPink') : ''
                  }`}
                >
                  <Text className={`font-bold text-xs ${target === myRole ? (myRole === 'male' ? 'text-neonCyan' : 'text-neonPink') : 'text-gray-400'}`} numberOfLines={1}>
                    {myLabel}
                  </Text>
                </TouchableOpacity>

                {/* Partner Role (Partnerin) */}
                <TouchableOpacity
                  onPress={() => handleTargetChange(partnerRole)}
                  className={`flex-1 py-2.5 rounded-lg items-center ${
                    target === partnerRole ? (partnerRole === 'male' ? 'bg-cyan-950 border border-neonCyan' : 'bg-pink-950 border border-neonPink') : ''
                  }`}
                >
                  <Text className={`font-bold text-xs ${target === partnerRole ? (partnerRole === 'male' ? 'text-neonCyan' : 'text-neonPink') : 'text-gray-400'}`} numberOfLines={1}>
                    {partnerLabel}
                  </Text>
                </TouchableOpacity>

                {/* Both (İkimiz) */}
                <TouchableOpacity
                  onPress={() => handleTargetChange('both')}
                  className={`flex-1 py-2.5 rounded-lg items-center ${
                    target === 'both' ? 'bg-yellow-950 border border-yellow-400' : ''
                  }`}
                >
                  <Text className={`font-bold text-xs ${target === 'both' ? 'text-yellow-400' : 'text-gray-400'}`} numberOfLines={1}>
                    ✨ {i18n.t('forBoth')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Date Range Section (Multi-Day Diapason) */}
            <View className="bg-gray-900 border border-gray-800 p-4 rounded-2xl mb-4">
              <View className="flex-row justify-between items-center mb-3">
                <View className="flex-row items-center">
                  <FontAwesome name="calendar" size={14} color="#00FFFF" style={{ marginRight: 6 }} />
                  <Text className="text-white font-bold text-sm">Tarih Aralığı (Date Range)</Text>
                </View>
              </View>

              <View className="flex-row justify-between">
                <View className="w-[48%]">
                  <Text className="text-gray-400 text-xs mb-1">{i18n.t('startDate')}</Text>
                  <TextInput
                    value={startDate}
                    onChangeText={setStartDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#555"
                    className="bg-black border border-gray-800 text-white p-2.5 rounded-xl text-center font-mono text-sm"
                  />
                </View>

                <View className="w-[48%]">
                  <Text className="text-gray-400 text-xs mb-1">{i18n.t('endDate')}</Text>
                  <TextInput
                    value={endDate}
                    onChangeText={setEndDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#555"
                    className="bg-black border border-gray-800 text-white p-2.5 rounded-xl text-center font-mono text-sm"
                  />
                </View>
              </View>
            </View>

            {/* Time / All-Day Settings */}
            <View className="bg-gray-900 border border-gray-800 p-4 rounded-2xl mb-4">
              <View className="flex-row justify-between items-center">
                <View className="flex-row items-center">
                  <FontAwesome name="clock-o" size={16} color="#00FFFF" style={{ marginRight: 6 }} />
                  <Text className="text-white font-bold text-sm">{i18n.t('allDay')}</Text>
                </View>
                <Switch
                  value={isAllDay}
                  onValueChange={setIsAllDay}
                  trackColor={{ false: '#374151', true: '#00FFFF' }}
                  thumbColor={isAllDay ? '#000000' : '#9CA3AF'}
                />
              </View>

              {!isAllDay && (
                <View className="flex-row justify-between mt-3 pt-3 border-t border-gray-800">
                  <View className="w-[48%]">
                    <Text className="text-gray-400 text-xs mb-1">{i18n.t('startTime')}</Text>
                    <TextInput
                      value={startTime}
                      onChangeText={setStartTime}
                      placeholder="HH:mm"
                      placeholderTextColor="#555"
                      className="bg-black border border-gray-800 text-white p-2 rounded-xl text-center font-mono text-sm"
                    />
                  </View>
                  <View className="w-[48%]">
                    <Text className="text-gray-400 text-xs mb-1">{i18n.t('endTime')}</Text>
                    <TextInput
                      value={endTime}
                      onChangeText={setEndTime}
                      placeholder="HH:mm"
                      placeholderTextColor="#555"
                      className="bg-black border border-gray-800 text-white p-2 rounded-xl text-center font-mono text-sm"
                    />
                  </View>
                </View>
              )}
            </View>

            {/* Color Palette Picker */}
            <View className="mb-4">
              <Text className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-2">
                {i18n.t('color')}
              </Text>
              <View className="flex-row justify-between bg-gray-900 border border-gray-800 p-3 rounded-2xl">
                {PRESET_COLORS.map(c => (
                  <TouchableOpacity
                    key={c.hex}
                    onPress={() => setColor(c.hex)}
                    style={{ backgroundColor: c.hex }}
                    className={`w-8 h-8 rounded-full items-center justify-center ${
                      color === c.hex ? 'border-2 border-white scale-110' : ''
                    }`}
                  >
                    {color === c.hex && (
                      <FontAwesome name="check" size={12} color="#000" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Description Input */}
            <View className="mb-6">
              <Text className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-1.5">
                {i18n.t('description')}
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder={i18n.t('descPlaceholder')}
                placeholderTextColor="#555"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                className="bg-gray-900 border border-gray-800 text-white p-3.5 rounded-xl min-h-[80px] text-sm"
              />
            </View>

            {/* Action Buttons */}
            <View className="flex-row justify-between mb-4">
              {eventToEdit ? (
                <TouchableOpacity
                  onPress={handleDelete}
                  className="bg-gray-900 border border-red-600/70 p-4 rounded-xl flex-row items-center justify-center w-[35%]"
                >
                  <FontAwesome name="trash" size={16} color="#ef4444" style={{ marginRight: 6 }} />
                  <Text className="text-red-400 font-bold text-sm">{i18n.t('deleteEvent')}</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                onPress={handleSave}
                style={{ backgroundColor: color }}
                className={`p-4 rounded-xl flex-row items-center justify-center ${
                  eventToEdit ? 'w-[62%]' : 'w-full'
                }`}
              >
                <FontAwesome name="check" size={16} color="#000" style={{ marginRight: 6 }} />
                <Text className="text-black font-extrabold text-base">{i18n.t('saveEvent')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
