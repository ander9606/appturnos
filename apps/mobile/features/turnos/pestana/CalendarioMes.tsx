import { Text } from '@/components/ui/Text';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonCalendario } from '@/components/ui/Skeleton';
import { MonthCalendar } from '@/components/ui/MonthCalendar';
import { NavegadorMes } from '@/components/ui/NavegadorMes';
import { COLORS } from '@/lib/designTokens';
import React, { type ReactNode } from 'react';
import { View, ScrollView } from 'react-native';
import { useTheme } from '@/lib/theme';
import { TurnosExtraOptIn, esErrorTurnosExtraApagadas } from '@/features/nomina/TurnosExtraOptIn';
import { shiftMonth, mesDeHoy, type CalendarDay, type MonthCursor } from '@/lib/calendar';
import type { Asignacion, Oferta } from '@api-client';
import { CAL_COLOR, colorOferta } from './turnosPestana';

type SetCursor = (fn: (c: MonthCursor) => MonthCursor) => void;

/** Navegador del mes compartido (con "Hoy" cuando no se ve el mes actual) + props de deslizar. */
function useNavMes(cursor: MonthCursor, onCursor: SetCursor, onHoy: () => void) {
  const hoy = mesDeHoy();
  const esActual = cursor.year === hoy.year && cursor.month === hoy.month;
  return {
    anterior: () => onCursor(c => shiftMonth(c, -1)),
    siguiente: () => onCursor(c => shiftMonth(c, 1)),
    hoy: esActual ? undefined : onHoy,
  };
}

function Navegador({ cursor, nav }: { cursor: MonthCursor; nav: ReturnType<typeof useNavMes> }) {
  return (
    <View className="mb-3">
      <NavegadorMes mes={cursor.month} anio={cursor.year} onAnterior={nav.anterior} onSiguiente={nav.siguiente} onHoy={nav.hoy} />
    </View>
  );
}

function LeyendaPunto({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <Text className="text-xs text-muted-foreground">{label}</Text>
    </View>
  );
}

/** Calendario mensual del gestor: un punto por oferta, coloreado según su estado/urgencia. */
export function CalendarioMesGestor({
  cursor, onCursor, weeks, loading, isError, error, onRetry, ofertasPorDia, pendientesPorOferta, today, onDayPress, selectedDate, onHoy, resumen,
}: {
  cursor: MonthCursor;
  onCursor: SetCursor;
  weeks: CalendarDay[][];
  loading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  ofertasPorDia: Map<string, Oferta[]>;
  pendientesPorOferta: Map<number, number>;
  today: string;
  onDayPress: (day: CalendarDay) => void;
  selectedDate: string;
  /** Vuelve al mes y día de hoy. */
  onHoy: () => void;
  /** Vista previa del día marcado (la arma la pantalla). */
  resumen: ReactNode;
}) {
  const theme = useTheme();
  const nav = useNavMes(cursor, onCursor, onHoy);
  return (
    <ScrollView className="flex-1" contentContainerClassName="px-5 pt-3 pb-28">
      <Navegador cursor={cursor} nav={nav} />

      {loading ? (
        <SkeletonCalendario />
      ) : isError ? (
        <ErrorState compact error={error} onRetry={onRetry} fallback="No se pudieron cargar los turnos del mes" />
      ) : (
        <MonthCalendar
          weeks={weeks}
          selectedDate={selectedDate}
          onMesAnterior={nav.anterior}
          onMesSiguiente={nav.siguiente}
          onDayPress={onDayPress}
          renderDay={(day: CalendarDay) => {
            const delDia = ofertasPorDia.get(day.date) ?? [];
            if (delDia.length === 0) return null;
            return (
              <View className="flex-row flex-wrap gap-0.5">
                {delDia.slice(0, 5).map(o => (
                  <View
                    key={o.id}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: colorOferta(o, pendientesPorOferta, today, theme.primary) }}
                  />
                ))}
              </View>
            );
          }}
        />
      )}

      {!loading && !isError && resumen}

      <View className="flex-row items-center gap-x-3 gap-y-1.5 justify-center mt-3 flex-wrap">
        <LeyendaPunto color={CAL_COLOR.borrador} label="Borrador" />
        <LeyendaPunto color={theme.primary} label="Publicada" />
        <LeyendaPunto color={CAL_COLOR.urgente} label="Necesita atención" />
        <LeyendaPunto color={CAL_COLOR.completada} label="Completada" />
        <LeyendaPunto color={CAL_COLOR.cancelada} label="Cancelada" />
      </View>
    </ScrollView>
  );
}

