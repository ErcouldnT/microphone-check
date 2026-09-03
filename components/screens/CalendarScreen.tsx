import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  LayoutChangeEvent,
  PanResponder,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import i18n from '@/i18n';
import { CalendarEvent } from '@/db/events';
import { getCountersForDate } from '@/db/counters';
import { getLocalDateString, parseLocalDate } from '@/utils/date';
import { resolveTarget } from '@/utils/labels';
import { useCalendarData } from '@/components/CalendarDataProvider';
import DayActionModal, { ActionTab } from '@/components/DayActionModal';
import DaySchedule from '@/components/DaySchedule';
import WeekAgenda from '@/components/WeekAgenda';
import DayTimeline from '@/components/DayTimeline';
import SyncStatusPill from '@/components/SyncStatusPill';
import ScreenHeader from '@/components/ui/ScreenHeader';
import {
  AddIcon,
  CloseIcon,
  DayIcon,
  IconColor,
  IconSize,
  MonthIcon,
  NextIcon,
  PrevIcon,
  WeekIcon,
} from '@/components/ui/icons';

type ViewMode = 'month' | 'week' | 'day';
type FilterTarget = 'all' | 'me' | 'partner' | 'both';

const CELL_HEIGHT = 62;

/**
 * The calendar tab: a month/week/day grid plus the selected day's schedule.
 *
 * Milestones, the today summary and the profile controls moved to their own
 * tabs, so this screen only has to do one thing.
 */
