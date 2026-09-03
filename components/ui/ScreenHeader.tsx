import React, { ReactNode } from 'react';
import { Text, View } from 'react-native';

interface ScreenHeaderProps {
  /** Small caps line above the title, e.g. "TODAY". */
  eyebrow?: string;
  title: string;
  /** Rendered on the right, e.g. the sync pill. */
  action?: ReactNode;
}

/**
 * The heading every tab screen uses.
 *
 * Each screen used to size and weight its own title, so moving between tabs
 * shifted the type. Going through one component keeps the scale identical.
 */
export default function ScreenHeader({ eyebrow, title, action }: ScreenHeaderProps) {
  return (
    <View className="flex-row justify-between items-start mb-5">
      <View className="flex-1 mr-3">
        {eyebrow ? (
          <Text className="text-neonCyan text-xs font-extrabold uppercase tracking-widest mb-0.5">
            {eyebrow}
          </Text>
        ) : null}
        <Text className="text-white text-2xl font-extrabold" numberOfLines={1}>
          {title}
        </Text>
      </View>
      {action ? <View className="mt-0.5">{action}</View> : null}
    </View>
  );
}
