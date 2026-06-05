import React from 'react';
import { View, Text, TextInput } from 'react-native';

type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  placeholder: string;
};

export function SegmentInput({ label, value, onChange, maxLength = 2, placeholder }: Props) {
  return (
    <View className="items-center gap-1">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <TextInput
        className="bg-muted rounded-xl text-center text-base font-semibold text-foreground"
        style={{ width: maxLength === 4 ? 72 : 48, height: 44 }}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, maxLength))}
        keyboardType="number-pad"
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        maxLength={maxLength}
      />
    </View>
  );
}