/** Calendario mensual del trabajador: sus turnos (sólido/borde) y las ofertas disponibles. */
export function CalendarioMesTrabajador({
  cursor, onCursor, weeks, loading, isNomina, errOfertas, errMios, onRetry,
  misTurnosPorDia, ofertasPorDia, aplicadosIds, onDayPress, selectedDate, onHoy, resumen,
}: {
  cursor: MonthCursor;
  onCursor: SetCursor;
  weeks: CalendarDay[][];
  loading: boolean;
  isNomina: boolean;
  errOfertas: { isError: boolean; error: unknown };
  errMios: { isError: boolean; error: unknown };
  onRetry: () => void;
  misTurnosPorDia: Map<string, Asignacion[]>;
  ofertasPorDia: Map<string, Oferta[]>;
  aplicadosIds: Set<number>;
  onDayPress: (day: CalendarDay) => void;
  selectedDate: string;
  /** Vuelve al mes y día de hoy. */
  onHoy: () => void;
  /** Vista previa del día marcado (la arma la pantalla). */
  resumen: ReactNode;
}) {
  const theme = useTheme();
  const nav = useNavMes(cursor, onCursor, onHoy);
  return (
    <ScrollView className="flex-1" contentContainerClassName="px-5 pt-3 pb-28">
      <Navegador cursor={cursor} nav={nav} />

      {loading ? (
        <SkeletonCalendario />
      ) : isNomina && esErrorTurnosExtraApagadas(errOfertas.error) ? (
        <TurnosExtraOptIn />
      ) : errOfertas.isError || errMios.isError ? (
        <ErrorState
          compact
          error={errOfertas.error ?? errMios.error}
          onRetry={onRetry}
          fallback="No se pudieron cargar los turnos del mes"
        />
      ) : (
        <MonthCalendar
          weeks={weeks}
          selectedDate={selectedDate}
          onMesAnterior={nav.anterior}
          onMesSiguiente={nav.siguiente}
          onDayPress={onDayPress}
          renderDay={(day: CalendarDay) => {
            const mios = misTurnosPorDia.get(day.date) ?? [];
            // Naranja sólido solo si ya está aceptado (confirmado/en curso/completado) —
            // una postulación pendiente todavía no es un turno asegurado.
            const aceptados  = mios.filter(a => a.estado === 'confirmado' || a.estado === 'en_progreso' || a.estado === 'completado');
            // por_reconfirmar también necesita una acción tuya (como pendiente),
            // aunque ya haya estado aceptado antes de que cambiara el horario/lugar.
            const pendientes = mios.filter(a => a.estado === 'pendiente' || a.estado === 'por_reconfirmar');
            const disponibles = (ofertasPorDia.get(day.date) ?? []).filter(o => !aplicadosIds.has(o.id));
            if (aceptados.length === 0 && pendientes.length === 0 && disponibles.length === 0) return null;
            return (
              <View className="flex-row flex-wrap gap-0.5">
                {aceptados.slice(0, 3).map(a => (
                  <View key={`a${a.id}`} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.primary }} />
                ))}
                {pendientes.slice(0, 2).map(a => (
                  <View key={`p${a.id}`} className="w-1.5 h-1.5 rounded-full border" style={{ borderColor: theme.primary }} />
                ))}
                {disponibles.slice(0, 3).map(o => (
                  <View key={`d${o.id}`} className="w-1.5 h-1.5 rounded-full border" style={{ borderColor: COLORS.info }} />
                ))}
              </View>
            );
          }}
        />
      )}

      {!loading && !errOfertas.isError && !errMios.isError && resumen}

      <View className="flex-row items-center gap-4 justify-center mt-4 flex-wrap">
        <View className="flex-row items-center gap-1.5">
          <View className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.primary }} />
          <Text className="text-xs text-muted-foreground">Aceptado</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className="w-2 h-2 rounded-full border" style={{ borderColor: theme.primary }} />
          <Text className="text-xs text-muted-foreground">Postulación pendiente</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className="w-2 h-2 rounded-full border" style={{ borderColor: COLORS.info }} />
          <Text className="text-xs text-muted-foreground">Disponibles</Text>
        </View>
      </View>
    </ScrollView>
  );
}
