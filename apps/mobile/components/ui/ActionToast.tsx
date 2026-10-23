import { Text } from '@/components/ui/Text';
import { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useActionToastStore } from '@/lib/actionToast';
import { Button } from './Button';
import { FEEDBACK } from './feedback';

const DEFAULT_DURATION_MS = 6000;

/** Banner inferior no bloqueante con botón de acción y ventana de tiempo. Montado una vez en el root layout. */
export function ActionToast() {
  const options = useActionToastStore((s) => s.options);
  const close = useActionToastStore((s) => s.close);
  const duration = options?.durationMs ?? DEFAULT_DURATION_MS;
  const [restanteSeg, setRestanteSeg] = useState(Math.ceil(duration / 1000));
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!options) return;
    setRestanteSeg(Math.ceil(duration / 1000));
    enter.setValue(0);
    Animated.spring(enter, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 6 }).start();
    const timeoutId = setTimeout(() => close(false), duration);
    const intervalId = setInterval(() => setRestanteSeg((s) => Math.max(0, s - 1)), 1000);
    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, duration, close]);

  if (!options) return null;
  const look = FEEDBACK.info;

  return (
    <SafeAreaView style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
      <Animated.View
        accessibilityRole="alert"
        style={{ opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}
        className="mx-4 mb-4 rounded-2xl bg-foreground p-4 gap-3 shadow-lg"
      >
        <View className="flex-row items-center gap-2">
          <Ionicons name={look.icon} size={20} color={look.color} />
          <Text className="text-background text-sm flex-1">{options.message}</Text>
        </View>
        <View className="flex-row items-center justify-between">
          <Text className="text-background/60 text-xs">{restanteSeg}s</Text>
          <Button label={options.actionLabel} variant="primary" size="sm" onPress={() => close(true)} />
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}
