import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable } from 'react-native';

interface Props {
  onClose: () => void;
  children: React.ReactNode;
}

/** Marco común de los diálogos de marca: fondo oscuro + tarjeta que entra con un resorte suave. */
export function DialogCard({ onClose, children }: Props) {
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(enter, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 6 }).start();
  }, [enter]);

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable className="flex-1 bg-foreground/50 items-center justify-center px-8" onPress={onClose}>
        <Animated.View
          style={{ width: '100%', maxWidth: 384, opacity: enter, transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }}
        >
          <Pressable
            className="bg-card rounded-3xl p-6 items-center gap-2 shadow-lg"
            onPress={(e) => e.stopPropagation()}
            accessibilityViewIsModal
          >
            {children}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
