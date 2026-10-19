import { Text } from '@/components/ui/Text';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/lib/designTokens';
import { useConfirmStore } from '@/lib/confirmDialog';
import { Button } from './Button';
import { DialogCard } from './DialogCard';
import { FEEDBACK } from './feedback';

/** Diálogo de confirmación con estilo propio. Montado una vez en el root layout. */
export function ConfirmDialog() {
  const options = useConfirmStore((s) => s.options);
  const close = useConfirmStore((s) => s.close);

  if (!options) return null;
  const { destructive } = options;

  return (
    <DialogCard onClose={() => close(false)}>
      <View className={`w-14 h-14 rounded-full items-center justify-center mb-1 ${destructive ? FEEDBACK.error.bg : 'bg-primary-50'}`}>
        <Ionicons
          name={destructive ? 'trash-outline' : 'help-circle'}
          size={destructive ? 26 : 30}
          color={destructive ? COLORS.danger : COLORS.primary}
        />
      </View>
      <Text className="text-lg font-bold text-foreground text-center" accessibilityRole="header">{options.title}</Text>
      {options.message && <Text className="text-sm text-muted-foreground text-center">{options.message}</Text>}
      <View className="flex-row gap-3 mt-3">
        <View className="flex-1">
          <Button label={options.cancelLabel ?? 'Cancelar'} variant="secondary" fullWidth onPress={() => close(false)} />
        </View>
        <View className="flex-1">
          <Button
            label={options.confirmLabel ?? 'Confirmar'}
            variant={destructive ? 'danger' : 'primary'}
            fullWidth
            onPress={() => close(true)}
          />
        </View>
      </View>
    </DialogCard>
  );
}
