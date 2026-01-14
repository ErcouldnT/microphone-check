import { db } from '@/db/client';
import { sessions } from '@/db/schema';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { eq } from 'drizzle-orm';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']; // Sunday first ? usually Mon first in TR? 
// TR: Pzt(Mon), Sal(Tue), Car(Wed), Per(Thu), Cum(Fri), Cmt(Sat), Paz(Sun).
// Date.getDay(): 0=Sun. 
// Let's stick to standard 0=Sun for logic, but display mapped.

export default function CalendarView() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [sessionMap, setSessionMap] = useState<Record<string, number>>({});

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const loadData = async () => {
        try {
            const allSessions = await db.select().from(sessions);
            const map: Record<string, number> = {};
            allSessions.forEach(s => {
                map[s.date] = (map[s.date] || 0) + s.count;
            });
            setSessionMap(map);
        } catch (e) {
            console.error(e);
        }
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

    const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

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
                        {currentDate.toLocaleString('tr-TR', { month: 'long', year: 'numeric' })}
                    </Text>
                    <TouchableOpacity onPress={handleNextMonth} className="p-2">
                        <FontAwesome name="chevron-right" size={24} color="#00FFFF" />
                    </TouchableOpacity>
                </View>

                {/* Week Days */}
                <View className="flex-row mb-2 border-b border-gray-800 pb-2">
                    {['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'].map(day => (
                        <View key={day} className="w-[14.2%] items-center">
                            <Text className="text-gray-500 font-bold uppercase text-xs">{day}</Text>
                        </View>
                    ))}
                </View>

                {/* Grid */}
                <View className="flex-row flex-wrap">
                    {renderDays()}
                </View>
            </View>
        </SafeAreaView>
    );
}
