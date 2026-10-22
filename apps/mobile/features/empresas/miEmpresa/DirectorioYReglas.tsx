import React from 'react';
import { View, Switch, Pressable } from 'react-native';
import { Controller, type Control } from 'react-hook-form';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { Text } from '@/components/ui/Text';
import { COLORS } from '@/lib/designTokens';
import { useTheme } from '@/lib/theme';
import { webSafeSecureStore as SecureStore } from '@/lib/secureStore';
import type { FormData } from './miEmpresaForm';

/** Interruptor "Visible en el directorio" (acepta_postulaciones). */
export function DirectorioSwitch({ control }: { control: Control<FormData> }) {
  const theme = useTheme();
  return (
    <View className="bg-card border border-border rounded-2xl px-5 py-4 flex-row items-center justify-between">
      <View className="flex-1 mr-4">
        <Text className="text-sm font-semibold text-foreground">Visible en el directorio</Text>
        <Text className="text-xs text-muted-foreground mt-0.5">
          Los trabajadores turnos pueden ver tu empresa y solicitar vinculación
        </Text>
      </View>
      <Controller
        control={control}
        name="acepta_postulaciones"
        render={({ field: { onChange, value } }) => (
          <Switch
            value={value}
            onValueChange={onChange}
            trackColor={{ true: theme.primary }}
            thumbColor={COLORS.white}
          />
        )}
      />
    </View>
  );
}

/** Enlace al PDF "Cómo calculamos los pagos" (se abre en el navegador con el token de la sesión). */
export function ReglasPagoLink() {
  const theme = useTheme();
  return (
    <Pressable
      onPress={async () => {
        const token = await SecureStore.getItemAsync('appturnos.access_token');
        const base  = process.env.EXPO_PUBLIC_API_URL;
        await WebBrowser.openBrowserAsync(`${base}/api/empresas/reglas-pago?token=${token}`);
      }}
      accessibilityRole="button"
      accessibilityLabel="Descargar PDF: cómo calculamos los pagos"
      className="flex-row items-center gap-3 bg-card border border-border rounded-2xl px-4 py-3 active:opacity-70"
    >
      <Ionicons name="document-text-outline" size={22} color={theme.primary} />
      <View className="flex-1">
        <Text className="text-sm font-semibold text-foreground">Cómo calculamos los pagos</Text>
        <Text className="text-xs text-muted-foreground">Horas, recargos, descuentos y turnos · PDF</Text>
      </View>
      <Ionicons name="download-outline" size={18} color={COLORS.placeholder} />
    </Pressable>
  );
}
