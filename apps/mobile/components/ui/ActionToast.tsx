import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useActionToastStore } from '@/lib/actionToast';
import { Button } from './Button';

const DEFAULT_DURATION_MS = 6000;

/** Banner inferior no bloqueante con botón de acción y ventana de tiempo. Montado una vez en el root layout. */
export function ActionToast() {
  const options = useActionToastStore((s) => s.options);
  const close = useActionToastStore((s) => s.close);
  const duration = options?.durationMs ?? DEFAULT_DURATION_MS;
  const [restanteSeg, setRestanteSeg] = useState(Math.ceil(duration / 1000));

  useEffect(() => {
    if (!options) return;
    setRestanteSeg(Math.ceil(duration / 1000));
    const timeoutId = setTimeout(() => close(false), duration);
    const intervalId = setInterval(() => setRestanteSeg((s) => Math.max(0, s - 1)), 1000);
    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, duration, close]);

  if (!options) return null;

  return (
    <SafeAreaView style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
      <View className="mx-4 mb-4 rounded-2xl bg-foreground p-4 gap-3 shadow-lg">
        <Text className="text-background text-sm">{options.message}</Text>
        <View className="flex-row items-center justify-between">
          <Text className="text-background/60 text-xs">{restanteSeg}s</Text>
          <Button label={options.actionLabel} variant="primary" size="sm" onPress={() => close(true)} />
        </View>
      </View>
    </SafeAreaView>
  );
}
