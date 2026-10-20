import { Text } from '@/components/ui/Text';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAlertStore } from '@/lib/alertDialog';
import { Button } from './Button';
import { DialogCard } from './DialogCard';
import { FEEDBACK } from './feedback';

/** Aviso de un botón con estilo propio (reemplaza Alert.alert). Montado una vez en el root layout. */
export function AlertDialog() {
  const options = useAlertStore((s) => s.options);
  const close = useAlertStore((s) => s.close);

  if (!options) return null;
  const look = FEEDBACK[options.variant ?? 'error'];

  return (
    <DialogCard onClose={close}>
      <View className={`w-14 h-14 rounded-full items-center justify-center mb-1 ${look.bg}`}>
        <Ionicons name={look.icon} size={30} color={look.color} />
      </View>
      <Text className="text-lg font-bold text-foreground text-center" accessibilityRole="header">{options.title}</Text>
      {options.message && <Text className="text-sm text-muted-foreground text-center">{options.message}</Text>}
      <View className="w-full mt-3">
        <Button label={options.okLabel ?? 'Entendido'} fullWidth onPress={close} />
      </View>
    </DialogCard>
  );
}
