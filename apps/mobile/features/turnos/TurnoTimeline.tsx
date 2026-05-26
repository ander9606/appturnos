/**
 * TurnoTimeline — visualiza el progreso de un turno como una línea de tiempo vertical
 *
 * pendiente → confirmado → en_progreso → completado
 */
import React from 'react';
import { View, Text } from 'react-native';
import type { EstadoAsignacion } from '@api-client';

interface TimelineStep {
  key: EstadoAsignacion;
  label: string;
  sublabel?: string;
}

const STEPS: TimelineStep[] = [
  { key: 'pendiente',   label: 'Postulado',   sublabel: 'Esperando confirmación' },
  { key: 'confirmado',  label: 'Confirmado',  sublabel: 'Turno asignado' },
  { key: 'en_progreso', label: 'En curso',    sublabel: 'Marcaste el ingreso' },
  { key: 'completado',  label: 'Completado',  sublabel: 'Turno finalizado' },
];

const ORDER: Record<EstadoAsignacion, number> = {
  pendiente:     0,
  confirmado:    1,
  en_progreso:   2,
  completado:    3,
  no_presentado: -1,
  cancelado:     -1,
};

interface TurnoTimelineProps {
  estado: EstadoAsignacion;
  ingresoTime?: string | null;
  egresoTime?: string | null;
}

export function TurnoTimeline({ estado, ingresoTime, egresoTime }: TurnoTimelineProps) {
  const currentOrder = ORDER[estado] ?? -1;

  if (estado === 'cancelado') {
    return (
      <View className="bg-danger-light rounded-2xl px-4 py-4 flex-row items-center gap-3">
        <Text className="text-2xl">🚫</Text>
        <View>
          <Text className="text-sm font-semibold text-danger">Turno cancelado</Text>
          <Text className="text-xs text-danger/70 mt-0.5">
            Este turno fue cancelado por la empresa.
          </Text>
        </View>
      </View>
    );
  }

  if (estado === 'no_presentado') {
    return (
      <View className="bg-warning-light rounded-2xl px-4 py-4 flex-row items-center gap-3">
        <Text className="text-2xl">⏰</Text>
        <View>
          <Text className="text-sm font-semibold text-amber-700">No presentaste asistencia</Text>
          <Text className="text-xs text-amber-600 mt-0.5">
            No se registró tu llegada en el horario previsto.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="gap-0">
      {STEPS.map((step, idx) => {
        const stepOrder = ORDER[step.key] ?? 0;
        const isDone    = currentOrder > stepOrder;
        const isCurrent = currentOrder === stepOrder;
        const isFuture  = currentOrder < stepOrder;

        // Extra sublabel for done steps with time
        let extraLabel = step.sublabel;
        if (step.key === 'en_progreso' && ingresoTime) {
          extraLabel = `Ingreso: ${ingresoTime.slice(11, 16)}`;
        }
        if (step.key === 'completado' && egresoTime) {
          extraLabel = `Salida: ${egresoTime.slice(11, 16)}`;
        }

        return (
          <View key={step.key} className="flex-row gap-3">
            {/* ── Left column: dot + line ─────────────────────── */}
            <View className="items-center" style={{ width: 32 }}>
              {/* Dot */}
              <View
                className={[
                  'w-7 h-7 rounded-full items-center justify-center z-10',
                  isDone    ? 'bg-success' : '',
                  isCurrent ? 'bg-primary-500' : '',
                  isFuture  ? 'bg-muted border-2 border-border' : '',
                ].join(' ')}
              >
                {isDone && <Text className="text-xs text-white font-bold">✓</Text>}
                {isCurrent && <View className="w-2.5 h-2.5 bg-white rounded-full" />}
              </View>

              {/* Connector line (not after last) */}
              {idx < STEPS.length - 1 && (
                <View
                  className={`w-0.5 flex-1 my-0.5 ${isDone ? 'bg-success' : 'bg-border'}`}
                  style={{ minHeight: 24 }}
                />
              )}
            </View>

            {/* ── Right column: text ──────────────────────────── */}
            <View className={`flex-1 pb-4 ${idx === STEPS.length - 1 ? 'pb-0' : ''}`}>
              <Text
                className={[
                  'text-sm font-semibold',
                  isDone ? 'text-success' : isCurrent ? 'text-foreground' : 'text-muted-foreground',
                ].join(' ')}
              >
                {step.label}
              </Text>
              <Text className="text-xs text-muted-foreground mt-0.5">{extraLabel}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
