import React, { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { CloseIcon, IconColor, IconSize } from './icons';

export type AppModalVariant = 'center' | 'sheet';

interface AppModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /** Rendered between the header and the scrolling body — used for tab bars. */
  header?: ReactNode;
  children: ReactNode;
  /** Pinned below the scroll area so primary actions stay reachable. */
  footer?: ReactNode;
  /** 'sheet' slides up from the bottom, 'center' floats in the middle. */
  variant?: AppModalVariant;
  /** Disables the scroll container when the body scrolls itself. */
  scrollable?: boolean;
}

/**
 * The single modal shell used across the app.
 *
 * Owns the backdrop, panel chrome, header, keyboard avoidance and the sticky
 * footer, so individual screens only describe their content and every dialog
 * behaves the same.
 */
export default function AppModal({
  visible,
  onClose,
  title,
  subtitle,
  header,
  children,
  footer,
  variant = 'center',
  scrollable = true,
}: AppModalProps) {
  const isSheet = variant === 'sheet';

  const body = scrollable ? (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 18 }}
    >
      {children}
    </ScrollView>
  ) : (
    <View className="p-[18px]">{children}</View>
  );

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className={`flex-1 bg-black/80 ${isSheet ? 'justify-end' : 'justify-center items-center p-4'}`}
      >
        <View
          className={`bg-gray-950 border-gray-800 overflow-hidden shadow-2xl ${
            isSheet
              ? 'w-full border-t rounded-t-3xl max-h-[92%]'
              : 'w-full max-w-lg border rounded-3xl max-h-[90%]'
          }`}
        >
          {(title || subtitle) && (
            <View className="flex-row justify-between items-center px-5 pt-4 pb-3 border-b border-gray-900 bg-gray-900/60">
              <View className="flex-row items-center flex-1 mr-3">
                <View className="w-2.5 h-2.5 rounded-full bg-neonCyan mr-2.5" />
                <View className="flex-1">
                  {title ? (
                    <Text className="text-white font-bold text-base" numberOfLines={1}>
                      {title}
                    </Text>
                  ) : null}
                  {subtitle ? (
                    <Text className="text-gray-500 text-xs mt-0.5" numberOfLines={1}>
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
              </View>

              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel="Close"
                className="p-1"
              >
                <CloseIcon size={IconSize.lg} color={IconColor.muted} />
              </TouchableOpacity>
            </View>
          )}

          {header}

          {body}

          {footer ? (
            <View className="px-[18px] pt-3 pb-4 border-t border-gray-900 bg-gray-950">
              {footer}
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
