import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme';

interface Props {
  onUnlock: () => Promise<boolean>;
  onLogout: () => Promise<void>;
}

export function BiometricLockScreen({ onUnlock, onLogout }: Props) {
  const theme = useTheme();

  // Auto-prompt on mount so the user doesn't have to tap manually
  useEffect(() => { onUnlock(); }, []);

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 999 }]} className="bg-background items-center justify-center px-8">
      <View className="bg-card border border-border rounded-3xl p-8 items-center gap-4 w-full">
        <View className="w-16 h-16 rounded-full items-center justify-center" style={{ backgroundColor: theme.primary + '1A' }}>
          <Ionicons name="lock-closed" size={32} color={theme.primary} />
        </View>

        <Text className="text-xl font-bold text-foreground">App bloqueada</Text>
        <Text className="text-sm text-muted-foreground text-center">
          Verifica tu identidad para continuar
        </Text>

        <Pressable
          onPress={onUnlock}
          className="w-full h-12 rounded-2xl items-center justify-center active:opacity-80 mt-2"
          style={{ backgroundColor: theme.primary }}
        >
          <Text className="text-white font-semibold">Usar biometría / PIN</Text>
        </Pressable>

        <Pressable onPress={onLogout} className="active:opacity-60 py-1">
          <Text className="text-sm text-danger">Cerrar sesión</Text>
        </Pressable>
      </View>
    </View>
  );
}
