import React from 'react';
import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { COLORS } from '@/lib/designTokens';

export const ROL_LABELS: Record<string, string> = {
  admin_empresa:       'Administrador',
  jefe_turnos:         'Jefe de Turnos',
  jefe_nomina:         'Jefe de Nómina',
  nomina:              'Nómina',
  trabajador_turnos:   'Trabajador de Turnos',
  trabajador_nomina:   'Trabajador de Nómina',
  super_admin:         'Super Admin',
};

export function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-5 mb-2 mt-6">
      {title}
    </Text>
  );
}

export function CardRow({
  label,
  value,
  onPress,
  last = false,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center justify-between px-5 py-4 bg-card ${!last ? 'border-b border-border' : ''} ${onPress ? 'active:opacity-70' : ''}`}
    >
      <Text className="text-sm text-muted-foreground w-28">{label}</Text>
      <Text className="text-sm font-medium text-foreground flex-1 text-right" numberOfLines={1}>
        {value}
      </Text>
      {onPress && <Ionicons name="chevron-forward" size={16} color={COLORS.placeholder} style={{ marginLeft: 4 }} />}
    </Pressable>
  );
}

/** Fila de acceso rápido: icono, etiqueta y flecha; al tocarla navega a `route`. La primera de una tarjeta no lleva borde arriba. */
export function FilaAcceso({ icon, label, route, primera = false, boton = false }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  route: string;
  primera?: boolean;
  /** Algunas filas se anuncian como botón para lectores de pantalla (ver `accesos.ts`). */
  boton?: boolean;
}) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(route)}
      className={`${primera ? '' : 'border-t border-border '}px-5 py-4 flex-row items-center justify-between active:opacity-70`}
      accessibilityRole={boton ? 'button' : undefined}
    >
      <View className="flex-row items-center gap-3">
        <Ionicons name={icon} size={16} color={COLORS.mutedForeground} />
        <Text className="text-sm font-medium text-foreground">{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={COLORS.placeholder} />
    </Pressable>
  );
}
