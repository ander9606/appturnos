import { Modal, View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAlertStore } from '@/lib/alertDialog';
import { Button } from './Button';

/** Diálogo de error con estilo propio (reemplaza Alert.alert). Montado una vez en el root layout. */
export function AlertDialog() {
  const options = useAlertStore((s) => s.options);
  const close = useAlertStore((s) => s.close);

  if (!options) return null;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={close}>
      <Pressable className="flex-1 bg-black/40 items-center justify-center px-8" onPress={close}>
        <Pressable className="bg-card w-full max-w-sm rounded-2xl p-5 gap-1" onPress={(e) => e.stopPropagation()}>
          <View className="flex-row items-center gap-2">
            <Ionicons name="alert-circle" size={20} color="#EF4444" />
            <Text className="text-base font-bold text-foreground flex-1">{options.title}</Text>
          </View>
          {options.message && (
            <Text className="text-sm text-muted-foreground mt-1">{options.message}</Text>
          )}
          <View className="flex-row justify-end mt-4">
            <Button label={options.okLabel ?? 'Entendido'} variant="secondary" size="sm" onPress={close} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
