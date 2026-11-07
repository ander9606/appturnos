import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { GrupoTurno } from '@api-client';
import { Text } from '@/components/ui/Text';
import { COLORS } from '@/lib/designTokens';
import { FaseChip } from './FaseGrupo';
import { subtituloGrupo } from './grupoUtils';

type Props = {
  grupo: GrupoTurno;
  /** ¿Está desplegada? Al desplegarla se ven sus turnos (el contenido va en `children`). */
  expandido: boolean;
  /** Despliega o pliega la tarjeta (tocar el cuerpo de la tarjeta o «Ver N turnos»). */
  onToggle: () => void;
  /** Abre el formulario para editar el grupo. */
  onEditar: () => void;
  /** Contenido desplegado: los turnos del grupo. */
  children?: React.ReactNode;
};

/**
 * Tarjeta de un grupo en la lista, que se despliega al tocarla: nombre, fase, fechas y número de turnos, y el lugar
 * (su nombre corto si lo tiene). Abajo, las dos acciones a la vista: ver (u ocultar) sus turnos y editarlo.
 */
export function GrupoCard({ grupo, expandido, onToggle, onEditar, children }: Props) {
  const total = grupo.total_turnos;
  const etiquetaVer = expandido ? 'Ocultar turnos' : total === 1 ? 'Ver 1 turno' : `Ver ${total} turnos`;
  return (
    <View className="bg-card border border-border rounded-2xl overflow-hidden">
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: expandido }}
        accessibilityLabel={`${grupo.nombre}. ${subtituloGrupo(grupo)}`}
        className="p-4 gap-1.5 active:opacity-70"
      >
        <View className="flex-row items-start justify-between gap-2">
          <Text className="flex-1 text-base font-bold text-foreground" numberOfLines={2}>{grupo.nombre}</Text>
          <FaseChip fase={grupo.fase} />
        </View>
        <Text className="text-sm text-muted-foreground">{subtituloGrupo(grupo)}</Text>
        {grupo.lugar ? (
          <View className="flex-row items-center gap-1">
            <Ionicons name="location-outline" size={13} color={COLORS.mutedForeground} />
            <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>{grupo.lugar_alias || grupo.lugar}</Text>
          </View>
        ) : null}
      </Pressable>

      <View className="flex-row border-t border-border">
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityState={{ expanded: expandido }}
          accessibilityLabel={`${etiquetaVer} de ${grupo.nombre}`}
          className="flex-1 flex-row items-center justify-center gap-1.5 py-3 active:opacity-70"
        >
          <Text className="text-sm font-semibold text-primary-700">{etiquetaVer}</Text>
          <Ionicons name={expandido ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.primary} />
        </Pressable>
        <View className="w-px bg-border" />
        <Pressable
          onPress={onEditar}
          accessibilityRole="button"
          accessibilityLabel={`Editar ${grupo.nombre}`}
          className="flex-1 flex-row items-center justify-center gap-1.5 py-3 active:opacity-70"
        >
          <Ionicons name="create-outline" size={16} color={COLORS.mutedForeground} />
          <Text className="text-sm font-semibold text-muted-foreground">Editar</Text>
        </Pressable>
      </View>

      {expandido ? children : null}
    </View>
  );
}
