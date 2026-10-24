import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/Text';

/** Círculo naranja con una cantidad (pendientes, disponibles…). No pinta nada si `n` es 0. */
export function ContadorCirculo({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <View className="bg-warning rounded-full min-w-[24px] h-[24px] items-center justify-center px-1.5">
      <Text className="text-white text-xs font-bold">{n}</Text>
    </View>
  );
}
