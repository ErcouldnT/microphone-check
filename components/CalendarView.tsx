import { db } from '@/db/client';
import { sessions } from '@/db/schema';
import i18n from '@/i18n';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { eq } from 'drizzle-orm';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PairingModal from './PairingModal';
import DayNoteModal from './DayNoteModal';
import { syncService, ConnectionStatus } from '@/services/syncService';
import { getAllNotes, setNoteByDate, deleteNoteByDate } from '@/db/notes';

// Use i18n for days
const getDaysShort = () => i18n.t('daysShort') as unknown as string[];

export default function CalendarView() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [sessionMap, setSessionMap] = useState<Record<string, number>>({});
    const [noteMap, setNoteMap] = useState<Record<string, string>>({});
    const [pairingModalVisible, setPairingModalVisible] = useState(false);
    const [dayModalVisible, setDayModalVisible] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [syncStatus, setSyncStatus] = useState<ConnectionStatus>('local');
    const [roomCode, setRoomCode] = useState<string | null>(null);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const [monthStats, setMonthStats] = useState({ days: 0, count: 0 });

    const loadData = async () => {
        try {
            // Load sessions
            const allSessions = await db.select().from(sessions);
            const map: Record<string, number> = {};
            allSessions.forEach(s => {
                map[s.date] = (map[s.date] || 0) + s.count;
            });
            setSessionMap(map);
            calculateMonthStats(map, year, month);

            // Load notes
            const allNotes = await getAllNotes();
            const nMap: Record<string, string> = {};
            allNotes.forEach(n => {
                if (n.content?.trim()) {
                    nMap[n.date] = n.content.trim();
                }
            });
            setNoteMap(nMap);
        } catch (e) {
            console.error(e);
        }
    };

    const calculateMonthStats = (map: Record<string, number>, y: number, m: number) => {
        let days = 0;
        let count = 0;
        const prefix = `${y}-${String(m + 1).padStart(2, '0')}`;

        Object.keys(map).forEach(date => {
            if (date.startsWith(prefix)) {
                if (map[date] > 0) {
                    days++;
                    count += map[date];
                }
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
        // Listen for remote real-time session updates
        const unsubSession = syncService.addSessionListener(({ date, count }) => {
            setSessionMap(prev => {
                const next = { ...prev };
                if (count <= 0) {
                    delete next[date];
                } else {
                    next[date] = count;
                }
                calculateMonthStats(next, year, month);
                return next;
            });
        });

        // Listen for remote real-time note updates
        const unsubNote = syncService.addNoteListener(({ date, content }) => {
            setNoteMap(prev => {
                const next = { ...prev };
                if (!content || !content.trim()) {
                    delete next[date];
                } else {
                    next[date] = content.trim();
                }
                return next;
            });
        });

        // Listen for full sync events
        const unsubSync = syncService.addSyncListener(() => {
            loadData();
            setRoomCode(syncService.getRoomCode());
        });

        // Listen for status changes
        const unsubStatus = syncService.addStatusListener((newStatus) => {
            setSyncStatus(newStatus);
            setRoomCode(syncService.getRoomCode());
        });

        return () => {
            unsubSession();
            unsubNote();
            unsubSync();
            unsubStatus();
        };
    }, [year, month]);

    const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
    const getFirstDayOfMonth = (y: number, m: number) => {
        const day = new Date(y, m, 1).getDay(); // 0(Sun) - 6(Sat)
        return day === 0 ? 6 : day - 1; // 0(Mon) - 6(Sun)
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

    // Helper to handle updates
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
                    await db.update(sessions)
                        .set({ count: newCount })
                        .where(eq(sessions.id, firstId));

                    if (existing.length > 1) {
                        const itemsToDelete = existing.slice(1).map(x => x.id);
                        for (const id of itemsToDelete) {
                            await db.delete(sessions).where(eq(sessions.id, id));
                        }
                    }
                }
            } else {
                if (change > 0) {
                    newCount = change;
                    await db.insert(sessions).values({
                        date: dayString,
                        count: change
                    });
                }
            }

            // Optimistic UI update
            setSessionMap(prev => {
                const next = { ...prev };
                if (newCount <= 0) {
                    delete next[dayString];
                } else {
                    next[dayString] = newCount;
                }
                calculateMonthStats(next, year, month);
                return next;
            });

            // Send real-time update via WebSocket to server
            syncService.sendSessionUpdate(dayString, newCount);
        } catch (e) {
            console.error(e);
        }
    };

    const handleIncrement = (dayString: string) => updateSession(dayString, 1);
    const handleDecrement = (dayString: string) => updateSession(dayString, -1);

    const handleOpenDayModal = (dayString: string) => {
        setSelectedDate(dayString);
        setDayModalVisible(true);
    };

    const handleSaveDayModal = async (dateStr: string, newCount: number, noteContent: string) => {
        try {
            // 1. Update session count if changed
            const oldCount = sessionMap[dateStr] || 0;
            if (newCount !== oldCount) {
                const diff = newCount - oldCount;
                await updateSession(dateStr, diff);
            }

            // 2. Update note
            const trimmed = noteContent.trim();
            await setNoteByDate(dateStr, trimmed);

            setNoteMap(prev => {
                const next = { ...prev };
                if (!trimmed) {
                    delete next[dateStr];
                } else {
                    next[dateStr] = trimmed;
                }
                return next;
            });

            // Send note update over WebSocket
            syncService.sendNoteUpdate(dateStr, trimmed);
        } catch (e) {
            console.error('Error saving day modal:', e);
        }
    };

    const handleDeleteNote = async (dateStr: string) => {
        try {
            await deleteNoteByDate(dateStr);
            setNoteMap(prev => {
                const next = { ...prev };
                delete next[dateStr];
                return next;
            });
            syncService.sendNoteUpdate(dateStr, '');
        } catch (e) {
            console.error('Error deleting note:', e);
        }
    };

    const renderDays = () => {
        const days = [];
        // blanks
        for (let i = 0; i < firstDay; i++) {
            days.push(<View key={`blank-${i}`} className="w-[14.2%] h-14" />);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const count = sessionMap[dateStr] || 0;
            const hasNote = Boolean(noteMap[dateStr]);
            const isToday = new Date().toDateString() === new Date(year, month, d).toDateString();

            days.push(
                <TouchableOpacity
                    key={d}
                    onPress={() => handleIncrement(dateStr)}
                    onLongPress={() => handleOpenDayModal(dateStr)}
                    delayLongPress={400}
                    className={`w-[14.2%] h-14 items-center justify-center border-gray-800 border-[0.5px] relative ${
                        isToday ? 'bg-gray-800' : ''
                    }`}
                >
                    {/* Note indicator badge at top right */}
                    {hasNote ? (
                        <TouchableOpacity
                            onPress={() => handleOpenDayModal(dateStr)}
                            className="absolute top-1 right-1"
                        >
                            <FontAwesome name="pencil" size={9} color="#c084fc" />
                        </TouchableOpacity>
                    ) : null}

                    <Text className={`text-lg font-bold ${count > 0 ? 'text-neonPink' : 'text-gray-400'}`}>
                        {d}
                    </Text>

                    {count > 0 && (
                        <View className="flex-row items-center mt-0.5">
                            <FontAwesome name="microphone" size={10} color="#00FFFF" />
                            <Text className="text-[10px] text-neonCyan ml-1">{count > 9 ? '9+' : count}</Text>
                        </View>
                    )}
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
                    className="flex-row items-center bg-gray-900 border border-gray-800 px-3 py-1 rounded-full"
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
                className="flex-row items-center bg-gray-900 border border-neonCyan/40 px-3 py-1 rounded-full"
            >
                <View className={`w-2 h-2 rounded-full ${dotColor} mr-2`} />
                <Text className="text-white text-xs font-bold tracking-wider mr-1">{roomCode}</Text>
                <FontAwesome name="exchange" size={10} color="#00FFFF" />
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-black" edges={['top', 'left', 'right']}>
            <View className="p-4">
                {/* Top Bar with Live Room Status */}
                <View className="flex-row justify-between items-center mb-4">
                    <Text className="text-white font-extrabold text-lg tracking-wider">
                        MICROPHONE<Text className="text-neonCyan">CHECK</Text>
                    </Text>
                    {getStatusIndicator()}
                </View>

                {/* Header */}
                <View className="flex-row justify-between items-center mb-6">
                    <TouchableOpacity onPress={handlePrevMonth} className="p-2">
                        <FontAwesome name="chevron-left" size={24} color="#00FFFF" />
                    </TouchableOpacity>
                    <Text className="text-2xl text-white font-bold">
                        {i18n.t(`months.${currentDate.getMonth()}`)} {currentDate.getFullYear()}
                    </Text>
                    <TouchableOpacity onPress={handleNextMonth} className="p-2">
                        <FontAwesome name="chevron-right" size={24} color="#00FFFF" />
                    </TouchableOpacity>
                </View>

                {/* Week Days */}
                <View className="flex-row mb-2 border-b border-gray-800 pb-2">
                    {getDaysShort().map((day: string, index: number) => (
                        <View key={index} className="w-[14.2%] items-center">
                            <Text className="text-gray-500 font-bold uppercase text-xs">{day}</Text>
                        </View>
                    ))}
                </View>

                {/* Grid */}
                <View className="flex-row flex-wrap">
                    {renderDays()}
                </View>

                {/* Monthly Summary */}
                <Text className="text-white font-bold mb-4 mt-8 text-xl">
                    {i18n.t(`months.${currentDate.getMonth()}`)} {i18n.t('summary')}
                </Text>
                <View className="flex-row justify-between mb-8">
                    <View className="bg-gray-900 p-4 rounded-xl w-[48%] border border-neonPink">
                        <Text className="text-gray-400 text-sm">{i18n.t('visitedDays')}</Text>
                        <Text className="text-3xl text-neonPink font-bold">{monthStats.days}</Text>
                    </View>
                    <View className="bg-gray-900 p-4 rounded-xl w-[48%] border border-neonCyan">
                        <Text className="text-gray-400 text-sm">{i18n.t('totalMicrophones')}</Text>
                        <Text className="text-3xl text-neonCyan font-bold">{monthStats.count}</Text>
                    </View>
                </View>
            </View>

            {/* Day Note & Details Modal */}
            <DayNoteModal
                visible={dayModalVisible}
                date={selectedDate}
                initialCount={sessionMap[selectedDate] || 0}
                initialNote={noteMap[selectedDate] || ''}
                onClose={() => setDayModalVisible(false)}
                onSave={handleSaveDayModal}
                onDeleteNote={handleDeleteNote}
            />

            {/* Pairing Modal */}
            <PairingModal
                visible={pairingModalVisible}
                onClose={() => setPairingModalVisible(false)}
            />
        </SafeAreaView>
    );
}
