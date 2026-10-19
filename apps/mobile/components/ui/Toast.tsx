import { Text } from '@/components/ui/Text';
import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useToastStore } from '@/lib/toast';
import { FEEDBACK } from './feedback';

const AUTO_HIDE_MS = 2500;

/** Banner inferior no bloqueante con ícono según el tipo. Montado una vez en el root layout. */
export function Toast() {
  const message = useToastStore((s) => s.message);
  const variant = useToastStore((s) => s.variant);
  const hide = useToastStore((s) => s.hide);
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return;
    enter.setValue(0);
    Animated.spring(enter, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 6 }).start();
    const id = setTimeout(hide, AUTO_HIDE_MS);
    return () => clearTimeout(id);
  }, [message, hide, enter]);

  if (!message) return null;
  const look = FEEDBACK[variant];

  return (
    <SafeAreaView
      pointerEvents="none"
      style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
    >
      <Animated.View
        accessibilityRole="alert"
        style={{ opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}
        className="mx-4 mb-4"
      >
        <View className="rounded-2xl bg-foreground px-4 py-3 shadow-lg flex-row items-center justify-center gap-2">
          <Ionicons name={look.icon} size={20} color={look.color} />
          <Text className="text-background text-sm font-semibold flex-shrink">{message}</Text>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}
