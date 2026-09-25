import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface StatCardProps {
  value: string | number;
  label: string;
  /** NativeWind text color class, e.g. 'text-primary' or 'text-info'. */
  color?: string;
  /** Show alert icon if true (e.g., pending contract signatures). */
  alert?: boolean;
  onPress?: () => void;
}

const BG_MAP: Record<string, string> = {
  'text-primary':           'bg-primary-50',
  'text-info':              'bg-blue-50',
  'text-success':           'bg-green-50',
  'text-warning':           'bg-yellow-50',
  'text-danger':            'bg-red-50',
};

export function StatCard({ value, label, color = 'text-primary', alert = false, onPress }: StatCardProps) {
  const bg = BG_MAP[color] ?? 'bg-card';
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      className={`flex-1 ${bg} rounded-2xl p-4 gap-1 border border-border active:opacity-70`}
    >
      <View className="flex-row items-start justify-between">
        <Text className={`text-2xl font-extrabold flex-1 ${color}`}>{value}</Text>
        {alert && (
          <Ionicons name="alert-circle" size={20} color="#EF4444" style={{ marginTop: 2 }} />
        )}
      </View>
      <Text className="text-xs text-muted-foreground">{label}</Text>
    </Pressable>
  );
}
