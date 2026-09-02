import React, { useEffect, useState } from 'react';
import { Alert, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

import i18n from '@/i18n';
import { CalendarEvent } from '@/db/events';
import { NoteItem } from '@/db/notes';
import { UserRole } from '@/db/settings';
import { getLocalDateString } from '@/utils/date';
import { getPersonLabels } from '@/utils/labels';
import { useCalendarData } from './CalendarDataProvider';
import AppModal from './ui/AppModal';
import DateField from './DateField';
import TimeField from './TimeField';
import {
  AddIcon,
  CheckIcon,
  DeleteIcon,
  IconColor,
  IconSize,
  MicIcon,
  NoteIcon,
  SaveIcon,
  ScheduleIcon,
  TodayIcon,
} from './ui/icons';

export type ActionTab = 'event' | 'note' | 'session';

const EVENT_COLORS = [
  '#00FFFF',
  '#FF007F',
  '#A855F7',
  '#10B981',
  '#FACC15',
  '#FB923C',
  '#EF4444',
];

interface DayActionModalProps {
  visible: boolean;
  onClose: () => void;
  /** Day the dialog acts on, "YYYY-MM-DD". */
  selectedDate: string;
  initialTab?: ActionTab;
  eventToEdit?: CalendarEvent | null;
  dayNotes?: NoteItem[];
  /** Pre-fills a multi-day plan when a range was dragged out on the grid. */
  dateRange?: { start: string; end: string } | null;
}

const TABS: { key: ActionTab; label: string; Icon: typeof ScheduleIcon; color: string }[] = [
  { key: 'event', label: 'plan', Icon: ScheduleIcon, color: IconColor.cyan },
  { key: 'note', label: 'notes', Icon: NoteIcon, color: IconColor.purple },
  { key: 'session', label: 'microphoneCount', Icon: MicIcon, color: IconColor.pink },
];

/**
 * The one dialog for acting on a day: its plans, its notes and its counter.
 * Actions go straight through the shared calendar store, so callers only say
 * which day (and optionally which event) they are working on.
 */
export default function DayActionModal({
  visible,
  onClose,
  selectedDate,
  initialTab = 'event',
  eventToEdit,
  dayNotes = [],
  dateRange,
}: DayActionModalProps) {
  const data = useCalendarData();
  const labels = getPersonLabels(data.myRole, data.myName, data.partnerName);
  const partnerRole: UserRole = data.myRole === 'male' ? 'female' : 'male';

  const [activeTab, setActiveTab] = useState<ActionTab>(initialTab);

  // Plan state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(selectedDate);
  const [endDate, setEndDate] = useState(selectedDate);
  const [isAllDay, setIsAllDay] = useState(true);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [color, setColor] = useState(EVENT_COLORS[0]);
  const [target, setTarget] = useState<'male' | 'female' | 'both'>(data.myRole);
  const [completed, setCompleted] = useState(false);

  // Note state
  const [noteDraft, setNoteDraft] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;

    setActiveTab(initialTab);
    setNoteDraft('');
    setEditingNoteId(null);

    if (eventToEdit) {
      setTitle(eventToEdit.title);
      setDescription(eventToEdit.description ?? '');
      setStartDate(eventToEdit.startDate);
      setEndDate(eventToEdit.endDate);
      setIsAllDay(eventToEdit.isAllDay);
      setStartTime(eventToEdit.startTime ?? '10:00');
      setEndTime(eventToEdit.endTime ?? '11:00');
      setColor(eventToEdit.color);
      setCompleted(Boolean(eventToEdit.completed));
      setTarget(
        eventToEdit.target === 'you'
          ? data.myRole
          : eventToEdit.target === 'partner'
            ? partnerRole
            : ((eventToEdit.target as 'male' | 'female' | 'both') ?? 'both')
      );
    } else {
      const start = dateRange?.start ?? selectedDate ?? getLocalDateString();
      const end = dateRange?.end ?? selectedDate ?? getLocalDateString();
      setTitle('');
      setDescription('');
      setStartDate(start);
      setEndDate(end);
      setIsAllDay(true);
      setStartTime('10:00');
      setEndTime('11:00');
      setColor(EVENT_COLORS[0]);
      setTarget(data.myRole);
      setCompleted(false);
    }
  }, [visible, selectedDate, initialTab, eventToEdit, dateRange, data.myRole, partnerRole]);

  const formattedDate = (value: string) => {
    if (!value) return '';
    const [y, m, d] = value.split('-').map(Number);
    return `${d} ${i18n.t(`months.${m - 1}`)} ${y}`;
  };

  const subtitle =
    startDate !== endDate ? `${formattedDate(startDate)} → ${formattedDate(endDate)}` : undefined;

  const handleSaveEvent = async () => {
    if (!title.trim()) {
      Alert.alert(String(i18n.t('error')), String(i18n.t('eventTitle')));
      return;
    }
    await data.saveCalendarEvent({
      id: eventToEdit?.id,
      title: title.trim(),
      description: description.trim() || undefined,
      startDate,
      endDate: endDate < startDate ? startDate : endDate,
      isAllDay,
      startTime: isAllDay ? undefined : startTime,
      endTime: isAllDay ? undefined : endTime,
      color,
      target,
      completed,
    });
    onClose();
  };

  const handleDeleteEvent = () => {
    if (!eventToEdit) return;
    Alert.alert(String(i18n.t('deleteEvent')), String(i18n.t('deleteEventConfirm')), [
      { text: String(i18n.t('cancel')), style: 'cancel' },
      {
        text: String(i18n.t('delete')),
        style: 'destructive',
        onPress: async () => {
          await data.removeCalendarEvent(eventToEdit.id);
          onClose();
        },
      },
    ]);
  };

  const handleSubmitNote = async () => {
    const trimmed = noteDraft.trim();
    if (!trimmed) {
      Alert.alert(String(i18n.t('error')), String(i18n.t('emptyNoteWarning')));
      return;
    }
    await data.saveNote(selectedDate, trimmed, editingNoteId ?? undefined);
    setNoteDraft('');
    setEditingNoteId(null);
  };

  const handleDeleteNote = (note: NoteItem) => {
    Alert.alert(String(i18n.t('delete')), String(i18n.t('deleteNoteConfirm')), [
      { text: String(i18n.t('cancel')), style: 'cancel' },
      {
        text: String(i18n.t('delete')),
        style: 'destructive',
        onPress: async () => {
          await data.removeNote(note.noteId);
          if (editingNoteId === note.noteId) {
            setEditingNoteId(null);
            setNoteDraft('');
          }
        },
      },
    ]);
  };

  const sessionCount = data.sessionMap[selectedDate] ?? 0;

  const tabBar = (
    <View className="flex-row border-b border-gray-900 bg-black/40 px-2 pt-2">
      {TABS.map(tab => {
        const active = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            className="flex-1 py-2.5 items-center justify-center border-b-2"
            style={{ borderBottomColor: active ? tab.color : 'transparent' }}
          >
            <View className="flex-row items-center">
              <tab.Icon size={IconSize.sm} color={active ? tab.color : IconColor.muted} />
              <Text
                className="text-xs font-bold ml-1.5"
                style={{ color: active ? tab.color : IconColor.muted }}
              >
                {i18n.t(tab.label)}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const footer =
    activeTab === 'event' ? (
      <View className="flex-row gap-2">
        {eventToEdit && (
          <TouchableOpacity
            onPress={handleDeleteEvent}
            className="bg-red-950/80 border border-red-500/60 px-4 rounded-xl items-center justify-center"
          >
            <DeleteIcon size={IconSize.md} color={IconColor.red} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={handleSaveEvent}
          className="flex-1 bg-neonCyan py-3.5 rounded-xl items-center justify-center flex-row"
        >
          <SaveIcon size={IconSize.sm} color="#000" />
          <Text className="text-black font-extrabold text-sm uppercase tracking-wider ml-2">
            {i18n.t('save')}
          </Text>
        </TouchableOpacity>
      </View>
    ) : activeTab === 'note' ? (
      <View className="flex-row gap-2">
        {editingNoteId && (
          <TouchableOpacity
            onPress={() => {
              setEditingNoteId(null);
              setNoteDraft('');
            }}
            className="bg-gray-900 border border-gray-700 px-4 rounded-xl items-center justify-center"
          >
            <Text className="text-gray-300 font-bold text-xs uppercase">{i18n.t('cancel')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={handleSubmitNote}
          className="flex-1 bg-neonPink py-3.5 rounded-xl items-center justify-center flex-row"
        >
          {editingNoteId ? (
            <CheckIcon size={IconSize.sm} color="#fff" />
          ) : (
            <AddIcon size={IconSize.sm} color="#fff" />
          )}
          <Text className="text-white font-extrabold text-sm uppercase tracking-wider ml-2">
            {editingNoteId ? i18n.t('save') : i18n.t('addNote')}
          </Text>
        </TouchableOpacity>
      </View>
    ) : (
      <TouchableOpacity
        onPress={onClose}
        className="w-full bg-gray-900 border border-gray-800 py-3.5 rounded-xl items-center"
      >
        <Text className="text-gray-300 font-bold text-xs uppercase">{i18n.t('done')}</Text>
      </TouchableOpacity>
    );

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      title={formattedDate(selectedDate)}
      subtitle={subtitle}
      header={tabBar}
      footer={footer}
    >
      {activeTab === 'event' && (
        <View className="gap-4">
          <View>
            <Text className="text-gray-400 text-xs font-bold uppercase mb-1.5">
              {i18n.t('eventTitle')}
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={String(i18n.t('titlePlaceholder'))}
              placeholderTextColor="#555"
              className="bg-black border border-gray-800 text-white px-3.5 py-2.5 rounded-xl text-sm font-semibold"
            />
          </View>

          <View>
            <Text className="text-gray-400 text-xs font-bold uppercase mb-1.5">
              {i18n.t('assignTo')}
            </Text>
            <View className="flex-row gap-2">
              {(
                [
                  { value: data.myRole, label: labels.me, tint: IconColor.cyan },
                  { value: partnerRole, label: labels.partner, tint: IconColor.pink },
                  { value: 'both' as const, label: labels.both, tint: IconColor.yellow },
                ] as const
              ).map(option => {
                const active = target === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => setTarget(option.value)}
                    className="flex-1 py-2.5 px-1 rounded-xl border items-center justify-center"
                    style={{
                      borderColor: active ? option.tint : '#1F2937',
                      backgroundColor: active ? `${option.tint}22` : 'rgba(0,0,0,0.6)',
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      className="text-[11px] font-bold"
                      style={{ color: active ? option.tint : IconColor.muted }}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View>
            <Text className="text-gray-400 text-xs font-bold uppercase mb-1.5">
              {i18n.t('eventColor')}
            </Text>
            <View className="flex-row justify-between py-1">
              {EVENT_COLORS.map(value => (
                <TouchableOpacity
                  key={value}
                  onPress={() => setColor(value)}
                  className={`w-8 h-8 rounded-full items-center justify-center ${
                    color === value ? 'border-2 border-white' : 'opacity-70'
                  }`}
                  style={{ backgroundColor: value }}
                >
                  {color === value && <CheckIcon size={IconSize.xs} color="#000" />}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View className="flex-row gap-2">
            <DateField
              label={String(i18n.t('startDate'))}
              value={startDate}
              onChange={next => {
                setStartDate(next);
                if (endDate < next) setEndDate(next);
              }}
            />
            <DateField
              label={String(i18n.t('endDate'))}
              value={endDate}
              minimumDate={startDate}
              onChange={setEndDate}
            />
          </View>

          <View className="flex-row justify-between items-center bg-black/60 p-3 rounded-xl border border-gray-800">
            <Text className="text-gray-300 text-xs font-bold flex-1 mr-3" numberOfLines={1}>
              {i18n.t('allDay')}
            </Text>
            <Switch
              value={isAllDay}
              onValueChange={setIsAllDay}
              trackColor={{ false: '#374151', true: IconColor.cyan }}
              thumbColor={isAllDay ? '#000' : '#9ca3af'}
            />
          </View>

          {!isAllDay && (
            <View className="flex-row gap-2">
              <TimeField
                label={String(i18n.t('startTime'))}
                value={startTime}
                onChange={next => {
                  setStartTime(next);
                  if (endTime && next > endTime) setEndTime(next);
                }}
              />
              <TimeField label={String(i18n.t('endTime'))} value={endTime} onChange={setEndTime} />
            </View>
          )}

          <View>
            <Text className="text-gray-400 text-xs font-bold uppercase mb-1.5">
              {i18n.t('eventDescription')}
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={String(i18n.t('descPlaceholder'))}
              placeholderTextColor="#555"
              multiline
              textAlignVertical="top"
              className="bg-black border border-gray-800 text-white px-3.5 py-2.5 rounded-xl text-sm min-h-[60px]"
            />
          </View>

          {eventToEdit && (
            <TouchableOpacity
              onPress={() => setCompleted(v => !v)}
              activeOpacity={0.8}
              className={`flex-row justify-between items-center p-3 rounded-xl border ${
                completed ? 'bg-green-950/60 border-green-500/60' : 'bg-black/60 border-gray-800'
              }`}
            >
              <Text
                className={`text-xs font-bold ${completed ? 'text-green-400' : 'text-gray-300'}`}
              >
                {completed ? i18n.t('completed') : i18n.t('notCompleted')}
              </Text>
              <Switch
                value={completed}
                onValueChange={setCompleted}
                trackColor={{ false: '#374151', true: IconColor.green }}
                thumbColor={completed ? '#000' : '#9ca3af'}
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {activeTab === 'note' && (
        <View className="gap-4">
          <View className="flex-row justify-between items-center">
            <Text className="text-gray-400 text-xs font-bold uppercase">
              {formattedDate(selectedDate)}
            </Text>
            <Text className="text-gray-500 text-xs font-bold">
              {dayNotes.length} {i18n.t('noteCountSuffix')}
            </Text>
          </View>

          {dayNotes.length === 0 ? (
            <View className="py-5 items-center">
              <NoteIcon size={IconSize.xl} color={IconColor.faint} />
              <Text className="text-gray-500 text-xs mt-2">{i18n.t('noNotesForDay')}</Text>
            </View>
          ) : (
            dayNotes.map((note, index) => {
              const editing = editingNoteId === note.noteId;
              return (
                <View
                  key={note.noteId}
                  className={`p-3 rounded-2xl border flex-row items-start justify-between ${
                    editing ? 'bg-purple-950/60 border-neonPink' : 'bg-black/60 border-gray-800'
                  }`}
                >
                  <TouchableOpacity
                    onPress={() => {
                      setEditingNoteId(note.noteId);
                      setNoteDraft(note.content);
                    }}
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
                    onPress={() => handleDeleteNote(note)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    className="p-1"
                  >
                    <DeleteIcon size={IconSize.sm} color={IconColor.red} />
                  </TouchableOpacity>
                </View>
              );
            })
          )}

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
          </View>
        </View>
      )}

      {activeTab === 'session' && (
        <View className="items-center py-4 gap-6">
          <Text className="text-gray-400 text-xs font-bold uppercase">
            {i18n.t('microphoneCount')}
          </Text>

          <View className="w-32 h-32 rounded-full bg-pink-950/40 border-2 border-neonPink items-center justify-center my-2">
            <Text className="text-5xl font-black text-neonPink">{sessionCount}</Text>
          </View>

          <View className="flex-row items-center gap-4">
            <TouchableOpacity
              onPress={() => data.updateSessionCount(selectedDate, -1)}
              className="w-14 h-14 rounded-2xl bg-gray-900 border border-gray-700 items-center justify-center"
            >
              <Text className="text-white text-2xl font-bold">−</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => data.updateSessionCount(selectedDate, 1)}
              className="w-14 h-14 rounded-2xl bg-neonPink items-center justify-center"
            >
              <AddIcon size={IconSize.lg} color="#fff" />
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center">
            <TodayIcon size={IconSize.xs} color={IconColor.faint} />
            <Text className="text-gray-600 text-[11px] ml-1.5">{formattedDate(selectedDate)}</Text>
          </View>
        </View>
      )}
    </AppModal>
  );
}
