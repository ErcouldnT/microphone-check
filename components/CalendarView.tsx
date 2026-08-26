import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { eq } from 'drizzle-orm';
import { useFocusEffect } from 'expo-router';

import i18n from '@/i18n';
import { db } from '@/db/client';
import { sessions } from '@/db/schema';
import { getAllNotes, setNoteByDate, deleteNoteByDate } from '@/db/notes';
import { CalendarEvent, getAllEvents, saveEvent, deleteEvent } from '@/db/events';
import { RelationshipCounter, getAllCounters, getCountersForDate } from '@/db/counters';
import { syncService, ConnectionStatus } from '@/services/syncService';
import { UserRole, getMyRole, getMyName, getPartnerName } from '@/db/settings';
import { getLocalDateString } from '@/utils/date';

import PairingModal from './PairingModal';
import DayNoteModal from './DayNoteModal';
import EventModal from './EventModal';
import DailyScheduleList from './DailyScheduleList';
import RelationshipCounterCard from './RelationshipCounterCard';
import WeekView from './WeekView';
import DayView from './DayView';
import ProfileRoleModal from './ProfileRoleModal';
import InAppNotificationToast from './InAppNotificationToast';

const getDaysShort = () => i18n.t('daysShort') as unknown as string[];

export default function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [filterTarget, setFilterTarget] = useState<'all' | 'you' | 'partner' | 'both'>('all');

  // User Role & Profile
  const [myRole, setMyRoleState] = useState<UserRole>('male');
  const [myName, setMyNameState] = useState<string>('');
  const [partnerName, setPartnerNameState] = useState<string>('');

  const [sessionMap, setSessionMap] = useState<Record<string, number>>({});
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [eventsList, setEventsList] = useState<CalendarEvent[]>([]);
  const [countersList, setCountersList] = useState<RelationshipCounter[]>([]);

  // Modals
  const [pairingModalVisible, setPairingModalVisible] = useState(false);
  const [dayNoteModalVisible, setDayNoteModalVisible] = useState(false);
  const [eventModalVisible, setEventModalVisible] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [selectedEventToEdit, setSelectedEventToEdit] = useState<CalendarEvent | null>(null);

  // Sync state
  const [syncStatus, setSyncStatus] = useState<ConnectionStatus>('local');
  const [roomCode, setRoomCode] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const [monthStats, setMonthStats] = useState({ days: 0, count: 0 });

  const loadData = async () => {
    try {
      // 1. User Profile
      const savedRole = await getMyRole();
      const savedName = await getMyName();
      const savedPartnerName = await getPartnerName();
      setMyRoleState(savedRole);
      setMyNameState(savedName);
      setPartnerNameState(savedPartnerName);

      // 2. Sessions
      const allSessions = await db.select().from(sessions);
      const sMap: Record<string, number> = {};
      allSessions.forEach(s => {
        sMap[s.date] = (sMap[s.date] || 0) + s.count;
      });
      setSessionMap(sMap);
      calculateMonthStats(sMap, year, month);

      // 3. Notes
      const allNotes = await getAllNotes();
      const nMap: Record<string, string> = {};
      allNotes.forEach(n => {
        if (n.content?.trim()) nMap[n.date] = n.content.trim();
      });
      setNoteMap(nMap);

      // 4. Events
      const allEv = await getAllEvents();
      setEventsList(allEv);

      // 5. Counters
      const allCnt = await getAllCounters();
      setCountersList(allCnt);
    } catch (e) {
      console.error('Error loading calendar data:', e);
    }
  };

  const calculateMonthStats = (map: Record<string, number>, y: number, m: number) => {
    let days = 0;
    let count = 0;
    const prefix = `${y}-${String(m + 1).padStart(2, '0')}`;
    Object.keys(map).forEach(date => {
      if (date.startsWith(prefix) && map[date] > 0) {
        days++;
        count += map[date];
      }
    });
    setMonthStats({ days, count });
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
      setSyncStatus(syncService.getStatus());
      setRoomCode(syncService.getRoomCode());
    }, [])
  );

  useEffect(() => {
    const unsubSession = syncService.addSessionListener(({ date, count }) => {
      setSessionMap(prev => {
        const next = { ...prev };
        if (count <= 0) delete next[date];
        else next[date] = count;
        calculateMonthStats(next, year, month);
        return next;
      });
    });

    const unsubNote = syncService.addNoteListener(({ date, content }) => {
      setNoteMap(prev => {
        const next = { ...prev };
        if (!content || !content.trim()) delete next[date];
        else next[date] = content.trim();
        return next;
      });
    });

    const unsubEvent = syncService.addEventListener(() => {
      loadData();
    });

    const unsubCounter = syncService.addCounterListener(() => {
      loadData();
    });

    const unsubSync = syncService.addSyncListener(() => {
      loadData();
      setRoomCode(syncService.getRoomCode());
    });

    const unsubStatus = syncService.addStatusListener((newStatus) => {
      setSyncStatus(newStatus);
      setRoomCode(syncService.getRoomCode());
    });

    return () => {
      unsubSession();
      unsubNote();
      unsubEvent();
      unsubCounter();
      unsubSync();
      unsubStatus();
    };
  }, [year, month]);

  // Calendar calculations
  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => {
    const day = new Date(y, m, 1).getDay(); // 0(Sun) - 6(Sat)
    return day === 0 ? 6 : day - 1; // Monday start
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const handlePrevMonth = () => {
    const newDate = new Date(year, month - 1, 1);
    setCurrentDate(newDate);
    calculateMonthStats(sessionMap, newDate.getFullYear(), newDate.getMonth());
  };

  const handleNextMonth = () => {
    const newDate = new Date(year, month + 1, 1);
    setCurrentDate(newDate);
    calculateMonthStats(sessionMap, newDate.getFullYear(), newDate.getMonth());
  };

  // View mode tab switcher with instant focus on current week / today
  const handleSwitchViewMode = (mode: 'month' | 'week' | 'day') => {
    setViewMode(mode);
    const today = new Date();
    const todayStr = getLocalDateString(today);

    if (mode === 'week') {
      setCurrentDate(today);
    } else if (mode === 'day') {
      setCurrentDate(today);
      setSelectedDate(todayStr);
    }
  };

  // Session update helper
  const updateSession = async (dayString: string, change: number) => {
    try {
      const existing = await db.select().from(sessions).where(eq(sessions.date, dayString));
      let newCount = 0;

      if (existing.length > 0) {
        const currentTotal = existing.reduce((acc, curr) => acc + curr.count, 0);
        newCount = currentTotal + change;

        if (newCount <= 0) {
          newCount = 0;
          await db.delete(sessions).where(eq(sessions.date, dayString));
        } else {
          const firstId = existing[0].id;
          await db.update(sessions).set({ count: newCount }).where(eq(sessions.id, firstId));
          if (existing.length > 1) {
            for (let i = 1; i < existing.length; i++) {
              await db.delete(sessions).where(eq(sessions.id, existing[i].id));
            }
          }
        }
      } else {
        if (change > 0) {
          newCount = change;
          await db.insert(sessions).values({ date: dayString, count: change });
        }
      }

      setSessionMap(prev => {
        const next = { ...prev };
        if (newCount <= 0) delete next[dayString];
        else next[dayString] = newCount;
        calculateMonthStats(next, year, month);
        return next;
      });

      syncService.sendSessionUpdate(dayString, newCount);
    } catch (e) {
      console.error(e);
    }
  };

  // Event handlers
  const handleOpenAddEvent = (dateStr: string, time?: string) => {
    setSelectedDate(dateStr);
    setSelectedEventToEdit(null);
    setEventModalVisible(true);
  };

  const handleOpenEditEvent = (event: CalendarEvent) => {
    setSelectedEventToEdit(event);
    setEventModalVisible(true);
  };

  const handleSaveEvent = async (event: CalendarEvent) => {
    await saveEvent(event);
    syncService.sendEventUpdate(event);
    loadData();
  };

  const handleDeleteEvent = async (eventId: string) => {
    await deleteEvent(eventId);
    syncService.sendEventDelete(eventId);
    loadData();
  };

  // Filter events by target with role/gender awareness!
  const partnerRole: UserRole = myRole === 'male' ? 'female' : 'male';

  const filteredEvents = eventsList.filter(e => {
    if (filterTarget === 'all') return true;
    if (filterTarget === 'both') return e.target === 'both';

    if (filterTarget === 'you') {
      return e.target === myRole || e.target === 'you' || e.target === 'both';
    }

    if (filterTarget === 'partner') {
      return e.target === partnerRole || e.target === 'partner' || e.target === 'both';
    }

    return true;
  });

  const selectedDayEvents = filteredEvents.filter(
    e => e.startDate <= selectedDate && e.endDate >= selectedDate
  );

  const selectedDayCounters = getCountersForDate(countersList, selectedDate);

  // Month grid rendering
  const renderMonthDays = () => {
    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`blank-${i}`} className="w-[14.2%] h-[74px] p-0.5" />);
    }

    const todayStr = getLocalDateString(new Date());

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const count = sessionMap[dateStr] || 0;
      const hasNote = Boolean(noteMap[dateStr]);
      const isSelected = dateStr === selectedDate;
      const isToday = dateStr === todayStr;

      const dayEvents = filteredEvents.filter(
        e => e.startDate <= dateStr && e.endDate >= dateStr
      );

      const dayCounters = getCountersForDate(countersList, dateStr);

      days.push(
        <TouchableOpacity
          key={d}
          activeOpacity={0.8}
          onPress={() => setSelectedDate(dateStr)}
          onLongPress={() => {
            setSelectedDate(dateStr);
            setDayNoteModalVisible(true);
          }}
          delayLongPress={350}
          className={`w-[14.2%] h-[74px] p-1 border-[0.5px] border-gray-900 justify-between ${
            isSelected
              ? 'bg-gray-900 border-neonCyan/80'
              : isToday
              ? 'bg-gray-950 border-gray-700'
              : 'bg-black'
          }`}
        >
          {/* Day Number and Badges Header */}
          <View className="flex-row justify-between items-center">
            <Text
              className={`text-xs font-bold ${
                isToday ? 'text-neonCyan' : isSelected ? 'text-white' : count > 0 ? 'text-neonPink' : 'text-gray-400'
              }`}
            >
              {d}
            </Text>

            <View className="flex-row items-center">
              {hasNote && (
                <View className="w-1.5 h-1.5 rounded-full bg-purple-400 mr-1" />
              )}
              {count > 0 && (
                <View className="flex-row items-center">
                  <FontAwesome name="microphone" size={8} color="#00FFFF" />
                  <Text className="text-[9px] text-neonCyan font-bold ml-0.5">
                    {count > 9 ? '9+' : count}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Event & Counter Pills inside Day Cell */}
          <View className="space-y-0.5 overflow-hidden">
            {/* Automatic Milestone Badges */}
            {dayCounters.slice(0, 1).map(c => (
              <View
                key={c.id}
                className="bg-pink-950/80 border border-neonPink/60 px-1 py-0.5 rounded-[3px] mb-0.5 flex-row items-center"
              >
                <Text className="text-[7px] text-white font-extrabold mr-0.5">{c.icon || '❤️'}</Text>
                <Text className="text-[7px] font-extrabold text-neonPink flex-1" numberOfLines={1}>
                  {c.title}
                </Text>
              </View>
            ))}

            {/* Event Pills */}
            {dayEvents.slice(0, dayCounters.length > 0 ? 1 : 2).map(e => (
              <View
                key={e.id}
                style={{ backgroundColor: e.color || '#00FFFF' }}
                className="px-1 py-0.5 rounded-[3px] mb-0.5"
              >
                <Text
                  className="text-[8px] font-extrabold text-black"
                  numberOfLines={1}
                >
                  {e.title}
                </Text>
              </View>
            ))}

            {(dayEvents.length + dayCounters.length) > 2 && (
              <Text className="text-[8px] text-gray-500 font-bold">
                +{(dayEvents.length + dayCounters.length) - 2}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      );
    }
    return days;
  };

  const getStatusIndicator = () => {
    if (!roomCode) {
      return (
        <TouchableOpacity
          onPress={() => setPairingModalVisible(true)}
          className="flex-row items-center bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-full"
        >
          <FontAwesome name="users" size={12} color="#00FFFF" style={{ marginRight: 6 }} />
          <Text className="text-neonCyan text-xs font-bold">{i18n.t('pairWithFriend')}</Text>
        </TouchableOpacity>
      );
    }

    let dotColor = 'bg-gray-400';
    if (syncStatus === 'connected') dotColor = 'bg-green-400';
    else if (syncStatus === 'connecting') dotColor = 'bg-yellow-400';
    else if (syncStatus === 'disconnected') dotColor = 'bg-red-400';

    return (
      <TouchableOpacity
        onPress={() => setPairingModalVisible(true)}
        className="flex-row items-center bg-gray-900 border border-neonCyan/40 px-3 py-1.5 rounded-full"
      >
        <View className={`w-2 h-2 rounded-full ${dotColor} mr-2`} />
        <Text className="text-white text-xs font-bold tracking-wider mr-1">{roomCode}</Text>
        <FontAwesome name="exchange" size={10} color="#00FFFF" />
      </TouchableOpacity>
    );
  };

  const myFilterLabel = myName ? `${myName} (Sen)` : `${i18n.t('forYou')} (${myRole === 'male' ? '👨' : '👩'})`;
  const partnerFilterLabel = partnerName ? `${partnerName} (Partnerin)` : `${i18n.t('forPartner')} (${partnerRole === 'male' ? '👨' : '👩'})`;

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top', 'left', 'right']}>
      <InAppNotificationToast />

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 p-4">
        {/* Top Header Bar */}
        <View className="flex-row justify-between items-center mb-4">
          <View className="flex-row items-center">
            <Text className="text-white font-extrabold text-lg tracking-wider mr-2">
              MICROPHONE<Text className="text-neonCyan">CHECK</Text>
            </Text>

            {/* Profile Role Quick Pill */}
            <TouchableOpacity
              onPress={() => setProfileModalVisible(true)}
              className="bg-gray-900 border border-gray-800 px-2.5 py-1 rounded-full flex-row items-center"
            >
              <Text className="text-xs mr-1">{myRole === 'male' ? '👨' : '👩'}</Text>
              <Text className="text-gray-300 text-[11px] font-bold">
                {myName || (myRole === 'male' ? i18n.t('forMale') : i18n.t('forFemale'))}
              </Text>
            </TouchableOpacity>
          </View>

          {getStatusIndicator()}
        </View>

        {/* Milestone & Relationship Counters */}
        <RelationshipCounterCard />

        {/* View Switcher: [ Month | Week | Day ] */}
        <View className="flex-row bg-gray-900 border border-gray-800 p-1 rounded-2xl mb-4">
          <TouchableOpacity
            onPress={() => handleSwitchViewMode('month')}
            className={`flex-1 py-2 rounded-xl items-center flex-row justify-center ${
              viewMode === 'month' ? 'bg-cyan-950 border border-neonCyan' : ''
            }`}
          >
            <FontAwesome
              name="calendar"
              size={12}
              color={viewMode === 'month' ? '#00FFFF' : '#888'}
              style={{ marginRight: 6 }}
            />
            <Text className={`font-extrabold text-xs ${viewMode === 'month' ? 'text-neonCyan' : 'text-gray-400'}`}>
              {i18n.t('monthView')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleSwitchViewMode('week')}
            className={`flex-1 py-2 rounded-xl items-center flex-row justify-center ${
              viewMode === 'week' ? 'bg-cyan-950 border border-neonCyan' : ''
            }`}
          >
            <FontAwesome
              name="columns"
              size={12}
              color={viewMode === 'week' ? '#00FFFF' : '#888'}
              style={{ marginRight: 6 }}
            />
            <Text className={`font-extrabold text-xs ${viewMode === 'week' ? 'text-neonCyan' : 'text-gray-400'}`}>
              {i18n.t('weekView')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleSwitchViewMode('day')}
            className={`flex-1 py-2 rounded-xl items-center flex-row justify-center ${
              viewMode === 'day' ? 'bg-cyan-950 border border-neonCyan' : ''
            }`}
          >
            <FontAwesome
              name="clock-o"
              size={14}
              color={viewMode === 'day' ? '#00FFFF' : '#888'}
              style={{ marginRight: 6 }}
            />
            <Text className={`font-extrabold text-xs ${viewMode === 'day' ? 'text-neonCyan' : 'text-gray-400'}`}>
              {i18n.t('dayView')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Member / Assignee Filter Pills */}
        <View className="flex-row mb-4">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
            <TouchableOpacity
              onPress={() => setFilterTarget('all')}
              className={`px-3 py-1.5 rounded-full mr-2 border ${
                filterTarget === 'all' ? 'bg-gray-800 border-white' : 'bg-gray-950 border-gray-800'
              }`}
            >
              <Text className={`text-xs font-bold ${filterTarget === 'all' ? 'text-white' : 'text-gray-400'}`}>
                {i18n.t('all')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFilterTarget('you')}
              className={`px-3 py-1.5 rounded-full mr-2 border ${
                filterTarget === 'you' ? 'bg-cyan-950 border-neonCyan' : 'bg-gray-950 border-gray-800'
              }`}
            >
              <Text className={`text-xs font-bold ${filterTarget === 'you' ? 'text-neonCyan' : 'text-gray-400'}`}>
                👤 {myFilterLabel}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFilterTarget('partner')}
              className={`px-3 py-1.5 rounded-full mr-2 border ${
                filterTarget === 'partner' ? 'bg-pink-950 border-neonPink' : 'bg-gray-950 border-gray-800'
              }`}
            >
              <Text className={`text-xs font-bold ${filterTarget === 'partner' ? 'text-neonPink' : 'text-gray-400'}`}>
                💖 {partnerFilterLabel}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFilterTarget('both')}
              className={`px-3 py-1.5 rounded-full border ${
                filterTarget === 'both' ? 'bg-yellow-950 border-yellow-400' : 'bg-gray-950 border-gray-800'
              }`}
            >
              <Text className={`text-xs font-bold ${filterTarget === 'both' ? 'text-yellow-400' : 'text-gray-400'}`}>
                ✨ {i18n.t('forBoth')}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* View Mode Rendering */}
        {viewMode === 'month' && (
          <View>
            {/* Month Navigator Header */}
            <View className="flex-row justify-between items-center mb-4">
              <TouchableOpacity onPress={handlePrevMonth} className="p-2">
                <FontAwesome name="chevron-left" size={22} color="#00FFFF" />
              </TouchableOpacity>
              <Text className="text-2xl text-white font-extrabold">
                {i18n.t(`months.${currentDate.getMonth()}`)} {currentDate.getFullYear()}
              </Text>
              <TouchableOpacity onPress={handleNextMonth} className="p-2">
                <FontAwesome name="chevron-right" size={22} color="#00FFFF" />
              </TouchableOpacity>
            </View>

            {/* Week Days Header */}
            <View className="flex-row mb-1 border-b border-gray-800 pb-2">
              {getDaysShort().map((day: string, index: number) => (
                <View key={index} className="w-[14.2%] items-center">
                  <Text className="text-gray-500 font-bold uppercase text-xs">{day}</Text>
                </View>
              ))}
            </View>

            {/* Month Days Grid */}
            <View className="flex-row flex-wrap border-b border-gray-800 pb-2">
              {renderMonthDays()}
            </View>

            {/* Daily Schedule Below the Grid */}
            <DailyScheduleList
              selectedDate={selectedDate}
              events={selectedDayEvents}
              counters={selectedDayCounters}
              myRole={myRole}
              myName={myName}
              partnerName={partnerName}
              onAddEvent={handleOpenAddEvent}
              onEditEvent={handleOpenEditEvent}
              dailyNote={noteMap[selectedDate]}
              onEditNote={(dateStr) => {
                setSelectedDate(dateStr);
                setDayNoteModalVisible(true);
              }}
            />
          </View>
        )}

        {viewMode === 'week' && (
          <WeekView
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            events={filteredEvents}
            counters={countersList}
            sessionMap={sessionMap}
            myRole={myRole}
            myName={myName}
            partnerName={partnerName}
            onAddEvent={handleOpenAddEvent}
            onEditEvent={handleOpenEditEvent}
          />
        )}

        {viewMode === 'day' && (
          <DayView
            currentDate={new Date(selectedDate)}
            onDateChange={(d) => {
              const str = getLocalDateString(d);
              setSelectedDate(str);
            }}
            events={filteredEvents}
            counters={countersList}
            sessionMap={sessionMap}
            myRole={myRole}
            myName={myName}
            partnerName={partnerName}
            onAddEvent={handleOpenAddEvent}
            onEditEvent={handleOpenEditEvent}
            dailyNote={noteMap[selectedDate]}
            onEditNote={(dateStr) => {
              setSelectedDate(dateStr);
              setDayNoteModalVisible(true);
            }}
          />
        )}
      </ScrollView>

      {/* Modals */}
      <EventModal
        visible={eventModalVisible}
        eventToEdit={selectedEventToEdit}
        defaultDate={selectedDate}
        myRole={myRole}
        myName={myName}
        partnerName={partnerName}
        onClose={() => setEventModalVisible(false)}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
      />

      <DayNoteModal
        visible={dayNoteModalVisible}
        date={selectedDate}
        initialCount={sessionMap[selectedDate] || 0}
        initialNote={noteMap[selectedDate] || ''}
        onClose={() => setDayNoteModalVisible(false)}
        onSave={async (dStr, newCount, noteContent) => {
          const oldCount = sessionMap[dStr] || 0;
          if (newCount !== oldCount) {
            await updateSession(dStr, newCount - oldCount);
          }
          const trimmed = noteContent.trim();
          await setNoteByDate(dStr, trimmed);
          setNoteMap(prev => {
            const next = { ...prev };
            if (!trimmed) delete next[dStr];
            else next[dStr] = trimmed;
            return next;
          });
          syncService.sendNoteUpdate(dStr, trimmed);
        }}
        onDeleteNote={async (dStr) => {
          await deleteNoteByDate(dStr);
          setNoteMap(prev => {
            const next = { ...prev };
            delete next[dStr];
            return next;
          });
          syncService.sendNoteUpdate(dStr, '');
        }}
      />

      <PairingModal
        visible={pairingModalVisible}
        onClose={() => setPairingModalVisible(false)}
      />

      <ProfileRoleModal
        visible={profileModalVisible}
        onClose={() => setProfileModalVisible(false)}
        onSaved={(newRole, newMyName, newPartnerName) => {
          setMyRoleState(newRole);
          setMyNameState(newMyName);
          setPartnerNameState(newPartnerName);
        }}
      />
    </SafeAreaView>
  );
}
