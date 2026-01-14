import CalendarView from '@/components/CalendarView';
import { View } from 'react-native';

export default function TabOneScreen() {
  return (
    <View className="flex-1 bg-black">
      <CalendarView />
    </View>
  );
}