export default function CalendarScreen() {
  const data = useCalendarData();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [filter, setFilter] = useState<FilterTarget>('all');

  // Drag-to-select across days
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const gridLayout = useRef({ x: 0, y: 0, width: 0 });

  const [modalVisible, setModalVisible] = useState(false);
  const [modalTab, setModalTab] = useState<ActionTab>('event');
  const [eventToEdit, setEventToEdit] = useState<CalendarEvent | null>(null);
  const [pendingRange, setPendingRange] = useState<{ start: string; end: string } | null>(null);

  // A notification tap (or any other jump request) lands here.
  useEffect(() => {
    if (!data.focusRequest) return;
    const { date } = data.focusRequest;
    setSelectedDate(date);
    setCurrentDate(parseLocalDate(date));
    setViewMode('day');
    clearSelection();
  }, [data.focusRequest]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const todayStr = getLocalDateString();

  const filteredEvents = useMemo(
    () =>
      data.events.filter(event => {
        if (filter === 'all') return true;
        return resolveTarget(event.target, data.myRole) === filter;
      }),
    [data.events, filter, data.myRole]
  );

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (() => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Monday-first grid
  })();

  const monthDays = useMemo(() => {
    const cells: (string | null)[] = Array.from({ length: firstWeekday }, () => null);
    for (let d = 1; d <= daysInMonth; d += 1) {
      cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return cells;
  }, [year, month, daysInMonth, firstWeekday]);

  /** Maps a touch inside the grid to the date under the finger. */
  const dateAtTouch = (event: GestureResponderEvent): string | null => {
    const { width } = gridLayout.current;
    if (!width) return null;

    const localX = event.nativeEvent.pageX - gridLayout.current.x;
    const localY = event.nativeEvent.pageY - gridLayout.current.y;
    const column = Math.floor(localX / (width / 7));
    const row = Math.floor(localY / CELL_HEIGHT);
    if (column < 0 || column > 6 || row < 0) return null;

    const index = row * 7 + column;
    const cell = monthDays[index];
    return cell ?? null;
  };

  const panResponder = useRef(
    PanResponder.create({
      // Only claim the gesture once the finger actually travels, so plain taps
      // still reach the day cells underneath.
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        Math.abs(gesture.dx) > 12 || Math.abs(gesture.dy) > 12,
      onPanResponderGrant: evt => {
        const date = dateAtTouch(evt);
        if (date) {
          setRangeStart(date);
          setRangeEnd(date);
        }
      },
      onPanResponderMove: evt => {
        const date = dateAtTouch(evt);
        if (date) setRangeEnd(date);
      },
    })
  ).current;

  const selection = useMemo(() => {
    if (!rangeStart || !rangeEnd) return null;
    const [start, end] = rangeStart <= rangeEnd ? [rangeStart, rangeEnd] : [rangeEnd, rangeStart];
    return { start, end };
  }, [rangeStart, rangeEnd]);

  const selectedCount = useMemo(() => {
    if (!selection) return 0;
    const start = new Date(selection.start);
    const end = new Date(selection.end);
    return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  }, [selection]);

  const clearSelection = () => {
    setRangeStart(null);
    setRangeEnd(null);
  };

  const openModal = (tab: ActionTab, event: CalendarEvent | null = null, date?: string) => {
    if (date) setSelectedDate(date);
    setEventToEdit(event);
    setModalTab(tab);
    setPendingRange(null);
    setModalVisible(true);
  };

  const openRangeModal = () => {
    if (!selection) return;
    setSelectedDate(selection.start);
    setEventToEdit(null);
    setModalTab('event');
    setPendingRange(selection);
    setModalVisible(true);
  };

  const shiftMonth = (delta: number) => setCurrentDate(new Date(year, month + delta, 1));

  const viewButtons: { mode: ViewMode; label: string; Icon: typeof MonthIcon }[] = [
    { mode: 'month', label: 'monthView', Icon: MonthIcon },
    { mode: 'week', label: 'weekView', Icon: WeekIcon },
    { mode: 'day', label: 'dayView', Icon: DayIcon },
  ];

  const filterButtons: { key: FilterTarget; label: string; tint: string }[] = [
    { key: 'all', label: String(i18n.t('all')), tint: '#FFFFFF' },
    { key: 'me', label: data.myName || String(i18n.t('forYou')), tint: IconColor.cyan },
    { key: 'partner', label: data.partnerName || String(i18n.t('forPartner')), tint: IconColor.pink },
    { key: 'both', label: String(i18n.t('forBoth')), tint: IconColor.yellow },
  ];

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top', 'left', 'right']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <ScreenHeader title={String(i18n.t('calendar'))} action={<SyncStatusPill />} />

        {/* View switcher */}
        <View className="flex-row bg-gray-950 border border-gray-800 p-1 rounded-2xl mb-3">
          {viewButtons.map(({ mode, label, Icon }) => {
            const active = viewMode === mode;
            return (
              <TouchableOpacity
                key={mode}
                onPress={() => {
                  setViewMode(mode);
                  if (mode !== 'month') {
                    setCurrentDate(new Date());
                    setSelectedDate(todayStr);
                  }
                  clearSelection();
                }}
                className={`flex-1 py-2 rounded-xl items-center flex-row justify-center ${
                  active ? 'bg-cyan-950 border border-neonCyan' : ''
                }`}
              >
                <Icon size={IconSize.sm} color={active ? IconColor.cyan : IconColor.muted} />
                <Text
                  className="font-extrabold text-xs ml-1.5"
                  style={{ color: active ? IconColor.cyan : IconColor.muted }}
                >
                  {i18n.t(label)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Assignee filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
          {filterButtons.map(({ key, label, tint }) => {
            const active = filter === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => setFilter(key)}
                className="px-3 py-1.5 rounded-full mr-2 border"
                style={{
                  borderColor: active ? tint : '#1F2937',
                  backgroundColor: active ? `${tint}1F` : '#0A0A0F',
                }}
              >
                <Text
                  className="text-xs font-bold"
                  style={{ color: active ? tint : IconColor.muted }}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {viewMode === 'month' && (
          <View>
            <View className="flex-row justify-between items-center mb-3">
              <TouchableOpacity onPress={() => shiftMonth(-1)} className="p-2">
                <PrevIcon size={IconSize.lg} color={IconColor.cyan} />
              </TouchableOpacity>
              <Text className="text-xl text-white font-extrabold">
                {i18n.t(`months.${month}`)} {year}
              </Text>
              <TouchableOpacity onPress={() => shiftMonth(1)} className="p-2">
                <NextIcon size={IconSize.lg} color={IconColor.cyan} />
              </TouchableOpacity>
            </View>

            <View className="flex-row mb-1 border-b border-gray-800 pb-2">
              {(i18n.t('daysShort') as unknown as string[]).map(day => (
                <View key={day} className="flex-1 items-center">
                  <Text className="text-gray-500 font-bold uppercase text-[11px]">{day}</Text>
                </View>
              ))}
            </View>

            <View
              className="flex-row flex-wrap"
              onLayout={(e: LayoutChangeEvent) => {
                e.currentTarget.measureInWindow((x, y, width) => {
                  gridLayout.current = { x, y, width };
                });
              }}
              {...panResponder.panHandlers}
            >
              {monthDays.map((dateStr, index) => {
                if (!dateStr) {
                  return <View key={`blank-${index}`} style={{ width: '14.28%', height: CELL_HEIGHT }} />;
                }

                const dayEvents = filteredEvents.filter(
                  e => e.startDate <= dateStr && e.endDate >= dateStr
                );
                const noteCount = data.notesByDate[dateStr]?.length ?? 0;
                const dayCounters = getCountersForDate(data.counters, dateStr);
                const isSelected = dateStr === selectedDate;
                const isToday = dateStr === todayStr;
                const inRange =
                  selection !== null && dateStr >= selection.start && dateStr <= selection.end;

                return (
                  <TouchableOpacity
                    key={dateStr}
                    activeOpacity={0.8}
                    onPress={() => {
                      clearSelection();
                      setSelectedDate(dateStr);
                    }}
                    onLongPress={() => openModal('event', null, dateStr)}
                    delayLongPress={320}
                    style={{ width: '14.28%', height: CELL_HEIGHT }}
                    className={`p-1 border-[0.5px] border-gray-900 justify-between ${
                      inRange
                        ? 'bg-cyan-950/60 border-neonCyan'
                        : isSelected
                          ? 'bg-gray-900 border-neonCyan/80'
                          : isToday
                            ? 'bg-gray-950 border-gray-700'
                            : 'bg-black'
                    }`}
                  >
                    <View className="flex-row justify-between items-center">
                      <Text
                        className={`text-[11px] font-bold ${
                          isToday ? 'text-neonCyan' : isSelected ? 'text-white' : 'text-gray-400'
                        }`}
                      >
                        {Number(dateStr.slice(-2))}
                      </Text>
                      <View className="flex-row items-center">
                        {noteCount > 0 && (
                          <View className="w-1.5 h-1.5 rounded-full bg-purple-400 mr-0.5" />
                        )}
                        {dayCounters.length > 0 && (
                          <View className="w-1.5 h-1.5 rounded-full bg-neonPink" />
                        )}
                      </View>
                    </View>

                    <View className="overflow-hidden">
                      {dayEvents.slice(0, 2).map(event => (
                        <View
                          key={event.id}
                          style={{ backgroundColor: event.color || IconColor.cyan }}
                          className={`px-1 rounded-[3px] mb-0.5 ${event.completed ? 'opacity-50' : ''}`}
                        >
                          <Text
                            className={`text-[8px] font-extrabold text-black ${
                              event.completed ? 'line-through' : ''
                            }`}
                            numberOfLines={1}
                          >
                            {event.title}
                          </Text>
                        </View>
                      ))}
                      {dayEvents.length > 2 && (
                        <Text className="text-[8px] text-gray-500 font-bold">
                          +{dayEvents.length - 2}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {selection && selectedCount > 1 ? (
              <View className="flex-row items-center bg-cyan-950/40 border border-neonCyan/50 rounded-2xl p-3 mt-3">
                <Text className="text-neonCyan text-xs font-bold flex-1">
                  {i18n.t('daysSelected', { count: selectedCount })}
                </Text>
                <TouchableOpacity
                  onPress={openRangeModal}
                  className="bg-neonCyan px-3 py-1.5 rounded-full flex-row items-center mr-2"
                >
                  <AddIcon size={IconSize.xs} color="#000" />
                  <Text className="text-black text-[11px] font-extrabold ml-1">
                    {i18n.t('addPlan')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={clearSelection} className="p-1">
                  <CloseIcon size={IconSize.sm} color={IconColor.muted} />
                </TouchableOpacity>
              </View>
            ) : (
              <Text className="text-gray-600 text-[11px] mt-2.5 text-center">
                {i18n.t('multiDayHint')}
              </Text>
            )}

            <DaySchedule
              date={selectedDate}
              events={filteredEvents}
              onAddEvent={date => openModal('event', null, date)}
              onEditEvent={event => openModal('event', event, event.startDate)}
              onEditNotes={date => openModal('note', null, date)}
            />
          </View>
        )}

        {viewMode === 'week' && (
          <WeekAgenda
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            events={filteredEvents}
            onAddEvent={date => openModal('event', null, date)}
            onEditEvent={event => openModal('event', event, event.startDate)}
          />
        )}

        {viewMode === 'day' && (
          <DayTimeline
            date={selectedDate}
            onDateChange={setSelectedDate}
            events={filteredEvents}
            onAddEvent={(date, time) => openModal('event', null, date)}
            onEditEvent={event => openModal('event', event, event.startDate)}
            onEditNotes={date => openModal('note', null, date)}
          />
        )}
      </ScrollView>

      <DayActionModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setPendingRange(null);
          clearSelection();
        }}
        selectedDate={selectedDate}
        initialTab={modalTab}
        eventToEdit={eventToEdit}
        dayNotes={data.notesByDate[selectedDate] ?? []}
        dateRange={pendingRange}
      />
    </SafeAreaView>
  );
}
