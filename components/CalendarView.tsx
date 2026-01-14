import i18n from '@/i18n';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { eq } from 'drizzle-orm';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Use i18n for days
const getDaysShort = () => i18n.t('daysShort') as unknown as string[];

export default function CalendarView() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [sessionMap, setSessionMap] = useState<Record<string, number>>({});

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const [monthStats, setMonthStats] = useState({ days: 0, count: 0 });

    const loadData = async () => {
        try {
            const allSessions = await db.select().from(sessions);
            const map: Record<string, number> = {};
            allSessions.forEach(s => {
                map[s.date] = (map[s.date] || 0) + s.count;
            });
            setSessionMap(map);
            calculateMonthStats(map, year, month);
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
        }, [])
    );

    const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
    const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay(); // 0-6 Sun-Sat

    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    // Adjust for Monday start if desired (TR standard).
    // 0(Sun) -> 6, 1(Mon) -> 0.
    // let startOffset = firstDay === 0 ? 6 : firstDay - 1;
    // keeping it simple (Sun start) for now or match headers.

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
            // Find existing sessions for this date
            const existing = await db.select().from(sessions).where(eq(sessions.date, dayString));

            if (existing.length > 0) {
                // We have existing rows, consolidate them if multiple (legacy data fix) or update the first one
                const currentTotal = existing.reduce((acc, curr) => acc + curr.count, 0);
                const newCount = currentTotal + change;

                if (newCount <= 0) {
                    // Remove all entries for this date if count goes to 0 or below
                    await db.delete(sessions).where(eq(sessions.date, dayString));
                } else {
                    // Update the first one to new total, delete others if any (cleanup)
                    const firstId = existing[0].id;
                    await db.update(sessions)
                        .set({ count: newCount })
                        .where(eq(sessions.id, firstId));

                    // If there were duplicate rows (from old bugs), delete them
                    if (existing.length > 1) {
                        const itemsToDelete = existing.slice(1).map(x => x.id);
                        // One by one delete or use 'inArray' if available, simple loop for now safe
                        for (const id of itemsToDelete) {
                            await db.delete(sessions).where(eq(sessions.id, id));
                        }
                    }
                }
            } else {
                // No existing session
                if (change > 0) {
                    await db.insert(sessions).values({
                        date: dayString,
                        count: change
                    });
                }
                // If change is negative and no session exists, do nothing
            }
            loadData();
        } catch (e) {
            console.error(e);
        }
    };

    const handleIncrement = (dayString: string) => updateSession(dayString, 1);
    const handleDecrement = (dayString: string) => updateSession(dayString, -1);

    const renderDays = () => {
        const days = [];
        // blanks
        for (let i = 0; i < firstDay; i++) {
            days.push(<View key={`blank-${i}`} className="w-[14.2%] h-14" />);
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const count = sessionMap[dateStr] || 0;
            const isToday = new Date().toDateString() === new Date(year, month, d).toDateString();

            days.push(
                <TouchableOpacity
                    key={d}
                    onPress={() => handleIncrement(dateStr)}
                    onLongPress={() => handleDecrement(dateStr)}
                    delayLongPress={500}
                    className={`w-[14.2%] h-14 items-center justify-center border-gray-800 border-[0.5px] ${isToday ? 'bg-gray-800' : ''}`}
                >
                    <Text className={`text-lg font-bold ${count > 0 ? 'text-neonPink' : 'text-gray-400'}`}>
                        {d}
                    </Text>
                    {count > 0 && (
                        <View className="flex-row items-center mt-1">
                            <FontAwesome name="microphone" size={10} color="#00FFFF" />
                            <Text className="text-[10px] text-neonCyan ml-1">{count > 9 ? '9+' : count}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            );
        }
        return days;
    };

    return (
        <SafeAreaView className="flex-1 bg-black" edges={['top', 'left', 'right']}>
            <View className="p-4">
                {/* Header */}
                <View className="flex-row justify-between items-center mb-6">
                    <TouchableOpacity onPress={handlePrevMonth} className="p-2">
                        <FontAwesome name="chevron-left" size={24} color="#00FFFF" />
                    </TouchableOpacity>
                    <Text className="text-2xl text-white font-bold">
                        {/* Manual month lookup from i18n since toLocaleString is tricky with custom langs */}
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
                        <Text className="text-gray-400 text-sm">{i18n.t('totalVisits')}</Text>
                        <Text className="text-3xl text-neonCyan font-bold">{monthStats.count}</Text>
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
}
