import React from 'react';
import { Pressable } from 'react-native';
import type { TurnoDeGrupo } from '@api-client';
import { Text } from '@/components/ui/Text';
import { formatTimeRange } from '@/lib/formatters';
import { fmtDate } from '@/features/turnos/oferta/fechasOferta';

/**
 * Un turno de un grupo: fecha, título, horario y cuántas plazas están cubiertas (los cancelados salen tachados). En el
 * detalle del grupo va como tarjeta; `compacta` es la versión de lista que se despliega dentro de la tarjeta del grupo.
 */
export function FilaTurno({ turno, onPress, compacta = false }: { turno: TurnoDeGrupo; onPress: () => void; compacta?: boolean }) {
  const cancelado = turno.estado === 'cancelada';
  const horario = turno.hora_fin_estimada ? formatTimeRange(turno.hora_inicio, turno.hora_fin_estimada) : turno.hora_inicio.slice(0, 5);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={compacta ? 'px-4 py-3 gap-0.5 border-t border-border active:opacity-70' : 'bg-card border border-border rounded-2xl p-4 gap-1 active:opacity-70'}
    >
      <Text className="text-xs font-semibold text-muted-foreground uppercase">{fmtDate(turno.fecha)}</Text>
      <Text className={`${compacta ? 'text-sm' : 'text-base'} font-bold ${cancelado ? 'text-muted-foreground line-through' : 'text-foreground'}`} numberOfLines={2}>
        {turno.titulo}
      </Text>
      <Text className={`${compacta ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
        {horario}{turno.fin_dia_siguiente ? ' (día sig.)' : ''}
        {cancelado ? ' · Cancelado' : ` · ${turno.plazas_cubiertas} de ${turno.plazas} plazas cubiertas`}
      </Text>
    </Pressable>
  );
}
