import React from 'react';
import { View } from 'react-native';
import type { FaseGrupo } from '@api-client';
import { Text } from '@/components/ui/Text';
import { FASE_INFO } from './grupoUtils';

/** Píldora con el momento en que está el grupo: Próximo, En curso, Terminado… */
export function FaseChip({ fase }: { fase: FaseGrupo }) {
  const { label, clase, texto } = FASE_INFO[fase];
  return (
    <View className={`self-start rounded-lg px-2 py-0.5 ${clase}`}>
      <Text className={`text-xs font-semibold ${texto}`}>{label}</Text>
    </View>
  );
}
