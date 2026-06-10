import React from 'react';
import { View, Text } from 'react-native';

interface SectionHeaderProps {
  title: string;
  count?: number;
}

/**
 * Shared section header used in list screens.
 * Shows an uppercase label and an optional count badge.
 */
export function SectionHeader({ title, count }: SectionHeaderProps) {
  return (
    <View className="flex-row items-center gap-2 px-5 mb-3 mt-4">
      <Text className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
        {title}
      </Text>
      {count != null && (
        <View className="bg-muted rounded-full min-w-[18px] h-[18px] items-center justify-center px-1">
          <Text className="text-xs font-bold text-muted-foreground">{count}</Text>
        </View>
      )}
    </View>
  );
}
