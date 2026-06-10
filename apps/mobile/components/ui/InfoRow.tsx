import React from 'react';
import { View, Text } from 'react-native';

interface InfoRowProps {
  label: string;
  value: string | null | undefined;
  last?: boolean;
}

/**
 * Read-only label/value row used in profile and detail screens.
 * Draws a bottom border unless `last` is true.
 */
export function InfoRow({ label, value, last = false }: InfoRowProps) {
  return (
    <View
      className={`flex-row items-center justify-between px-5 py-3.5 bg-card ${
        !last ? 'border-b border-border' : ''
      }`}
    >
      <Text className="text-sm text-muted-foreground w-36 shrink-0">{label}</Text>
      <Text
        className="text-sm font-medium text-foreground flex-1 text-right"
        numberOfLines={1}
      >
        {value || '—'}
      </Text>
    </View>
  );
}
