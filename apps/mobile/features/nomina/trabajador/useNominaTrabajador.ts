/**
 * Hook maestro del trabajador_nomina.
 * Centraliza toda la lógica de estado: perfil, períodos, registros,
 * geofence y mutaciones de marcaje.
 */

import { useState, useMemo, useCallback } from 'react';
import { Alert } from 'react-native';
import { ApiError } from '@api-client';
import type { RegistroDiario, PeriodoNomina } from '@api-client';
import { toISODate } from '@/lib/formatters';
import { useGeofence } from '@/features/turnos/useGeofence';
import {
  usePeriodos,
  useRegistros,
  useNominaPerfil,
  useMarcarEntrada,
  useMarcarSalida,
} from '../useNomina';
import {
  getValorHora,
  calcularResumenPeriodo,
  getEstadoHoy,
  type EstadoHoy,
  type ResumenPeriodoNomina,
} from './nominaTrabajadorUtils';

export interface NominaTrabajadorState {
  // Perfil
  valorHora:       number;
  salarioBase:     number | null;
  tipoMarcacion:   'libre' | 'fijo';
  puntoMarcaje:    { nombre: string; latitud: number; longitud: number; radio_metros: number } | null;

  // Períodos
  periodos:               PeriodoNomina[];
  periodoActivo:          PeriodoNomina | undefined;
  setPeriodoSeleccionado: (id: number) => void;

  // Registros
  registros:     RegistroDiario[];
  resumen:       ResumenPeriodoNomina;
  registroHoy:   RegistroDiario | null;
  estadoHoy:     EstadoHoy;
  todayISO:      string;

  // Geofence
  geo: ReturnType<typeof useGeofence>;
  fijoBloqueado: boolean;

  // Marcaje
  isMutating: boolean;
  handleEntrada: () => Promise<void>;
  handleSalida:  () => void;

  // Loading / refresh
  loading:          boolean;
  loadingRegistros: boolean;
  isRefetching:     boolean;
  onRefresh:        () => void;
}

export function useNominaTrabajador(): NominaTrabajadorState {
  // ── Perfil ─────────────────────────────────────────────────────────────
  const { data: perfil } = useNominaPerfil();
  const tipoMarcacion = perfil?.tipo_marcacion ?? 'libre';
  const puntoMarcaje  = perfil?.punto_marcaje ?? null;
  const salarioBase   = perfil?.salario_base ?? null;
  const valorHora     = getValorHora(salarioBase);

  // ── Períodos ───────────────────────────────────────────────────────────
  const {
    data: periodosResp,
    isLoading: loading,
    refetch: refetchPeriodos,
  } = usePeriodos('abierto');

  const periodos = periodosResp?.data ?? [];
  const [periodoSeleccionado, setPeriodoSeleccionado] = useState<number | undefined>();
  const periodoActivo = periodos.find((p) => p.id === (periodoSeleccionado ?? periodos[0]?.id)) ?? periodos[0];

  // ── Registros ──────────────────────────────────────────────────────────
  const {
    data: registrosResp,
    isLoading: loadingRegistros,
    refetch: refetchRegistros,
    isRefetching,
  } = useRegistros({ periodo_id: periodoActivo?.id, limit: 100 });

  const registros = registrosResp?.data ?? [];

  // ── Cálculos derivados ─────────────────────────────────────────────────
  const resumen = useMemo(
    () => calcularResumenPeriodo(registros, valorHora),
    [registros, valorHora],
  );

  const todayISO = useMemo(() => toISODate(new Date()), []);

  const registroHoy = useMemo(
    () => registros.find((r) => r.fecha === todayISO) ?? null,
    [registros, todayISO],
  );

  const estadoHoy: EstadoHoy = useMemo(
    () => getEstadoHoy(registroHoy, periodoActivo?.estado === 'abierto'),
    [registroHoy, periodoActivo],
  );

  // ── Geofence ───────────────────────────────────────────────────────────
  const geofenceTargets = tipoMarcacion === 'fijo' && puntoMarcaje
    ? [{ lat: puntoMarcaje.latitud, lng: puntoMarcaje.longitud, radiusM: puntoMarcaje.radio_metros }]
    : null;

  const geo = useGeofence({ targets: geofenceTargets, enabled: tipoMarcacion === 'fijo' });
  const fijoBloqueado = tipoMarcacion === 'fijo' && !geo.canMark;

  // ── Mutaciones ─────────────────────────────────────────────────────────
  const entradaMutation = useMarcarEntrada();
  const salidaMutation  = useMarcarSalida();
  const isMutating      = entradaMutation.isPending || salidaMutation.isPending;

  const handleEntrada = useCallback(async () => {
    try {
      const coords = tipoMarcacion === 'fijo' && geo.currentLocation
        ? { latitud: geo.currentLocation.lat, longitud: geo.currentLocation.lng }
        : undefined;
      await entradaMutation.mutateAsync(coords);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Error al marcar entrada';
      Alert.alert('Error', msg);
    }
  }, [tipoMarcacion, geo.currentLocation, entradaMutation]);

  const handleSalida = useCallback(() => {
    if (!registroHoy) return;
    Alert.alert(
      'Confirmar salida',
      '¿Confirmas que deseas marcar tu salida?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Marcar salida',
          onPress: async () => {
            try {
              const coords = tipoMarcacion === 'fijo' && geo.currentLocation
                ? { latitud: geo.currentLocation.lat, longitud: geo.currentLocation.lng }
                : undefined;
              const result = await salidaMutation.mutateAsync({ registroId: registroHoy.id, ...coords });
              if (result?.advertencia) Alert.alert('Horas extra', result.advertencia);
            } catch (err) {
              const msg = err instanceof ApiError ? err.message : 'Error al marcar salida';
              Alert.alert('Error', msg);
            }
          },
        },
      ],
    );
  }, [registroHoy, tipoMarcacion, geo.currentLocation, salidaMutation]);

  // ── Refresh ────────────────────────────────────────────────────────────
  const onRefresh = useCallback(() => {
    refetchPeriodos();
    refetchRegistros();
  }, [refetchPeriodos, refetchRegistros]);

  return {
    valorHora,
    salarioBase,
    tipoMarcacion,
    puntoMarcaje,
    periodos,
    periodoActivo,
    setPeriodoSeleccionado,
    registros,
    resumen,
    registroHoy,
    estadoHoy,
    todayISO,
    geo,
    fijoBloqueado,
    isMutating,
    handleEntrada,
    handleSalida,
    loading,
    loadingRegistros,
    isRefetching,
    onRefresh,
  };
}
