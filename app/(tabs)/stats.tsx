import { db } from '@/db/client';
import { sessions } from '@/db/schema';
import i18n from '@/i18n';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { desc, eq } from 'drizzle-orm';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { syncService } from '@/services/syncService';
import { getAllNotes, setNoteByDate } from '@/db/notes';

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
        id: date,
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

      // Format best month 
      if (bestMonth) {
        const [y, m] = bestMonth.split('-');
        const monthIdx = parseInt(m) - 1;
        const translatedMonth = i18n.t(`months.${monthIdx}`);
        setTopMonth(`${translatedMonth} ${y}`);
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

  useEffect(() => {
    const unsubSync = syncService.addSyncListener(loadStats);
    const unsubSession = syncService.addSessionListener(loadStats);
    return () => {
      unsubSync();
      unsubSession();
    };
  }, []);

  const handleExport = async () => {
    try {
      const allSessions = await db.select().from(sessions);
      const allNotes = await getAllNotes();

      const exportPayload = {
        version: 2,
        exportedAt: Date.now(),
        sessions: allSessions,
        notes: allNotes,
      };

      const json = JSON.stringify(exportPayload, null, 2);
      const fileUri = FileSystem.documentDirectory + 'microphone-check-backup.json';

      await FileSystem.writeAsStringAsync(fileUri, json);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert(i18n.t('error'), "Sharing is not available on this device");
      }
    } catch (e) {
      console.error(e);
      Alert.alert(i18n.t('error'), "Export failed");
    }
  };

  const handleImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const fileUri = result.assets[0].uri;
      const jsonString = await FileSystem.readAsStringAsync(fileUri);
      const data = JSON.parse(jsonString);

      let importedSessionsCount = 0;
      let importedNotesCount = 0;

      // Case 1: Legacy format (Array of sessions)
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item.date && typeof item.count === 'number') {
            const existing = await db.select().from(sessions).where(eq(sessions.date, item.date));
            if (existing.length > 0) {
              const existingId = existing[0].id;
              await db.update(sessions).set({ count: existing[0].count + item.count }).where(eq(sessions.id, existingId));
            } else {
              await db.insert(sessions).values({
                date: item.date,
                count: item.count
              });
            }
            importedSessionsCount++;
          }
        }
      }
      // Case 2: New Versioned Format (Object with sessions and notes)
      else if (data && typeof data === 'object') {
        if (Array.isArray(data.sessions)) {
          for (const item of data.sessions) {
            if (item.date && typeof item.count === 'number') {
              const existing = await db.select().from(sessions).where(eq(sessions.date, item.date));
              if (existing.length > 0) {
                const existingId = existing[0].id;
                await db.update(sessions).set({ count: existing[0].count + item.count }).where(eq(sessions.id, existingId));
              } else {
                await db.insert(sessions).values({
                  date: item.date,
                  count: item.count
                });
              }
              importedSessionsCount++;
            }
          }
        }

        if (Array.isArray(data.notes)) {
          for (const item of data.notes) {
            if (item.date && item.content) {
              await setNoteByDate(item.date, item.content);
              importedNotesCount++;
            }
          }
        }
      }

      Alert.alert(
        i18n.t('importSuccess'),
        `${importedSessionsCount} records, ${importedNotesCount} notes processed.`
      );
      loadStats();
    } catch (e) {
      console.error(e);
      Alert.alert(i18n.t('error'), "Import failed");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top', 'left', 'right']}>
      <ScrollView className="p-4">
        <Text className="text-3xl text-white font-bold mb-6 mt-4">{i18n.t('stats')}</Text>

        {/* Summary Cards */}
        <View className="flex-row flex-wrap justify-between mb-6">
          <View className="bg-gray-900 p-4 rounded-xl w-[48%] border border-neonPink mb-4">
            <Text className="text-gray-400 text-sm">{i18n.t('totalDays')}</Text>
            <Text className="text-3xl text-neonPink font-bold">{totalSessions}</Text>
          </View>
          <View className="bg-gray-900 p-4 rounded-xl w-[48%] border border-neonCyan mb-4">
            <Text className="text-gray-400 text-sm">{i18n.t('totalMicrophones')}</Text>
            <Text className="text-3xl text-neonCyan font-bold">{totalVisits}</Text>
          </View>
          <View className="bg-gray-900 p-4 rounded-xl w-[48%] border border-purple-500 mb-4">
            <Text className="text-gray-400 text-sm">{i18n.t('maxDaily')}</Text>
            <Text className="text-3xl text-purple-400 font-bold">{maxDaily}</Text>
          </View>
          <View className="bg-gray-900 p-4 rounded-xl w-[48%] border border-yellow-500 mb-4">
            <Text className="text-gray-400 text-sm">{i18n.t('topMonth')}</Text>
            <Text className="text-xl text-yellow-400 font-bold" numberOfLines={1} adjustsFontSizeToFit>{topMonth}</Text>
          </View>
        </View>

        {/* Recent List */}
        <Text className="text-xl text-white font-bold mb-4">{i18n.t('recentRecords')}</Text>
        {recentSessions.map((s) => {
          const d = new Date(s.date);
          const day = d.getDate();
          const year = d.getFullYear();
          const monthName = i18n.t(`months.${d.getMonth()}`);
          const formattedDate = `${day} ${monthName} ${year}`;

          return (
            <View key={s.id} className="bg-gray-900 p-4 rounded-lg mb-2 flex-row justify-between items-center bg-opacity-50">
              <Text className="text-white text-lg">{formattedDate}</Text>
              <View className="flex-row items-center">
                <Text className="text-neonCyan font-bold text-xl mr-2">{s.count}</Text>
                <Text className="text-gray-500 text-xs">{i18n.t('times')}</Text>
              </View>
            </View>
          );
        })}

        {recentSessions.length === 0 && (
          <Text className="text-gray-500 italic">{i18n.t('noRecords')}</Text>
        )}

        {/* Data Management Section */}
        <View className="mt-8 mb-8">
          <Text className="text-xl text-white font-bold mb-4">{i18n.t('dataManagement')}</Text>
          <View className="flex-row justify-between">
            <TouchableOpacity
              onPress={handleExport}
              className="bg-gray-900 border border-green-500 p-4 rounded-xl w-[48%] items-center flex-row justify-center"
            >
              <FontAwesome name="upload" size={16} color="#00ff00" style={{ marginRight: 8 }} />
              <Text className="text-green-500 font-bold ml-2">{i18n.t('shareData')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleImport}
              className="bg-gray-900 border border-blue-500 p-4 rounded-xl w-[48%] items-center flex-row justify-center"
            >
              <FontAwesome name="download" size={16} color="#3b82f6" style={{ marginRight: 8 }} />
              <Text className="text-blue-500 font-bold ml-2">{i18n.t('importData')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
