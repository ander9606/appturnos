import { Modal, View, Text, Pressable } from 'react-native';
import { useConfirmStore } from '@/lib/confirmDialog';
import { Button } from './Button';

/** Diálogo de confirmación con estilo propio. Montado una vez en el root layout. */
export function ConfirmDialog() {
  const options = useConfirmStore((s) => s.options);
  const close = useConfirmStore((s) => s.close);

  if (!options) return null;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => close(false)}>
      <Pressable
        className="flex-1 bg-black/40 items-center justify-center px-8"
        onPress={() => close(false)}
      >
        <Pressable className="bg-card w-full max-w-sm rounded-2xl p-5 gap-1" onPress={(e) => e.stopPropagation()}>
          <Text className="text-base font-bold text-foreground">{options.title}</Text>
          {options.message && (
            <Text className="text-sm text-muted-foreground mt-1">{options.message}</Text>
          )}
          <View className="flex-row gap-2 justify-end mt-4">
            <Button label={options.cancelLabel ?? 'Cancelar'} variant="ghost" size="sm" onPress={() => close(false)} />
            <Button
              label={options.confirmLabel ?? 'Confirmar'}
              variant={options.destructive ? 'danger' : 'primary'}
              size="sm"
              onPress={() => close(true)}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
