import React from 'react';
import { View, Text, Pressable } from 'react-native';

interface StatCardProps {
  value: string | number;
  label: string;
  /** NativeWind text color class, e.g. 'text-primary' or 'text-info'. */
  color?: string;
  onPress?: () => void;
}

/** Compact stat display used on dashboard and summary headers. */
export function StatCard({ value, label, color = 'text-primary', onPress }: StatCardProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className="flex-1 bg-card rounded-2xl p-4 gap-1 border border-border active:opacity-70"
    >
      <Text className={`text-2xl font-extrabold ${color}`}>{value}</Text>
      <Text className="text-xs text-muted-foreground">{label}</Text>
    </Pressable>
  );
}
