import React, { useEffect, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';

import i18n from '@/i18n';
import { RelationshipCounter } from '@/db/counters';
import { getLocalDateString } from '@/utils/date';
import { useCalendarData } from './CalendarDataProvider';
import AppModal from './ui/AppModal';
import DateField from './DateField';
import {
  CelebrateIcon,
  DeleteIcon,
  IconColor,
  IconSize,
  PastIcon,
  SaveIcon,
  TripIcon,
} from './ui/icons';

const COUNTER_ICONS = ['❤️', '💍', '✈️', '💌', '🎉', '🌟', '🏠', '🎂', '🏖️', '🥂'];

interface CounterEditorModalProps {
  visible: boolean;
  /** null creates a new counter. */
  counter: RelationshipCounter | null;
  onClose: () => void;
}

/** Create or edit a relationship counter. */
export default function CounterEditorModal({
  visible,
  counter,
  onClose,
}: CounterEditorModalProps) {
  const { saveRelationshipCounter, removeRelationshipCounter } = useCalendarData();

  const [title, setTitle] = useState('');
  const [targetDate, setTargetDate] = useState(getLocalDateString());
  const [type, setType] = useState<'since' | 'until'>('since');
  const [icon, setIcon] = useState('❤️');

  useEffect(() => {
    if (!visible) return;
    setTitle(counter?.title ?? '');
    setTargetDate(counter?.targetDate ?? getLocalDateString());
    setType(counter?.type ?? 'since');
    setIcon(counter?.icon ?? '❤️');
  }, [visible, counter]);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert(String(i18n.t('error')), String(i18n.t('counterTitle')));
      return;
    }
    await saveRelationshipCounter({
      id: counter?.id,
      title: title.trim(),
      targetDate,
      type,
      icon,
    });
    onClose();
  };

  const handleDelete = () => {
    if (!counter) return;
    Alert.alert(String(i18n.t('delete')), String(i18n.t('deleteCounter')), [
      { text: String(i18n.t('cancel')), style: 'cancel' },
      {
        text: String(i18n.t('delete')),
        style: 'destructive',
        onPress: async () => {
          await removeRelationshipCounter(counter.id);
          onClose();
        },
      },
    ]);
  };

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      title={counter ? i18n.t('milestone') : i18n.t('addCounter')}
      subtitle={i18n.t('relationshipMilestones')}
      footer={
        <View className="flex-row gap-2">
          {counter && (
            <TouchableOpacity
              onPress={handleDelete}
              className="bg-red-950/80 border border-red-500/60 px-4 rounded-xl items-center justify-center"
            >
              <DeleteIcon size={IconSize.md} color={IconColor.red} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleSave}
            className="flex-1 bg-yellow-400 py-3.5 rounded-xl items-center justify-center flex-row"
          >
            <SaveIcon size={IconSize.sm} color="#000" />
            <Text className="text-black font-extrabold text-sm uppercase tracking-wider ml-2">
              {i18n.t('save')}
            </Text>
          </TouchableOpacity>
        </View>
      }
    >
      <View className="gap-4">
        <View>
          <Text className="text-gray-400 text-xs font-bold uppercase mb-1.5">
            {i18n.t('counterTitle')}
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={String(i18n.t('counterTitle'))}
            placeholderTextColor="#555"
            className="bg-black border border-gray-800 text-white px-3.5 py-2.5 rounded-xl text-sm font-semibold"
          />
        </View>

        <View>
          <Text className="text-gray-400 text-xs font-bold uppercase mb-1.5">
            {i18n.t('counterType')}
          </Text>
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => setType('since')}
              className={`flex-1 py-2.5 rounded-xl border items-center justify-center flex-row ${
                type === 'since' ? 'bg-neonPink/20 border-neonPink' : 'bg-black/60 border-gray-800'
              }`}
            >
              <PastIcon
                size={IconSize.sm}
                color={type === 'since' ? IconColor.pink : IconColor.muted}
              />
              <Text
                className={`text-xs font-bold ml-1.5 ${
                  type === 'since' ? 'text-neonPink' : 'text-gray-400'
                }`}
              >
                {i18n.t('since')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setType('until')}
              className={`flex-1 py-2.5 rounded-xl border items-center justify-center flex-row ${
                type === 'until' ? 'bg-purple-500/20 border-purple-400' : 'bg-black/60 border-gray-800'
              }`}
            >
              <TripIcon
                size={IconSize.sm}
                color={type === 'until' ? IconColor.purple : IconColor.muted}
              />
              <Text
                className={`text-xs font-bold ml-1.5 ${
                  type === 'until' ? 'text-purple-400' : 'text-gray-400'
                }`}
              >
                {i18n.t('until')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="flex-row">
          <DateField
            label={String(i18n.t('targetDate'))}
            value={targetDate}
            onChange={setTargetDate}
          />
        </View>

        <View>
          <View className="flex-row items-center mb-1.5">
            <CelebrateIcon size={IconSize.sm} color={IconColor.muted} />
            <Text className="text-gray-400 text-xs font-bold uppercase ml-1.5">
              {i18n.t('eventColor')}
            </Text>
          </View>
          <View className="flex-row flex-wrap gap-2 py-1 justify-center">
            {COUNTER_ICONS.map(option => (
              <TouchableOpacity
                key={option}
                onPress={() => setIcon(option)}
                className={`w-10 h-10 rounded-xl items-center justify-center border ${
                  icon === option ? 'bg-gray-800 border-neonCyan' : 'bg-black border-gray-800'
                }`}
              >
                <Text className="text-lg">{option}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </AppModal>
  );
}
