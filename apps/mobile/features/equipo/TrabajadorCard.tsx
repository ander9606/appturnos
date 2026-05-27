import React from 'react';
import { View, Text, Pressable } from 'react-native';
import type { Trabajador } from '@api-client';

// ── Helpers ───────────────────────────────────────────────────────────────

function initials(nombre: string, apellido: string): string {
  return `${nombre[0] ?? ''}${apellido[0] ?? ''}`.toUpperCase();
}

const AVATAR_COLORS = [
  'bg-primary',
  'bg-info',
  'bg-success',
  'bg-warning',
  'bg-purple-500',
  'bg-pink-500',
];

function avatarColor(id: number): string {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

const TIPO_LABELS: Record<string, string> = {
  turnos:  'Turnos',
  nomina:  'Nómina',
  ambos:   'Ambos',
};

// ── Component ─────────────────────────────────────────────────────────────

interface Props {
  trabajador: Trabajador;
  onPress?: (t: Trabajador) => void;
}

export function TrabajadorCard({ trabajador: t, onPress }: Props) {
  const { id, nombre, apellido, cargo, email, tipo, activo, tarifa_hora, salario_base } = t;

  const salarioLabel = tarifa_hora != null
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
      <View
        className={`w-12 h-12 rounded-full items-center justify-center mr-3 ${avatarColor(id)}`}
      >
        <Text className="text-white font-bold text-base">
          {initials(nombre, apellido)}
        </Text>
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
        <View className="bg-primary/10 rounded-full px-2 py-0.5 mb-1">
          <Text className="text-primary text-xs font-semibold">
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
