import React from 'react';
import { View, Text, Pressable } from 'react-native';
import type { Trabajador } from '@api-client';
import { Avatar } from '@/components/ui/Avatar';
import { THEME_COLORS, COLORS } from '@/lib/designTokens';

const TIPO_LABELS: Record<string, string> = {
  turnos:  'Turnos',
  nomina:  'Nómina',
  ambos:   'Ambos',
};

// Mismos colores que el resto de la app usa para diferenciar turnos/nómina (ver THEME_COLORS).
const TIPO_COLORS: Record<string, string> = {
  turnos: THEME_COLORS.turnos.primary,
  nomina: THEME_COLORS.nomina.primary,
  ambos:  COLORS.info,
};

// ── Component ─────────────────────────────────────────────────────────────

interface Props {
  trabajador: Trabajador;
  onPress?: (t: Trabajador) => void;
}

export function TrabajadorCard({ trabajador: t, onPress }: Props) {
  const { id, nombre, apellido, cargo, email, tipo, activo, tarifa_hora, salario_base, foto_perfil } = t;

  // Los trabajadores 'turnos' no tienen tarifa fija: cobran por turno aceptado (tarifa_dia de la oferta).
  const salarioLabel = tipo === 'turnos'
    ? null
    : tarifa_hora != null
    ? `$${Number(tarifa_hora).toLocaleString('es-CO')} / h`
    : salario_base != null
    ? `$${Number(salario_base).toLocaleString('es-CO')} / mes`
    : null;

  return (
    <Pressable
      onPress={() => onPress?.(t)}
      className="bg-card rounded-xl p-4 mb-3 flex-row items-center border border-border active:opacity-70"
    >
      {/* Avatar */}
      <View className="mr-3">
        <Avatar id={id} nombre={nombre} apellido={apellido} fotoB64={foto_perfil} size={48} />
      </View>

      {/* Info */}
      <View className="flex-1 min-w-0">
        <View className="flex-row items-center gap-2 flex-wrap">
          <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
            {apellido}, {nombre}
          </Text>
          {!activo && (
            <View className="bg-danger/10 rounded px-1.5 py-0.5">
              <Text className="text-danger text-xs font-medium">Inactivo</Text>
            </View>
          )}
        </View>

        {cargo != null && (
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
            {cargo}
          </Text>
        )}
        {email != null && (
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {email}
          </Text>
        )}
      </View>

      {/* Right side */}
      <View className="items-end ml-2 shrink-0">
        <View className="rounded-full px-2 py-0.5 mb-1" style={{ backgroundColor: (TIPO_COLORS[tipo] ?? COLORS.primary) + '1A' }}>
          <Text className="text-xs font-semibold" style={{ color: TIPO_COLORS[tipo] ?? COLORS.primary }}>
            {TIPO_LABELS[tipo] ?? tipo}
          </Text>
        </View>
        {salarioLabel != null && (
          <Text className="text-xs text-muted-foreground">{salarioLabel}</Text>
        )}
      </View>
    </Pressable>
  );
}
