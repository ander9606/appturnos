/**
 * RangoFechasCompensatorio — los 28 días candidatos (plazo legal, Art. 179
 * CST) para asignar un descanso compensatorio, coloreados por cercanía al
 * día trabajado: verde = pronto, ámbar = intermedio, rojo = cerca del
 * límite. Los días ya ocupados (otro registro, otro compensatorio, o
 * domingo/festivo) aparecen deshabilitados — el rango completo lo calcula
 * el backend, así el cliente nunca puede seleccionar una fecha fuera de ley.
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRangoCompensatorio } from './useCompensatorios';
import { fmtFechaCorta } from '../trabajador/nominaTrabajadorUtils';

interface Props {
  compensatorioId: number;
  seleccionada: string; // YYYY-MM-DD
  onSeleccionar: (fecha: string) => void;
}

export function RangoFechasCompensatorio({ compensatorioId, seleccionada, onSeleccionar }: Props) {
  const { data: dias, isLoading, isError, refetch } = useRangoCompensatorio(compensatorioId, true);

  if (isLoading) {
    return (
      <View className="py-4 items-center">
        <ActivityIndicator size="small" />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="py-2 gap-1.5">
        <Text className="text-xs text-danger">No se pudieron cargar las fechas disponibles.</Text>
        <TouchableOpacity onPress={() => refetch()} className="self-start">
          <Text className="text-xs font-semibold text-primary underline">Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const disponibles = dias?.filter((d) => d.disponible) ?? [];

  if (dias && disponibles.length === 0) {
    return (
      <Text className="text-xs text-danger px-0.5 py-2">
        No quedan fechas disponibles dentro del plazo legal de 28 días — revisa los registros del trabajador.
      </Text>
    );
  }

  return (
    <View className="gap-2">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2 px-0.5">
          {(dias ?? []).map((d) => {
            const activa = d.fecha === seleccionada;
            const colorClase = !d.disponible
              ? 'bg-muted border-border opacity-40'
              : activa
              ? 'bg-primary border-primary'
              : d.zona === 'verde'
              ? 'bg-success-light border-success'
              : d.zona === 'ambar'
              ? 'bg-warning-light border-warning'
              : 'bg-danger-light border-danger';
            const textoClase = activa
              ? 'text-white'
              : !d.disponible
              ? 'text-muted-foreground'
              : d.zona === 'verde'
              ? 'text-green-700'
              : d.zona === 'ambar'
              ? 'text-amber-700'
              : 'text-red-700';

            return (
              <TouchableOpacity
                key={d.fecha}
                disabled={!d.disponible}
                onPress={() => onSeleccionar(d.fecha)}
                className={`px-3 py-2 rounded-xl border ${colorClase}`}
                accessibilityRole="button"
                accessibilityLabel={`${fmtFechaCorta(d.fecha)}${d.disponible ? '' : ', no disponible'}`}
                accessibilityState={{ disabled: !d.disponible, selected: activa }}
              >
                <Text className={`text-xs font-semibold ${textoClase}`}>{fmtFechaCorta(d.fecha)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View className="flex-row gap-3 px-0.5">
        <Leyenda colorClase="bg-success-light" label="Pronto" />
        <Leyenda colorClase="bg-warning-light" label="Intermedio" />
        <Leyenda colorClase="bg-danger-light" label="Cerca del límite" />
      </View>
    </View>
  );
}

function Leyenda({ colorClase, label }: { colorClase: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1">
      <View className={`w-2.5 h-2.5 rounded-full ${colorClase}`} />
      <Text className="text-[10px] text-muted-foreground">{label}</Text>
    </View>
  );
}
