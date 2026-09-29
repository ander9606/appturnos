import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function TurnoDescripcionCard({
  descripcion, notasAdicionales, notasExterno,
}: {
  descripcion: string | null | undefined;
  notasAdicionales: string | null | undefined;
  notasExterno: string | null | undefined;
}) {
  const secciones = [
    descripcion && {
      key: 'descripcion',
      icon: 'cube-outline' as const,
      label: 'Material a instalar',
      texto: descripcion,
    },
    notasAdicionales && {
      key: 'notasAdicionales',
      icon: 'information-circle-outline' as const,
      label: 'Detalles adicionales',
      texto: notasAdicionales,
    },
    notasExterno && {
      key: 'notasExterno',
      icon: 'people-outline' as const,
      label: 'Equipo del cliente',
      texto: notasExterno,
    },
  ].filter((s): s is { key: string; icon: 'cube-outline' | 'information-circle-outline' | 'people-outline'; label: string; texto: string } => Boolean(s));

  if (secciones.length === 0) return null;

  return (
    <View
      className="bg-card rounded-2xl px-5 py-4 gap-3"
      style={{ elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8 }}
    >
      {secciones.map((s, i) => (
        <React.Fragment key={s.key}>
          {i > 0 && <View className="border-t border-border" />}
          <View className="gap-1">
            <View className="flex-row items-center gap-2">
              <Ionicons name={s.icon} size={14} color="#64748B" />
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {s.label}
              </Text>
            </View>
            <Text className="text-sm text-foreground leading-5 pl-5">{s.texto}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}
