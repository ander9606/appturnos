/**
 * MarcajeButtons — badge de geofence + botones de entrada/salida.
 * Solo renderiza los controles relevantes según el estado del día.
 */

import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import type { EstadoHoy } from '../nominaTrabajadorUtils';
import type { useGeofence } from '@/features/turnos/useGeofence';

interface Props {
  estadoHoy:      EstadoHoy;
  periodoAbierto: boolean;
  tipoMarcacion:  'libre' | 'fijo';
  puntoNombre:    string | null;
  geo:            ReturnType<typeof useGeofence>;
  fijoBloqueado:  boolean;
  isMutating:     boolean;
  onEntrada:      () => void;
  onSalida:       () => void;
  horasTrabajadas?: number;
}

export function MarcajeButtons({
  estadoHoy,
  periodoAbierto,
  tipoMarcacion,
  puntoNombre,
  geo,
  fijoBloqueado,
  isMutating,
  onEntrada,
  onSalida,
  horasTrabajadas,
}: Props) {
  return (
    <View className="gap-3">
      {/* ── Badge geofence (solo tipo fijo) ──────────────── */}
      {tipoMarcacion === 'fijo' && (
        <View className="flex-row items-center">
          {geo.permissionDenied ? (
            <View className="flex-row items-center gap-1.5 bg-muted px-3 py-1.5 rounded-full">
              <View className="w-2 h-2 rounded-full bg-warning" />
              <Text className="text-xs text-muted-foreground">GPS no disponible</Text>
            </View>
          ) : (
            <View className={[
              'flex-row items-center gap-1.5 px-3 py-1.5 rounded-full',
              geo.canMark ? 'bg-success-light' : 'bg-red-50',
            ].join(' ')}>
              <View className={[
                'w-2 h-2 rounded-full',
                geo.canMark
                  ? 'bg-success'
                  : geo.status === 'unknown' ? 'bg-muted-foreground' : 'bg-danger',
              ].join(' ')} />
              <Text className={[
                'text-xs font-medium',
                geo.canMark
                  ? 'text-success'
                  : geo.status === 'unknown' ? 'text-muted-foreground' : 'text-danger',
              ].join(' ')}>
                {geo.canMark
                  ? `Dentro del área${puntoNombre ? ` · ${puntoNombre}` : ''}`
                  : geo.status === 'unknown'
                  ? 'Obteniendo ubicación…'
                  : `Fuera del área${puntoNombre ? ` · ${puntoNombre}` : ''}`}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── Sin período activo ────────────────────────────── */}
      {estadoHoy === 'sin_periodo' && (
        <View className="bg-muted rounded-2xl py-3 items-center">
          <Text className="text-sm text-muted-foreground">Sin período de nómina activo</Text>
        </View>
      )}

      {/* ── Botón marcar entrada ─────────────────────────── */}
      {estadoHoy === 'sin_registro' && periodoAbierto && (
        <TouchableOpacity
          onPress={onEntrada}
          disabled={isMutating || fijoBloqueado}
          className={[
            'rounded-2xl py-4 items-center',
            isMutating || fijoBloqueado ? 'bg-muted' : 'bg-success',
          ].join(' ')}
          style={!(isMutating || fijoBloqueado)
            ? { elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 }
            : undefined}
        >
          {isMutating
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text className={[
                'text-base font-bold',
                fijoBloqueado ? 'text-muted-foreground' : 'text-white',
              ].join(' ')}>
                Marcar entrada
              </Text>
          }
        </TouchableOpacity>
      )}

      {/* ── Botón marcar salida ──────────────────────────── */}
      {estadoHoy === 'en_jornada' && periodoAbierto && (
        <TouchableOpacity
          onPress={onSalida}
          disabled={isMutating || fijoBloqueado}
          className={[
            'rounded-2xl py-4 items-center',
            isMutating || fijoBloqueado ? 'bg-muted' : 'bg-danger',
          ].join(' ')}
          style={!(isMutating || fijoBloqueado)
            ? { elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 }
            : undefined}
        >
          {isMutating
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text className={[
                'text-base font-bold',
                fijoBloqueado ? 'text-muted-foreground' : 'text-white',
              ].join(' ')}>
                Marcar salida
              </Text>
          }
        </TouchableOpacity>
      )}

      {/* ── Jornada completada ───────────────────────────── */}
      {estadoHoy === 'jornada_completa' && (
        <View className="bg-success-light rounded-2xl py-3 items-center">
          <Text className="text-sm font-semibold text-success">
            Jornada completada
            {horasTrabajadas != null ? ` · ${horasTrabajadas.toFixed(1)}h registradas` : ''}
          </Text>
        </View>
      )}
    </View>
  );
}
