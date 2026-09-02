import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Alert,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import i18n from '@/i18n';
import { CalendarEvent } from '@/db/events';
import { RelationshipCounter } from '@/db/counters';
import { getMyRole, getMyName, getPartnerName, UserRole } from '@/db/settings';
import { NoteItem } from '@/db/notes';
import { getLocalDateString } from '@/utils/date';
import TimeField from './TimeField';

export type ActionTab = 'event' | 'note' | 'session' | 'counter';

interface DayActionModalProps {
  visible: boolean;
  onClose: () => void;
  selectedDate: string; // YYYY-MM-DD
  initialTab?: ActionTab;
  // Event props
  eventToEdit?: CalendarEvent | null;
  onSaveEvent: (event: Omit<CalendarEvent, 'id' | 'author' | 'updatedAt'> & { id?: string }) => void;
  onDeleteEvent?: (id: string) => void;
  // Note props — a day can hold any number of notes
  dayNotes?: NoteItem[];
  onSaveNote: (date: string, content: string, noteId?: string) => void;
  onDeleteNote?: (noteId: string, date: string) => void;
  // Session / Day Count props
  currentSessionCount?: number;
  onUpdateSessionCount?: (date: string, delta: number) => void;
  // Relationship Counter props
  counterToEdit?: RelationshipCounter | null;
  onSaveCounter?: (counter: Omit<RelationshipCounter, 'id' | 'updatedAt'> & { id?: string }) => void;
  onDeleteCounter?: (id: string) => void;
}

const EVENT_COLORS = [
  { label: 'Cyan', value: '#00FFFF' },
  { label: 'Pink', value: '#FF007F' },
  { label: 'Purple', value: '#A855F7' },
  { label: 'Green', value: '#10B981' },
  { label: 'Yellow', value: '#FACC15' },
  { label: 'Orange', value: '#FB923C' },
  { label: 'Red', value: '#EF4444' },
];

const COUNTER_ICONS = ['❤️', '💍', '✈️', '💌', '🎉', '🌟', '🏠', '🎂', '🏖️', '🥂'];

