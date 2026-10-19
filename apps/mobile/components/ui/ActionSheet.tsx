import { Text } from '@/components/ui/Text';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '@/lib/designTokens';
import { useActionSheetStore } from '@/lib/actionSheet';
import { Button } from './Button';

const OFFSCREEN = 480;

/** Menú de opciones desde abajo, con la marca. Montado una vez en el root layout. */
export function ActionSheet() {
  const options = useActionSheetStore((s) => s.options);
  const close = useActionSheetStore((s) => s.close);
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!options) return;
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [options, enter]);

  if (!options) return null;

  // Primero baja la hoja y luego resuelve, para que no desaparezca de golpe.
  const dismiss = (key: string | null) =>
    Animated.timing(enter, { toValue: 0, duration: 160, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => close(key));

  return (
    <Modal transparent animationType="none" visible onRequestClose={() => dismiss(null)}>
      <Animated.View style={{ flex: 1, opacity: enter }} className="bg-foreground/50">
        <Pressable style={{ flex: 1 }} onPress={() => dismiss(null)} accessibilityLabel="Cerrar" />
      </Animated.View>
      <Animated.View
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [OFFSCREEN, 0] }) }] }}
      >
        <SafeAreaView edges={['bottom']} className="bg-card rounded-t-3xl px-4 pt-3 shadow-lg" accessibilityViewIsModal>
          <View className="w-10 h-1 rounded-full bg-border self-center mb-3" />
          {options.title && (
            <Text className="text-lg font-bold text-foreground text-center" accessibilityRole="header">{options.title}</Text>
          )}
          {options.message && (
            <Text className="text-sm text-muted-foreground text-center mt-1">{options.message}</Text>
          )}
          <View className="mt-3 gap-1">
            {options.items.map((item) => (
              <Pressable
                key={item.key}
                onPress={() => dismiss(item.key)}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                className="flex-row items-center gap-3 rounded-2xl px-3 py-3 min-h-[56px] active:bg-muted"
              >
                {item.icon && (
                  <View className={`w-10 h-10 rounded-full items-center justify-center ${item.destructive ? 'bg-danger-light' : 'bg-primary-50'}`}>
                    <Ionicons name={item.icon} size={20} color={item.destructive ? COLORS.danger : COLORS.primary} />
                  </View>
                )}
                <Text className={`flex-1 text-base font-semibold ${item.destructive ? 'text-danger-dark' : 'text-foreground'}`}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View className="mt-2 mb-3">
            <Button label={options.cancelLabel ?? 'Cancelar'} variant="secondary" fullWidth onPress={() => dismiss(null)} />
          </View>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}
