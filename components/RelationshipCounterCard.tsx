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

const EMOJI_OPTIONS = ['❤️', '💍', '✈️', '⭐', '🎉', '🥂', '🏠', '💌'];

export default function RelationshipCounterCard() {
  const [countersList, setCountersList] = useState<RelationshipCounter[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCounter, setEditingCounter] = useState<RelationshipCounter | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [type, setType] = useState<'since' | 'until'>('since');
  const [icon, setIcon] = useState('❤️');

  const loadCounters = async () => {
    try {
      const list = await getAllCounters();
      if (list.length === 0) {
        // Seed default first meet counter if none exists
        const defaultCounter: RelationshipCounter = {
          id: 'default_anniversary',
          title: i18n.t('daysTogether'),
          targetDate: '2025-01-01',
          type: 'since',
          icon: '❤️',
        };
        await saveCounter(defaultCounter);
        setCountersList([defaultCounter]);
      } else {
        setCountersList(list);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadCounters();

    const unsubCounter = syncService.addCounterListener(() => {
      loadCounters();
    });

    const unsubSync = syncService.addSyncListener(() => {
      loadCounters();
    });

    return () => {
      unsubCounter();
      unsubSync();
    };
  }, []);

  const handleOpenAdd = () => {
    setEditingCounter(null);
    setTitle('');
    setTargetDate(new Date().toISOString().split('T')[0]);
    setType('since');
    setIcon('❤️');
    setModalVisible(true);
  };

  const handleOpenEdit = (counter: RelationshipCounter) => {
    setEditingCounter(counter);
    setTitle(counter.title);
    setTargetDate(counter.targetDate);
    setType(counter.type);
    setIcon(counter.icon || '❤️');
    setModalVisible(true);
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !targetDate) {
      Alert.alert(i18n.t('error'), 'Lütfen başlık ve tarih girin.');
      return;
    }

    const counterObj: RelationshipCounter = {
      id: editingCounter ? editingCounter.id : Math.random().toString(36).substring(2, 11),
      title: trimmedTitle,
      targetDate: targetDate.trim(),
      type,
      icon,
    };

    await saveCounter(counterObj);
    syncService.sendCounterUpdate(counterObj);
    setModalVisible(false);
    loadCounters();
  };

  const handleDelete = async () => {
    if (!editingCounter) return;

    Alert.alert(
      i18n.t('deleteCounter'),
      i18n.t('deleteEventConfirm'),
      [
        { text: i18n.t('cancel'), style: 'cancel' },
        {
          text: i18n.t('deleteCounter'),
          style: 'destructive',
          onPress: async () => {
            await deleteCounter(editingCounter.id);
            syncService.sendCounterDelete(editingCounter.id);
            setModalVisible(false);
            loadCounters();
          },
        },
      ]
    );
  };

  return (
    <View className="mb-4">
      {/* Scrollable Milestone Cards */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
        {countersList.map((c) => {
          const diff = getDaysDifference(c.targetDate, c.type);
          const isUntil = c.type === 'until';

          return (
            <TouchableOpacity
              key={c.id}
              activeOpacity={0.85}
              onPress={() => handleOpenEdit(c)}
              className={`mr-3 p-3.5 rounded-2xl border flex-row items-center ${
                isUntil
                  ? 'bg-purple-950/40 border-purple-600/50'
                  : 'bg-pink-950/40 border-neonPink/50'
              }`}
            >
              <Text className="text-2xl mr-2.5">{c.icon || '❤️'}</Text>
              <View>
                <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                  {c.title}
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

        {/* Add Button Pill */}
        <TouchableOpacity
          onPress={handleOpenAdd}
          className="bg-gray-900 border border-gray-800 px-3.5 rounded-2xl items-center justify-center flex-row"
        >
          <FontAwesome name="plus" size={14} color="#00FFFF" style={{ marginRight: 6 }} />
          <Text className="text-neonCyan text-xs font-bold">{i18n.t('addCounter')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit / Add Counter Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 justify-end bg-black/85"
        >
          <View className="bg-gray-950 rounded-t-3xl border-t border-gray-800 p-5 max-h-[85%]">
            <View className="flex-row justify-between items-center mb-4">
              <View className="flex-row items-center">
                <Text className="text-2xl mr-2">{icon}</Text>
                <Text className="text-xl font-extrabold text-white">
                  {editingCounter ? i18n.t('counters') : i18n.t('addCounter')}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} className="p-2">
                <FontAwesome name="times" size={20} color="#888" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Title */}
              <View className="mb-4">
                <Text className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-1.5">
                  {i18n.t('counterTitle')}
                </Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Örn: İlk Tanışma, Birlikte Geçen Gün, Buluşma..."
                  placeholderTextColor="#555"
                  className="bg-gray-900 border border-gray-800 text-white p-3.5 rounded-xl text-base font-semibold"
                />
              </View>

              {/* Type Switcher (Since vs Until) */}
              <View className="mb-4">
                <Text className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-2">
                  {i18n.t('counterType')}
                </Text>
                <View className="flex-row bg-gray-900 border border-gray-800 p-1 rounded-xl">
                  <TouchableOpacity
                    onPress={() => setType('since')}
                    className={`flex-1 py-2.5 rounded-lg items-center ${
                      type === 'since' ? 'bg-pink-950 border border-neonPink' : ''
                    }`}
                  >
                    <Text className={`font-bold text-xs ${type === 'since' ? 'text-neonPink' : 'text-gray-400'}`}>
                      ⏳ {i18n.t('since')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setType('until')}
                    className={`flex-1 py-2.5 rounded-lg items-center ${
                      type === 'until' ? 'bg-purple-950 border border-purple-400' : ''
                    }`}
                  >
                    <Text className={`font-bold text-xs ${type === 'until' ? 'text-purple-400' : 'text-gray-400'}`}>
                      ✈️ {i18n.t('until')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Target Date */}
              <View className="mb-4">
                <Text className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-1.5">
                  {i18n.t('targetDate')} (YYYY-MM-DD)
                </Text>
                <TextInput
                  value={targetDate}
                  onChangeText={setTargetDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#555"
                  className="bg-gray-900 border border-gray-800 text-white p-3.5 rounded-xl font-mono text-base"
                />
              </View>

              {/* Emoji Icons */}
              <View className="mb-6">
                <Text className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-2">
                  Simge (Icon)
                </Text>
                <View className="flex-row justify-between bg-gray-900 border border-gray-800 p-3 rounded-2xl">
                  {EMOJI_OPTIONS.map((e) => (
                    <TouchableOpacity
                      key={e}
                      onPress={() => setIcon(e)}
                      className={`w-9 h-9 rounded-full items-center justify-center ${
                        icon === e ? 'bg-gray-800 border-2 border-neonPink scale-110' : ''
                      }`}
                    >
                      <Text className="text-xl">{e}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Buttons */}
              <View className="flex-row justify-between mb-4">
                {editingCounter ? (
                  <TouchableOpacity
                    onPress={handleDelete}
                    className="bg-gray-900 border border-red-600/70 p-4 rounded-xl flex-row items-center justify-center w-[35%]"
                  >
                    <FontAwesome name="trash" size={16} color="#ef4444" style={{ marginRight: 6 }} />
                    <Text className="text-red-400 font-bold text-sm">{i18n.t('deleteCounter')}</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  onPress={handleSave}
                  className={`bg-neonPink p-4 rounded-xl flex-row items-center justify-center ${
                    editingCounter ? 'w-[62%]' : 'w-full'
                  }`}
                >
                  <FontAwesome name="check" size={16} color="#000" style={{ marginRight: 6 }} />
                  <Text className="text-black font-extrabold text-base">{i18n.t('save')}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
