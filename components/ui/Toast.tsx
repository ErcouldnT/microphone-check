import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CompletedIcon,
  IconColor,
  IconSize,
  InfoIcon,
  NoteIcon,
  NotificationIcon,
  ScheduleIcon,
  WarningIcon,
} from './icons';

export type ToastVariant = 'info' | 'success' | 'warning' | 'event' | 'note' | 'reminder';

export interface ToastOptions {
  title: string;
  message?: string;
  variant?: ToastVariant;
  /** Milliseconds on screen. Defaults to 4s. */
  duration?: number;
  onPress?: () => void;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Shows an in-app toast. Safe to call from anywhere under ToastProvider. */
export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside a ToastProvider');
  }
  return ctx;
};

const VARIANT_STYLE: Record<
  ToastVariant,
  { border: string; tint: string; Icon: typeof InfoIcon; color: string }
> = {
  info: { border: 'border-neonCyan/60', tint: 'bg-cyan-950/80', Icon: InfoIcon, color: IconColor.cyan },
  success: { border: 'border-green-500/60', tint: 'bg-green-950/80', Icon: CompletedIcon, color: IconColor.green },
  warning: { border: 'border-yellow-500/60', tint: 'bg-yellow-950/80', Icon: WarningIcon, color: IconColor.yellow },
  event: { border: 'border-neonCyan/60', tint: 'bg-cyan-950/80', Icon: ScheduleIcon, color: IconColor.cyan },
  note: { border: 'border-purple-500/60', tint: 'bg-purple-950/80', Icon: NoteIcon, color: IconColor.purple },
  reminder: { border: 'border-neonPink/60', tint: 'bg-pink-950/80', Icon: NotificationIcon, color: IconColor.pink },
};

/**
 * App-wide toast host.
 *
 * One provider renders a single toast surface, so notices raised from sync,
 * reminders or plain user actions all look and behave the same.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const translateY = useRef(new Animated.Value(-140)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const hideToast = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    Animated.parallel([
      Animated.timing(translateY, { toValue: -140, duration: 220, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [opacity, translateY]);

  const showToast = useCallback(
    (options: ToastOptions) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setToast(options);

      translateY.setValue(-140);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 6, speed: 14 }),
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();

      timeoutRef.current = setTimeout(hideToast, options.duration ?? 4000);
    },
    [hideToast, opacity, translateY]
  );

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    []
  );

  const value = useMemo(() => ({ showToast, hideToast }), [showToast, hideToast]);
  const style = toast ? VARIANT_STYLE[toast.variant ?? 'info'] : null;

  return (
    <ToastContext.Provider value={value}>
      {children}

      {toast && style && (
        <Animated.View
          pointerEvents="box-none"
          style={{
            transform: [{ translateY }],
            opacity,
            position: 'absolute',
            top: insets.top + 8,
            left: 16,
            right: 16,
            zIndex: 9999,
          }}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              toast.onPress?.();
              hideToast();
            }}
            className={`bg-gray-950/95 border ${style.border} p-3.5 rounded-2xl shadow-2xl flex-row items-center`}
          >
            <View
              className={`w-10 h-10 rounded-xl ${style.tint} items-center justify-center mr-3`}
            >
              <style.Icon size={IconSize.lg} color={style.color} />
            </View>

            <View className="flex-1">
              <Text className="text-white font-bold text-sm" numberOfLines={1}>
                {toast.title}
              </Text>
              {toast.message ? (
                <Text className="text-gray-400 text-xs mt-0.5" numberOfLines={2}>
                  {toast.message}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}
