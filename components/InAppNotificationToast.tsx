import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Animated, TouchableOpacity } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { syncService, NotificationPayload } from '@/services/syncService';

export default function InAppNotificationToast() {
  const [notification, setNotification] = useState<NotificationPayload | null>(null);
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const timeoutRef = useRef<any>(null);

  useEffect(() => {
    const unsub = syncService.addNotificationListener((payload) => {
      setNotification(payload);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      Animated.spring(slideAnim, {
        toValue: 20,
        useNativeDriver: true,
        bounciness: 6,
      }).start();

      timeoutRef.current = setTimeout(() => {
        hideToast();
      }, 4000);
    });

    return () => {
      unsub();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const hideToast = () => {
    Animated.timing(slideAnim, {
      toValue: -120,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setNotification(null));
  };

  if (!notification) return null;

  return (
    <Animated.View
      style={{
        transform: [{ translateY: slideAnim }],
        position: 'absolute',
        top: 40,
        left: 16,
        right: 16,
        zIndex: 9999,
      }}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={hideToast}
        className="bg-gray-900/95 border border-neonCyan p-4 rounded-2xl shadow-2xl flex-row items-center justify-between"
      >
        <View className="flex-row items-center flex-1 mr-3">
          <View className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-neonCyan/40 items-center justify-center mr-3">
            <FontAwesome
              name={notification.type === 'event' ? 'calendar' : notification.type === 'note' ? 'pencil' : 'heart'}
              size={18}
              color="#00FFFF"
            />
          </View>
          <View className="flex-1">
            <Text className="text-neonCyan font-bold text-sm">{notification.title}</Text>
            <Text className="text-white text-xs mt-0.5" numberOfLines={2}>
              {notification.message}
            </Text>
          </View>
        </View>

        <TouchableOpacity onPress={hideToast} className="p-1">
          <FontAwesome name="times" size={14} color="#888" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}
