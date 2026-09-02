import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import i18n from '@/i18n';
import {
  RelationshipCounter,
  getAllCounters,
  saveCounter,
  deleteCounter,
  getDaysDifference,
} from '@/db/counters';
import { syncService } from '@/services/syncService';

const EMOJI_OPTIONS = ['❤️', '💍', '✈️', '⭐', '🎉', '🥂', '🏠', '💌', '🏖️', '🎂'];

interface RelationshipCounterCardProps {
  counters?: RelationshipCounter[];
  onAddCounter?: () => void;
  onEditCounter?: (counter: RelationshipCounter) => void;
}

export default function RelationshipCounterCard({
  counters,
  onAddCounter,
  onEditCounter,
}: RelationshipCounterCardProps) {
  const [internalList, setInternalList] = useState<RelationshipCounter[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCounter, setEditingCounter] = useState<RelationshipCounter | null>(null);
  const [showPast, setShowPast] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [type, setType] = useState<'since' | 'until'>('since');
  const [icon, setIcon] = useState('❤️');

  const loadCounters = async () => {
    try {
      const list = await getAllCounters();
      if (list.length === 0) {
        const defaultCounter: RelationshipCounter = {
          id: 'default_anniversary',
          title: i18n.t('daysTogether'),
          targetDate: '2025-01-01',
          type: 'since',
          icon: '❤️',
        };
        await saveCounter(defaultCounter);
        setInternalList([defaultCounter]);
      } else {
        setInternalList(list);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!counters) {
      loadCounters();
      const unsub = syncService.addCounterListener(() => {
        loadCounters();
      });
      return () => {
        unsub();
      };
    }
  }, [counters]);

  const fullList = counters || internalList;

  // A countdown whose target date has gone by is noise on the strip, so it is
  // hidden by default. It stays reachable behind the toggle below, otherwise it
  // could never be edited or deleted again.
  const isPastCountdown = (c: RelationshipCounter) =>
    c.type === 'until' && getDaysDifference(c.targetDate, 'until') < 0;

  const pastCount = fullList.filter(isPastCountdown).length;
  const displayList = showPast ? fullList : fullList.filter(c => !isPastCountdown(c));

  const handleOpenAdd = () => {
    if (onAddCounter) {
      onAddCounter();
      return;
    }
    setEditingCounter(null);
    setTitle('');
    setTargetDate(new Date().toISOString().split('T')[0]);
    setType('since');
    setIcon('❤️');
    setModalVisible(true);
  };

  const handleOpenEdit = (counter: RelationshipCounter) => {
    if (onEditCounter) {
      onEditCounter(counter);
      return;
    }
    setEditingCounter(counter);
    setTitle(counter.title);
    setTargetDate(counter.targetDate);
    setType(counter.type);
    setIcon(counter.icon || '❤️');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !targetDate.trim()) {
      Alert.alert(i18n.t('error'), 'Lütfen başlık ve tarih alanlarını doldurun.');
      return;
    }

    const payload: RelationshipCounter = {
      id: editingCounter?.id || Math.random().toString(36).substring(2, 11),
      title: title.trim(),
      targetDate: targetDate.trim(),
      type,
      icon,
    };

    await saveCounter(payload);
    await syncService.sendCounterUpdate(payload);
    setModalVisible(false);
    loadCounters();
  };

  const handleDelete = async () => {
    if (!editingCounter) return;
    Alert.alert(i18n.t('delete'), 'Bu sayacı silmek istediğinize emin misiniz?', [
      { text: i18n.t('cancel'), style: 'cancel' },
      {
        text: i18n.t('delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteCounter(editingCounter.id);
          await syncService.sendCounterDelete(editingCounter.id);
          setModalVisible(false);
          loadCounters();
        },
      },
    ]);
  };

  return (
    <View className="mb-4">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
        {displayList.map((c) => {
          const diff = getDaysDifference(c.targetDate, c.type);
          const isUntil = c.type === 'until';

          return (
            <TouchableOpacity
              key={c.id}
              activeOpacity={0.85}
              onPress={() => handleOpenEdit(c)}
              className={`mr-3 p-3.5 rounded-2xl border flex-row items-center ${
                isPastCountdown(c)
                  ? 'bg-gray-900/60 border-gray-700 opacity-60'
                  : isUntil
                  ? 'bg-purple-950/40 border-purple-600/50'
                  : 'bg-pink-950/40 border-neonPink/50'
              }`}
            >
              <Text className="text-2xl mr-2.5">{c.icon || '❤️'}</Text>
              <View>
                <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                  {c.title}
                  {isPastCountdown(c) ? ` · ${i18n.t('passed')}` : ''}
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
                      : isUntil
                      ? diff > 0
                        ? i18n.t('daysLeft')
                        : i18n.t('daysAgo')
                      : diff >= 0
                      ? i18n.t('daysAgo')
                      : i18n.t('daysLeft')}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Passed-countdown reveal toggle */}
        {pastCount > 0 && (
          <TouchableOpacity
            onPress={() => setShowPast(v => !v)}
            className="bg-gray-900 border border-gray-800 px-3.5 mr-3 rounded-2xl items-center justify-center flex-row"
          >
            <FontAwesome
              name={showPast ? 'eye-slash' : 'history'}
              size={13}
              color="#9ca3af"
              style={{ marginRight: 6 }}
            />
            <Text className="text-gray-400 text-xs font-bold">
              {showPast ? i18n.t('hidePastCounters') : `${i18n.t('showPastCounters')} (${pastCount})`}
            </Text>
          </TouchableOpacity>
        )}

        {/* Add Button Pill */}
        <TouchableOpacity
          onPress={handleOpenAdd}
          className="bg-gray-900 border border-gray-800 px-3.5 rounded-2xl items-center justify-center flex-row"
        >
          <FontAwesome name="plus" size={14} color="#00FFFF" style={{ marginRight: 6 }} />
          <Text className="text-neonCyan text-xs font-bold">{i18n.t('addCounter')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Centered Fallback Modal */}
      <Modal visible={modalVisible} animationType="fade" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 justify-center items-center bg-black/80 p-4"
        >
          <View className="w-full max-w-lg bg-gray-950 rounded-3xl border border-gray-800 p-5 max-h-[85%] shadow-2xl">
            <View className="flex-row justify-between items-center mb-4 pb-2 border-b border-gray-900">
              <View className="flex-row items-center">
                <Text className="text-2xl mr-2">{icon}</Text>
                <Text className="text-lg font-extrabold text-white">
                  {editingCounter ? i18n.t('counters') : i18n.t('addCounter')}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} className="p-1">
                <FontAwesome name="times" size={18} color="#888" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Title */}
              <View className="mb-3.5">
                <Text className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-1">
                  {i18n.t('counterTitle')}
                </Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Örn: İlk Tanışma, Yıldönümü, Kavuşma..."
                  placeholderTextColor="#555"
                  className="bg-black border border-gray-800 text-white px-3.5 py-2.5 rounded-xl text-sm font-semibold"
                />
              </View>

              {/* Type Switcher */}
              <View className="mb-3.5">
                <Text className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-1.5">
                  {i18n.t('counterType')}
                </Text>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => setType('since')}
                    className={`flex-1 py-2.5 rounded-xl border items-center ${
                      type === 'since' ? 'bg-pink-950 border-neonPink' : 'bg-black border-gray-800'
                    }`}
                  >
                    <Text className={`font-bold text-xs ${type === 'since' ? 'text-neonPink' : 'text-gray-400'}`}>
                      ⏳ {i18n.t('since')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setType('until')}
                    className={`flex-1 py-2.5 rounded-xl border items-center ${
                      type === 'until' ? 'bg-purple-950 border-purple-400' : 'bg-black border-gray-800'
                    }`}
                  >
                    <Text className={`font-bold text-xs ${type === 'until' ? 'text-purple-400' : 'text-gray-400'}`}>
                      ✈️ {i18n.t('until')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Target Date */}
              <View className="mb-3.5">
                <Text className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-1">
                  {i18n.t('targetDate')} (YYYY-MM-DD)
                </Text>
                <TextInput
                  value={targetDate}
                  onChangeText={setTargetDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#555"
                  className="bg-black border border-gray-800 text-white px-3.5 py-2.5 rounded-xl font-mono text-sm text-center"
                />
              </View>

              {/* Emoji Icons */}
              <View className="mb-5">
                <Text className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-1.5">
                  Simge (Icon)
                </Text>
                <View className="flex-row flex-wrap gap-2 justify-center py-1">
                  {EMOJI_OPTIONS.map((e) => (
                    <TouchableOpacity
                      key={e}
                      onPress={() => setIcon(e)}
                      className={`w-9 h-9 rounded-xl items-center justify-center border ${
                        icon === e ? 'bg-gray-800 border-neonCyan scale-110' : 'bg-black border-gray-800'
                      }`}
                    >
                      <Text className="text-base">{e}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Actions */}
              <View className="flex-row gap-2 pt-1">
                {editingCounter && (
                  <TouchableOpacity
                    onPress={handleDelete}
                    className="bg-red-950/80 border border-red-500/60 p-3 rounded-xl items-center justify-center px-4"
                  >
                    <FontAwesome name="trash" size={16} color="#ef4444" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={handleSave}
                  className="flex-1 bg-yellow-400 py-3 rounded-xl items-center justify-center"
                >
                  <Text className="text-black font-extrabold text-sm uppercase tracking-wider">
                    {i18n.t('save')}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
