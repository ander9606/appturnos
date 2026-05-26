import React from 'react';
import { View, Text } from 'react-native';

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'default' | 'primary';

interface BadgeProps {
  label: string;
  variant?: Variant;
  size?: 'sm' | 'md';
}

const VARIANT_STYLES: Record<Variant, { bg: string; text: string }> = {
  success: { bg: 'bg-success-light',  text: 'text-success' },
  warning: { bg: 'bg-warning-light',  text: 'text-amber-700' },
  danger:  { bg: 'bg-danger-light',   text: 'text-danger' },
  info:    { bg: 'bg-info-light',     text: 'text-blue-700' },
  primary: { bg: 'bg-primary-100',    text: 'text-primary-700' },
  default: { bg: 'bg-muted',          text: 'text-muted-foreground' },
};

const SIZE_STYLES = {
  sm: { wrap: 'px-2 py-0.5', text: 'text-[10px]' },
  md: { wrap: 'px-3 py-1',   text: 'text-xs' },
};

export function Badge({ label, variant = 'default', size = 'md' }: BadgeProps) {
  const v = VARIANT_STYLES[variant];
  const s = SIZE_STYLES[size];
  return (
    <View className={`rounded-full self-start ${v.bg} ${s.wrap}`}>
      <Text className={`font-semibold ${v.text} ${s.text}`}>{label}</Text>
    </View>
  );
}
