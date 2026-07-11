import { useEffect } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useToastStore } from '@/lib/toast';

const AUTO_HIDE_MS = 2500;

/** Banner inferior no bloqueante para feedback de éxito. Montado una vez en el root layout. */
export function Toast() {
  const message = useToastStore((s) => s.message);
  const hide = useToastStore((s) => s.hide);

  useEffect(() => {
    if (!message) return;
    const id = setTimeout(hide, AUTO_HIDE_MS);
    return () => clearTimeout(id);
  }, [message, hide]);

  if (!message) return null;

  return (
    <SafeAreaView
      pointerEvents="none"
      style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
    >
      <View className="mx-4 mb-4 rounded-2xl bg-foreground px-4 py-3 shadow-lg">
        <Text className="text-background text-sm font-semibold text-center">{message}</Text>
      </View>
    </SafeAreaView>
  );
}
