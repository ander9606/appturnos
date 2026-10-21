import { Text } from '@/components/ui/Text';
import { View, Pressable } from 'react-native';
import type { TipoDia } from '@api-client';
import { TIPOS_DIA } from './tiposDia';

export function TipoDiaChips({ value, onChange }: { value: TipoDia; onChange: (v: TipoDia) => void }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {TIPOS_DIA.map(({ v, label, color }) => (
        <Pressable
          key={v}
          onPress={() => onChange(v)}
          className={`px-3 py-2 rounded-xl border ${value === v ? 'border-transparent' : 'border-border bg-card'}`}
          style={value === v ? { backgroundColor: color } : undefined}
        >
          <Text className={`text-xs font-semibold ${value === v ? 'text-white' : 'text-muted-foreground'}`}>
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
