import { db } from '@/db/client';
import { sessions } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function StatsScreen() {
  const [totalSessions, setTotalSessions] = useState(0);
  const [totalVisits, setTotalVisits] = useState(0);
  const [maxDaily, setMaxDaily] = useState(0);
  const [topMonth, setTopMonth] = useState("");
  const [recentSessions, setRecentSessions] = useState<any[]>([]);

  const loadStats = async () => {
    try {
      const all = await db.select().from(sessions).orderBy(desc(sessions.date));

      // Aggregate by date (in case of duplicate rows)
      const grouped: Record<string, number> = {};
      all.forEach(s => {
        grouped[s.date] = (grouped[s.date] || 0) + s.count;
      });

      const aggregatedList = Object.keys(grouped).map(date => ({
        id: date, // usage of date as unique key
        date,
        count: grouped[date]
      })).sort((a, b) => b.date.localeCompare(a.date));

      setTotalSessions(aggregatedList.length);
      setTotalVisits(aggregatedList.reduce((acc, curr) => acc + curr.count, 0));

      // Calculate Max Daily
      const max = Math.max(...aggregatedList.map(s => s.count), 0);
      setMaxDaily(max);

      // Calculate Top Month
      const monthMap: Record<string, number> = {};
      aggregatedList.forEach(s => {
        // s.date is YYYY-MM-DD
        const monthKey = s.date.substring(0, 7); // YYYY-MM
        monthMap[monthKey] = (monthMap[monthKey] || 0) + s.count;
      });

      let bestMonth = "";
      let maxMonthCount = 0;
      for (const [m, c] of Object.entries(monthMap)) {
        if (c > maxMonthCount) {
          maxMonthCount = c;
          bestMonth = m;
        }
      }

      // Format best month (YYYY-MM -> MonthName Year)
      if (bestMonth) {
        const [y, m] = bestMonth.split('-');
        const date = new Date(parseInt(y), parseInt(m) - 1);
        setTopMonth(date.toLocaleString('tr-TR', { month: 'long', year: 'numeric' }));
      } else {
        setTopMonth("-");
      }

      setRecentSessions(aggregatedList.slice(0, 10)); // Show top 10 recent
    } catch (e) {
      console.error(e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [])
  );



  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top', 'left', 'right']}>
      <ScrollView className="p-4">
        <Text className="text-3xl text-white font-bold mb-6 mt-4">İstatistikler</Text>

        {/* Summary Cards */}
        <View className="flex-row flex-wrap justify-between mb-6">
          <View className="bg-gray-900 p-4 rounded-xl w-[48%] border border-neonPink mb-4">
            <Text className="text-gray-400 text-sm">Toplam Gün Sayısı</Text>
            <Text className="text-3xl text-neonPink font-bold">{totalSessions}</Text>
          </View>
          <View className="bg-gray-900 p-4 rounded-xl w-[48%] border border-neonCyan mb-4">
            <Text className="text-gray-400 text-sm">Toplam Kere</Text>
            <Text className="text-3xl text-neonCyan font-bold">{totalVisits}</Text>
          </View>
          <View className="bg-gray-900 p-4 rounded-xl w-[48%] border border-purple-500 mb-4">
            <Text className="text-gray-400 text-sm">Günlük Rekor</Text>
            <Text className="text-3xl text-purple-400 font-bold">{maxDaily}</Text>
          </View>
          <View className="bg-gray-900 p-4 rounded-xl w-[48%] border border-yellow-500 mb-4">
            <Text className="text-gray-400 text-sm">En Yoğun Ay</Text>
            <Text className="text-xl text-yellow-400 font-bold" numberOfLines={1} adjustsFontSizeToFit>{topMonth}</Text>
          </View>
        </View>

        {/* Recent List */}
        <Text className="text-xl text-white font-bold mb-4">Son Kayıtlar</Text>
        {recentSessions.map((s) => {
          const d = new Date(s.date);
          const formattedDate = d.toLocaleString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

          return (
            <View key={s.id} className="bg-gray-900 p-4 rounded-lg mb-2 flex-row justify-between items-center bg-opacity-50">
              <Text className="text-white text-lg">{formattedDate}</Text>
              <View className="flex-row items-center">
                <Text className="text-neonCyan font-bold text-xl mr-2">{s.count}</Text>
                <Text className="text-gray-500 text-xs">kere</Text>
              </View>
            </View>
          );
        })}

        {recentSessions.length === 0 && (
          <Text className="text-gray-500 italic">Henüz kayıt yok.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