export default function DayActionModal({
  visible,
  onClose,
  selectedDate,
  initialTab = 'event',
  eventToEdit,
  onSaveEvent,
  onDeleteEvent,
  dayNotes = [],
  onSaveNote,
  onDeleteNote,
  currentSessionCount = 0,
  onUpdateSessionCount,
  counterToEdit,
  onSaveCounter,
  onDeleteCounter,
}: DayActionModalProps) {
  const [activeTab, setActiveTab] = useState<ActionTab>(initialTab);

  // Profile role & names
  const [myRole, setMyRoleState] = useState<UserRole>('male');
  const [myName, setMyNameState] = useState('');
  const [partnerName, setPartnerNameState] = useState('');

  // Event State
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventStartDate, setEventStartDate] = useState(selectedDate);
  const [eventEndDate, setEventEndDate] = useState(selectedDate);
  const [isAllDay, setIsAllDay] = useState(true);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [eventColor, setEventColor] = useState(EVENT_COLORS[0].value);
  const [eventTarget, setEventTarget] = useState<'male' | 'female' | 'both'>('male');
  const [eventCompleted, setEventCompleted] = useState(false);

  // Note State — draft text plus which existing note is being edited (if any)
  const [noteDraft, setNoteDraft] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  // Counter State
  const [counterTitle, setCounterTitle] = useState('');
  const [counterType, setCounterType] = useState<'since' | 'until'>('since');
  const [counterTargetDate, setCounterTargetDate] = useState(selectedDate);
  const [counterIcon, setCounterIcon] = useState('❤️');

  useEffect(() => {
    if (visible) {
      getMyRole().then(setMyRoleState);
      getMyName().then(setMyNameState);
      getPartnerName().then(setPartnerNameState);

      setActiveTab(initialTab);
      setNoteDraft('');
      setEditingNoteId(null);

      if (eventToEdit) {
        setEventTitle(eventToEdit.title);
        setEventDescription(eventToEdit.description || '');
        setEventStartDate(eventToEdit.startDate);
        setEventEndDate(eventToEdit.endDate);
        setIsAllDay(eventToEdit.isAllDay);
        setStartTime(eventToEdit.startTime || '10:00');
        setEndTime(eventToEdit.endTime || '11:00');
        setEventColor(eventToEdit.color);
        setEventCompleted(Boolean(eventToEdit.completed));
        const mappedTarget =
          eventToEdit.target === 'you'
            ? myRole
            : eventToEdit.target === 'partner'
            ? myRole === 'male' ? 'female' : 'male'
            : (eventToEdit.target as any) || 'both';
        setEventTarget(mappedTarget);
      } else {
        setEventTitle('');
        setEventDescription('');
        setEventStartDate(selectedDate || getLocalDateString());
        setEventEndDate(selectedDate || getLocalDateString());
        setIsAllDay(true);
        setStartTime('10:00');
        setEndTime('11:00');
        setEventColor(EVENT_COLORS[0].value);
        setEventTarget(myRole);
        setEventCompleted(false);
      }

      if (counterToEdit) {
        setCounterTitle(counterToEdit.title);
        setCounterType(counterToEdit.type);
        setCounterTargetDate(counterToEdit.targetDate);
        setCounterIcon(counterToEdit.icon || '❤️');
      } else {
        setCounterTitle('');
        setCounterType('since');
        setCounterTargetDate(selectedDate || getLocalDateString());
        setCounterIcon('❤️');
      }
    }
  }, [visible, selectedDate, initialTab, eventToEdit, counterToEdit]);

  // Formatted date string for header
  const getFormattedDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const monthName = i18n.t(`months.${m - 1}`);
    return `${d} ${monthName} ${y}`;
  };

  // Save Handlers
  const handleSaveEventAction = () => {
    if (!eventTitle.trim()) {
      Alert.alert(i18n.t('error'), 'Lütfen etkinlik başlığı girin.');
      return;
    }

    onSaveEvent({
      id: eventToEdit?.id,
      title: eventTitle.trim(),
      description: eventDescription.trim() || undefined,
      startDate: eventStartDate,
      endDate: eventEndDate,
      isAllDay,
      startTime: !isAllDay ? startTime : undefined,
      endTime: !isAllDay ? endTime : undefined,
      color: eventColor,
      target: eventTarget,
      completed: eventCompleted,
    });
    onClose();
  };

  // Adds a new note, or saves the edit in progress. The modal stays open so
  // several notes can be added in a row.
  const handleSubmitNote = () => {
    const trimmed = noteDraft.trim();
    if (!trimmed) {
      Alert.alert(i18n.t('error'), String(i18n.t('emptyNoteWarning')));
      return;
    }
    onSaveNote(selectedDate, trimmed, editingNoteId ?? undefined);
    setNoteDraft('');
    setEditingNoteId(null);
  };

  const handleEditNote = (note: NoteItem) => {
    setEditingNoteId(note.noteId);
    setNoteDraft(note.content);
  };

  const handleDeleteNoteAction = (note: NoteItem) => {
    Alert.alert(String(i18n.t('delete')), String(i18n.t('deleteNoteConfirm')), [
      { text: String(i18n.t('cancel')), style: 'cancel' },
      {
        text: String(i18n.t('delete')),
        style: 'destructive',
        onPress: () => {
          if (onDeleteNote) onDeleteNote(note.noteId, selectedDate);
          if (editingNoteId === note.noteId) {
            setEditingNoteId(null);
            setNoteDraft('');
          }
        },
      },
    ]);
  };

  const handleSaveCounterAction = () => {
    if (!counterTitle.trim()) {
      Alert.alert(i18n.t('error'), 'Lütfen sayaç başlığı girin.');
      return;
    }

    if (onSaveCounter) {
      onSaveCounter({
        id: counterToEdit?.id,
        title: counterTitle.trim(),
        targetDate: counterTargetDate,
        type: counterType,
        icon: counterIcon,
      });
    }
    onClose();
  };

  const partnerRole = myRole === 'male' ? 'female' : 'male';
  const myLabel = myName ? `${myName} (Sen)` : `${i18n.t('forYou')} (${myRole === 'male' ? '👨 Erkek' : '👩 Kadın'})`;
  const partnerLabel = partnerName
    ? `${partnerName} (Partnerin)`
    : `${i18n.t('forPartner')} (${partnerRole === 'male' ? '👨 Erkek' : '👩 Kadın'})`;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-center items-center bg-black/80 p-4"
      >
        <View className="w-full max-w-lg bg-gray-950 border border-gray-800 rounded-3xl overflow-hidden shadow-2xl max-h-[90%]">
          {/* Header Bar */}
          <View className="flex-row justify-between items-center px-5 pt-4 pb-3 border-b border-gray-900 bg-gray-900/60">
            <View className="flex-row items-center">
              <View className="w-2.5 h-2.5 rounded-full bg-neonCyan mr-2.5" />
              <Text className="text-white font-bold text-base">
                {getFormattedDate(selectedDate)}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              className="p-1"
            >
              <FontAwesome name="times" size={18} color="#888" />
            </TouchableOpacity>
          </View>

          {/* Unified Tab Bar */}
          <View className="flex-row border-b border-gray-900 bg-black/40 px-2 pt-2">
            {/* Event Tab */}
            <TouchableOpacity
              onPress={() => setActiveTab('event')}
              className={`flex-1 py-2.5 items-center justify-center border-b-2 ${
                activeTab === 'event' ? 'border-neonCyan' : 'border-transparent'
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  activeTab === 'event' ? 'text-neonCyan' : 'text-gray-400'
                }`}
              >
                📅 Plan
              </Text>
            </TouchableOpacity>

            {/* Note Tab */}
            <TouchableOpacity
              onPress={() => setActiveTab('note')}
              className={`flex-1 py-2.5 items-center justify-center border-b-2 ${
                activeTab === 'note' ? 'border-neonPink' : 'border-transparent'
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  activeTab === 'note' ? 'text-neonPink' : 'text-gray-400'
                }`}
              >
                📝 Not
              </Text>
            </TouchableOpacity>

            {/* Session Tab */}
            <TouchableOpacity
              onPress={() => setActiveTab('session')}
              className={`flex-1 py-2.5 items-center justify-center border-b-2 ${
                activeTab === 'session' ? 'border-purple-400' : 'border-transparent'
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  activeTab === 'session' ? 'text-purple-400' : 'text-gray-400'
                }`}
              >
                🔢 Sayaç
              </Text>
            </TouchableOpacity>

            {/* Counter Tab */}
            <TouchableOpacity
              onPress={() => setActiveTab('counter')}
              className={`flex-1 py-2.5 items-center justify-center border-b-2 ${
                activeTab === 'counter' ? 'border-yellow-400' : 'border-transparent'
              }`}
            >
              <Text
                className={`text-xs font-bold ${
                  activeTab === 'counter' ? 'text-yellow-400' : 'text-gray-400'
                }`}
              >
                ⭐ Özel Gün
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content Container */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 18 }}
          >
            {/* ========================================================= */}
            {/* TAB 1: PLAN / ETKİNLİK (EVENT)                            */}
            {/* ========================================================= */}
            {activeTab === 'event' && (
              <View className="space-y-4">
                {/* Title Input */}
                <View>
                  <Text className="text-gray-400 text-xs font-bold uppercase mb-1.5">
                    {i18n.t('eventTitle')}
                  </Text>
                  <TextInput
                    value={eventTitle}
                    onChangeText={setEventTitle}
                    placeholder="Örn: Akşam Yemeği, Sinema, Uçak"
                    placeholderTextColor="#555"
                    className="bg-black border border-gray-800 text-white px-3.5 py-2.5 rounded-xl text-sm font-semibold"
                  />
                </View>

                {/* Assignee / Target Choice */}
                <View>
                  <Text className="text-gray-400 text-xs font-bold uppercase mb-1.5">
                    Kimin Planı?
                  </Text>
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => setEventTarget(myRole)}
                      className={`flex-1 py-2 px-1 rounded-xl border items-center justify-center ${
                        eventTarget === myRole
                          ? 'bg-neonCyan/20 border-neonCyan'
                          : 'bg-black/60 border-gray-800'
                      }`}
                    >
                      <Text
                        numberOfLines={1}
                        className={`text-[11px] font-bold ${
                          eventTarget === myRole ? 'text-neonCyan' : 'text-gray-400'
                        }`}
                      >
                        👤 {myLabel}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setEventTarget(partnerRole)}
                      className={`flex-1 py-2 px-1 rounded-xl border items-center justify-center ${
                        eventTarget === partnerRole
                          ? 'bg-neonPink/20 border-neonPink'
                          : 'bg-black/60 border-gray-800'
                      }`}
                    >
                      <Text
                        numberOfLines={1}
                        className={`text-[11px] font-bold ${
                          eventTarget === partnerRole ? 'text-neonPink' : 'text-gray-400'
                        }`}
                      >
                        💖 {partnerLabel}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setEventTarget('both')}
                      className={`flex-1 py-2 px-1 rounded-xl border items-center justify-center ${
                        eventTarget === 'both'
                          ? 'bg-yellow-400/20 border-yellow-400'
                          : 'bg-black/60 border-gray-800'
                      }`}
                    >
                      <Text
                        numberOfLines={1}
                        className={`text-[11px] font-bold ${
                          eventTarget === 'both' ? 'text-yellow-400' : 'text-gray-400'
                        }`}
                      >
                        ✨ İkimiz
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Color Selector */}
                <View>
                  <Text className="text-gray-400 text-xs font-bold uppercase mb-1.5">
                    {i18n.t('eventColor')}
                  </Text>
                  <View className="flex-row justify-between py-1">
                    {EVENT_COLORS.map((c) => (
                      <TouchableOpacity
                        key={c.value}
                        onPress={() => setEventColor(c.value)}
                        className={`w-7 h-7 rounded-full items-center justify-center ${
                          eventColor === c.value ? 'border-2 border-white' : 'opacity-70'
                        }`}
                        style={{ backgroundColor: c.value }}
                      >
                        {eventColor === c.value && (
                          <FontAwesome name="check" size={10} color="#000" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Date Range Selection */}
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <Text className="text-gray-400 text-xs font-bold uppercase mb-1.5">
                      Başlangıç
                    </Text>
                    <TextInput
                      value={eventStartDate}
                      onChangeText={setEventStartDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#555"
                      className="bg-black border border-gray-800 text-white px-3 py-2 rounded-xl text-xs text-center font-mono"
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-400 text-xs font-bold uppercase mb-1.5">
                      Bitiş
                    </Text>
                    <TextInput
                      value={eventEndDate}
                      onChangeText={setEventEndDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#555"
                      className="bg-black border border-gray-800 text-white px-3 py-2 rounded-xl text-xs text-center font-mono"
                    />
                  </View>
                </View>

                {/* All Day Toggle */}
                <View className="flex-row justify-between items-center bg-black/60 p-3 rounded-xl border border-gray-800">
                  <Text className="text-gray-300 text-xs font-bold flex-1 mr-3" numberOfLines={1}>
                    {i18n.t('allDay')}
                  </Text>
                  <Switch
                    value={isAllDay}
                    onValueChange={setIsAllDay}
                    trackColor={{ false: '#374151', true: '#00FFFF' }}
                    thumbColor={isAllDay ? '#000' : '#9ca3af'}
                  />
                </View>

                {/* Time Range (if not all day) */}
                {!isAllDay && (
                  <View className="flex-row gap-2">
                    <TimeField
                      label={String(i18n.t('startTime'))}
                      value={startTime}
                      onChange={(next) => {
                        setStartTime(next);
                        // Keep the range sane: pull the end time along if it fell behind.
                        if (endTime && next > endTime) setEndTime(next);
                      }}
                    />
                    <TimeField
                      label={String(i18n.t('endTime'))}
                      value={endTime}
                      onChange={setEndTime}
                    />
                  </View>
                )}

                {/* Description */}
                <View>
                  <Text className="text-gray-400 text-xs font-bold uppercase mb-1.5">
                    {i18n.t('eventDescription')} (İsteğe Bağlı)
                  </Text>
                  <TextInput
                    value={eventDescription}
                    onChangeText={setEventDescription}
                    placeholder="Adres, not, uçuş no vb."
                    placeholderTextColor="#555"
                    multiline
                    numberOfLines={2}
                    className="bg-black border border-gray-800 text-white px-3.5 py-2.5 rounded-xl text-sm min-h-[55px]"
                  />
                </View>

                {/* Completion state — only meaningful for a saved plan */}
                {eventToEdit && (
                  <TouchableOpacity
                    onPress={() => setEventCompleted(v => !v)}
                    activeOpacity={0.8}
                    className={`flex-row justify-between items-center p-3 rounded-xl border ${
                      eventCompleted
                        ? 'bg-green-950/60 border-green-500/60'
                        : 'bg-black/60 border-gray-800'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        eventCompleted ? 'text-green-400' : 'text-gray-300'
                      }`}
                    >
                      {eventCompleted ? `✓ ${i18n.t('completed')}` : i18n.t('notCompleted')}
                    </Text>
                    <Switch
                      value={eventCompleted}
                      onValueChange={setEventCompleted}
                      trackColor={{ false: '#374151', true: '#22c55e' }}
                      thumbColor={eventCompleted ? '#000' : '#9ca3af'}
                    />
                  </TouchableOpacity>
                )}

                {/* Save & Delete Buttons */}
                <View className="flex-row gap-2 pt-2">
                  {eventToEdit && onDeleteEvent && (
                    <TouchableOpacity
                      onPress={() => {
                        onDeleteEvent(eventToEdit.id);
                        onClose();
                      }}
                      className="bg-red-950/80 border border-red-500/60 p-3 rounded-xl items-center justify-center px-4"
                    >
                      <FontAwesome name="trash" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={handleSaveEventAction}
                    className="flex-1 bg-neonCyan py-3 rounded-xl items-center justify-center"
                  >
                    <Text className="text-black font-extrabold text-sm uppercase tracking-wider">
                      {i18n.t('save')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ========================================================= */}
            {/* TAB 2: GÜNLÜK NOT (NOTE)                                  */}
            {/* ========================================================= */}
            {activeTab === 'note' && (
              <View className="space-y-4">
                <View className="flex-row justify-between items-center">
                  <Text className="text-gray-400 text-xs font-bold uppercase">
                    {getFormattedDate(selectedDate)}
                  </Text>
                  <Text className="text-gray-500 text-xs font-bold">
                    {dayNotes.length} {i18n.t('noteCountSuffix')}
                  </Text>
                </View>

                {/* Existing notes for this day */}
                {dayNotes.length === 0 ? (
                  <View className="py-5 items-center">
                    <FontAwesome name="sticky-note-o" size={24} color="#444" style={{ marginBottom: 8 }} />
                    <Text className="text-gray-500 text-xs">{i18n.t('noNotesForDay')}</Text>
                  </View>
                ) : (
                  <View className="mb-1">
                    {dayNotes.map((note, index) => {
                      const isEditing = editingNoteId === note.noteId;
                      return (
                        <View
                          key={note.noteId}
                          className={`p-3 rounded-2xl mb-2 border flex-row items-start justify-between ${
                            isEditing
                              ? 'bg-purple-950/60 border-neonPink'
                              : 'bg-black/60 border-gray-800'
                          }`}
                        >
                          <TouchableOpacity
                            onPress={() => handleEditNote(note)}
                            activeOpacity={0.8}
                            className="flex-1 mr-2 flex-row items-start"
                          >
                            <Text className="text-gray-600 text-[11px] font-bold mr-2 mt-0.5">
                              {index + 1}.
                            </Text>
                            <Text className="text-purple-100 text-xs flex-1 leading-relaxed">
                              {note.content}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => handleDeleteNoteAction(note)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            className="p-1"
                          >
                            <FontAwesome name="trash" size={14} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Composer: adds a new note, or edits the selected one */}
                <View className="border-t border-gray-900 pt-3">
                  <Text className="text-gray-400 text-xs font-bold uppercase mb-1.5">
                    {editingNoteId ? i18n.t('notes') : i18n.t('newNote')}
                  </Text>
                  <TextInput
                    value={noteDraft}
                    onChangeText={setNoteDraft}
                    placeholder={String(i18n.t('notePlaceholder'))}
                    placeholderTextColor="#555"
                    multiline
                    textAlignVertical="top"
                    className="bg-black border border-gray-800 text-white p-4 rounded-2xl text-sm min-h-[100px] leading-relaxed"
                  />

                  <View className="flex-row gap-2 pt-3">
                    {editingNoteId && (
                      <TouchableOpacity
                        onPress={() => {
                          setEditingNoteId(null);
                          setNoteDraft('');
                        }}
                        className="bg-gray-900 border border-gray-700 px-4 rounded-xl items-center justify-center"
                      >
                        <Text className="text-gray-300 font-bold text-xs uppercase">
                          {i18n.t('cancel')}
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={handleSubmitNote}
                      className="flex-1 bg-neonPink py-3.5 rounded-xl items-center justify-center flex-row"
                    >
                      <FontAwesome
                        name={editingNoteId ? 'check' : 'plus'}
                        size={13}
                        color="#fff"
                        style={{ marginRight: 6 }}
                      />
                      <Text className="text-white font-extrabold text-sm uppercase tracking-wider">
                        {editingNoteId ? i18n.t('save') : i18n.t('addNote')}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    onPress={onClose}
                    className="w-full bg-gray-900 border border-gray-800 py-3 rounded-xl items-center mt-2"
                  >
                    <Text className="text-gray-300 font-bold text-xs uppercase">{i18n.t('done')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ========================================================= */}
            {/* TAB 3: GÜNÜN SAYACI (SESSION COUNT)                       */}
            {/* ========================================================= */}
            {activeTab === 'session' && (
              <View className="items-center py-4 space-y-6">
                <Text className="text-gray-400 text-xs font-bold uppercase">
                  {getFormattedDate(selectedDate)} Toplam Kayıt / Tekrar
                </Text>

                <View className="w-32 h-32 rounded-full bg-cyan-950/40 border-2 border-neonCyan items-center justify-center shadow-lg shadow-neonCyan/40 my-2">
                  <Text className="text-5xl font-black text-neonCyan">{currentSessionCount}</Text>
                </View>

                {onUpdateSessionCount && (
                  <View className="flex-row items-center gap-4 pt-2">
                    <TouchableOpacity
                      onPress={() => onUpdateSessionCount(selectedDate, -1)}
                      className="w-14 h-14 rounded-2xl bg-gray-900 border border-gray-700 items-center justify-center active:bg-gray-800"
                    >
                      <FontAwesome name="minus" size={20} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => onUpdateSessionCount(selectedDate, 1)}
                      className="w-14 h-14 rounded-2xl bg-neonCyan items-center justify-center active:opacity-90"
                    >
                      <FontAwesome name="plus" size={20} color="#000" />
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity
                  onPress={onClose}
                  className="w-full bg-gray-900 border border-gray-800 py-3 rounded-xl items-center mt-4"
                >
                  <Text className="text-gray-300 font-bold text-xs uppercase">{i18n.t('done')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ========================================================= */}
            {/* TAB 4: İLİŞKİ SAYACI & ÖZEL GÜN (COUNTER)                  */}
            {/* ========================================================= */}
            {activeTab === 'counter' && (
              <View className="space-y-4">
                {/* Counter Title */}
                <View>
                  <Text className="text-gray-400 text-xs font-bold uppercase mb-1.5">
                    Sayaç Başlığı
                  </Text>
                  <TextInput
                    value={counterTitle}
                    onChangeText={setCounterTitle}
                    placeholder="Örn: İlk Tanışma, Yıldönümü, Kavuşma"
                    placeholderTextColor="#555"
                    className="bg-black border border-gray-800 text-white px-3.5 py-2.5 rounded-xl text-sm font-semibold"
                  />
                </View>

                {/* Counter Type */}
                <View>
                  <Text className="text-gray-400 text-xs font-bold uppercase mb-1.5">Tür</Text>
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => setCounterType('since')}
                      className={`flex-1 py-2.5 rounded-xl border items-center justify-center ${
                        counterType === 'since'
                          ? 'bg-neonPink/20 border-neonPink'
                          : 'bg-black/60 border-gray-800'
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          counterType === 'since' ? 'text-neonPink' : 'text-gray-400'
                        }`}
                      >
                        🏆 Geçen Zaman (Geçmiş)
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setCounterType('until')}
                      className={`flex-1 py-2.5 rounded-xl border items-center justify-center ${
                        counterType === 'until'
                          ? 'bg-neonCyan/20 border-neonCyan'
                          : 'bg-black/60 border-gray-800'
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          counterType === 'until' ? 'text-neonCyan' : 'text-gray-400'
                        }`}
                      >
                        ✈️ Kalan Zaman (Geri Sayım)
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Target Date */}
                <View>
                  <Text className="text-gray-400 text-xs font-bold uppercase mb-1.5">
                    Hedef Tarih
                  </Text>
                  <TextInput
                    value={counterTargetDate}
                    onChangeText={setCounterTargetDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#555"
                    className="bg-black border border-gray-800 text-white px-3.5 py-2.5 rounded-xl text-sm font-mono text-center"
                  />
                </View>

                {/* Icon Picker */}
                <View>
                  <Text className="text-gray-400 text-xs font-bold uppercase mb-1.5">Simge</Text>
                  <View className="flex-row flex-wrap gap-2 py-1 justify-center">
                    {COUNTER_ICONS.map((ic) => (
                      <TouchableOpacity
                        key={ic}
                        onPress={() => setCounterIcon(ic)}
                        className={`w-10 h-10 rounded-xl items-center justify-center border ${
                          counterIcon === ic
                            ? 'bg-gray-800 border-neonCyan scale-110'
                            : 'bg-black border-gray-800'
                        }`}
                      >
                        <Text className="text-lg">{ic}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Save & Delete Buttons */}
                <View className="flex-row gap-2 pt-2">
                  {counterToEdit && onDeleteCounter && (
                    <TouchableOpacity
                      onPress={() => {
                        onDeleteCounter(counterToEdit.id);
                        onClose();
                      }}
                      className="bg-red-950/80 border border-red-500/60 p-3 rounded-xl items-center justify-center px-4"
                    >
                      <FontAwesome name="trash" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={handleSaveCounterAction}
                    className="flex-1 bg-yellow-400 py-3 rounded-xl items-center justify-center"
                  >
                    <Text className="text-black font-extrabold text-sm uppercase tracking-wider">
                      Sayacı Kaydet
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
