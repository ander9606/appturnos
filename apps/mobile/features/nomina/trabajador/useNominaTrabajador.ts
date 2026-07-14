/**
 * Hook maestro del trabajador_nomina.
 * Centraliza toda la lógica de estado: perfil, períodos, registros,
 * geofence y mutaciones de marcaje.
 */

import { useState, useMemo, useCallback } from 'react';
import { Alert } from 'react-native';
import { ApiError } from '@api-client';
import type { RegistroDiario, PeriodoNomina, PuntoMarcaje } from '@api-client';
import { bogotaToday } from '@/lib/formatters';
import { useGeofence } from '@/features/turnos/useGeofence';
import {
  usePeriodos,
  useRegistros,
  useNominaPerfil,
  useMarcarEntrada,
  useMarcarSalida,
  useSolicitarReingreso,
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
  cargo:           string | null;
  puntoMarcaje:    PuntoMarcaje | null;

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
  isMutating:       boolean;
  handleEntrada:    () => Promise<void>;
  handleSalida:     () => void;
  handleReingreso:  (motivo?: string) => Promise<void>;

  // Loading / refresh
  loading:          boolean;
  loadingRegistros: boolean;
  isRefetching:     boolean;
  onRefresh:        () => void;
  isError:          boolean;
  error:            unknown;
}

export function useNominaTrabajador(): NominaTrabajadorState {
  // ── Perfil ─────────────────────────────────────────────────────────────
  const { data: perfil } = useNominaPerfil();
  const tipoMarcacion = perfil?.tipo_marcacion ?? 'libre';
  const puntoMarcaje  = perfil?.punto_marcaje ?? null;
  const salarioBase   = perfil?.salario_base ?? null;
  const cargo         = perfil?.cargo ?? null;
  const valorHora     = getValorHora(salarioBase);

  // ── Períodos ───────────────────────────────────────────────────────────
  const {
    data: periodosResp,
    isLoading: loading,
    isError: periodosError,
    error: periodosErrorObj,
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

  const todayISO = useMemo(() => bogotaToday(), []);

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
  const entradaMutation   = useMarcarEntrada();
  const salidaMutation    = useMarcarSalida();
  const reingresoMutation = useSolicitarReingreso();
  const isMutating        = entradaMutation.isPending || salidaMutation.isPending || reingresoMutation.isPending;

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

  // La confirmación (con explicación + motivo opcional) vive en la pantalla, en un
  // modal propio — un Alert nativo no permite pedir texto de forma consistente en iOS/Android.
  const handleReingreso = useCallback(async (motivo?: string) => {
    try {
      await reingresoMutation.mutateAsync(motivo);
      Alert.alert('Solicitud enviada', 'El gestor recibirá una notificación para aprobarte.');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Error al enviar la solicitud';
      Alert.alert('Error', msg);
    }
  }, [reingresoMutation]);

  // ── Refresh ────────────────────────────────────────────────────────────
  const onRefresh = useCallback(() => {
    refetchPeriodos();
    refetchRegistros();
  }, [refetchPeriodos, refetchRegistros]);

  return {
    valorHora,
    salarioBase,
    tipoMarcacion,
    cargo,
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
    handleReingreso,
    loading,
    loadingRegistros,
    isRefetching,
    onRefresh,
    isError: periodosError,
    error: periodosErrorObj,
  };
}
