/**
 * Hook maestro del trabajador_nomina.
 * Centraliza toda la lógica de estado: perfil, períodos, registros,
 * geofence y mutaciones de marcaje.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Alert, AppState } from 'react-native';
import { ApiError } from '@api-client';
import type { RegistroDiario, PeriodoNomina, PuntoMarcaje, LiquidacionLinea, TipoContrato, DescuentoNomina, LineaLiquidacionEventual, PeriodoTurnoEventual } from '@api-client';
import { bogotaToday } from '@/lib/formatters';
import { confirm } from '@/lib/confirmDialog';
import { actionToast } from '@/lib/actionToast';
import { useGeofence } from '@/features/turnos/useGeofence';
import { usePeriodosEventual, useLiquidacionEventual } from '@/features/turnos/useTurnosEventual';
import {
  usePeriodos,
  useRegistros,
  useNominaPerfil,
  useLiquidacion,
  useMarcarEntrada,
  useMarcarSalida,
  useSolicitarReingreso,
} from '../useNomina';
import { useMisDescuentos } from '../descuentos/useDescuentos';
import {
  getValorHora,
  calcularResumenPeriodo,
  getEstadoHoy,
  debePreguntarJornadaContinua,
  type EstadoHoy,
  type ResumenPeriodoNomina,
} from './nominaTrabajadorUtils';

export type EstadoUbicacionLibre = 'obteniendo' | 'lista' | 'denegada' | 'no_disponible';

/**
 * Para trabajadores tipo_marcacion 'libre' no hay geofence que validar, pero
 * igual se exige un fix de GPS antes de dejar marcar — sin esto, un trabajador
 * 'libre' podía marcar entrada/salida sin dejar ningún rastro de dónde lo hizo
 * (el fix anterior era best-effort y nunca bloqueaba). Un solo intento por
 * activación alcanza — no hace falta vigilar la posición en el tiempo como sí
 * hace useGeofence para fijo/zonal.
 */
function useUbicacionParaLibre(activo: boolean) {
  const [estado, setEstado] = useState<EstadoUbicacionLibre>('obteniendo');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const intentar = useCallback(async () => {
    setEstado('obteniendo');
    try {
      const Location = await import('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setEstado('denegada');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      setEstado('lista');
    } catch {
      setEstado('no_disponible');
    }
  }, []);

  useEffect(() => {
    if (!activo) return;
    intentar();
    // Si el trabajador salió a Ajustes a conceder el permiso y vuelve, se
    // reintenta solo — sin esto quedaba trabado en 'denegada' hasta salir y
    // reentrar a la pantalla. Mismo patrón que useGeofence.
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') intentar();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo]);

  return { estado, coords, reintentar: intentar };
}

export interface NominaTrabajadorState {
  // Perfil
  valorHora:       number;
  salarioBase:     number | null;
  tipoMarcacion:   'libre' | 'fijo' | 'zonal';
  cargo:           string | null;
  puntoMarcaje:    PuntoMarcaje | null;
  puntosZonales:   PuntoMarcaje[];

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

  // Liquidación real (bruto/neto/descuentos) — la misma que ve el gestor, filtrada a su propia línea.
  miLiquidacion: LiquidacionLinea | undefined;
  tipoContrato:  TipoContrato | undefined;
  misDescuentos: DescuentoNomina[];

  // Turnos eventuales (extra, trimestral) — solo si activó acepta_extras.
  aceptaExtras:     boolean;
  periodoEventual:  PeriodoTurnoEventual | undefined;
  miLineaEventual:  LineaLiquidacionEventual | undefined;

  // Geofence
  geo: ReturnType<typeof useGeofence>;
  marcajeBloqueado: boolean;
  // Ubicación para tipo_marcacion 'libre' — ver useUbicacionParaLibre.
  ubicacionLibre: { estado: EstadoUbicacionLibre; reintentar: () => void };

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
  const puntosZonales = perfil?.puntos_zonales ?? [];
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

  // ── Liquidación real (backend la filtra a esta sola línea) ───────────────
  const { data: liquidacion } = useLiquidacion(periodoActivo?.id ?? null);
  const miLiquidacion = liquidacion?.lineas[0];
  const tipoContrato  = liquidacion?.tipo_contrato;

  // ── Descuentos manuales propios (préstamos, inasistencias, etc.) ─────────
  const { data: misDescuentos = [] } = useMisDescuentos(periodoActivo?.id);

  // ── Turnos eventuales (extra, trimestral) — solo si activó acepta_extras ──
  // Bloque secundario: no se suma a `loading`, no debe bloquear el spinner principal.
  const aceptaExtras = Boolean(perfil?.acepta_extras);
  const { data: periodosEventual } = usePeriodosEventual(aceptaExtras);
  const periodoEventual = periodosEventual?.nomina;
  const { data: liquidacionEventual } = useLiquidacionEventual(
    aceptaExtras ? periodoEventual?.id ?? null : null
  );
  const miLineaEventual = liquidacionEventual?.lineas[0];

  // ── Geofence ───────────────────────────────────────────────────────────
  const requiereGeofence = tipoMarcacion === 'fijo' || tipoMarcacion === 'zonal';
  const geofenceTargets = tipoMarcacion === 'fijo' && puntoMarcaje
    ? [{ lat: puntoMarcaje.latitud, lng: puntoMarcaje.longitud, radiusM: puntoMarcaje.radio_metros }]
    : tipoMarcacion === 'zonal' && puntosZonales.length > 0
    ? puntosZonales.map((p) => ({ lat: p.latitud, lng: p.longitud, radiusM: p.radio_metros }))
    : null;

  const geo = useGeofence({ targets: geofenceTargets, enabled: requiereGeofence });
  const tipoLibre = tipoMarcacion === 'libre';
  const ubicacionLibreState = useUbicacionParaLibre(tipoLibre);
  const marcajeBloqueado = requiereGeofence
    ? !geo.canMark
    : tipoLibre && ubicacionLibreState.estado !== 'lista';

  // ── Mutaciones ─────────────────────────────────────────────────────────
  const entradaMutation   = useMarcarEntrada();
  const salidaMutation    = useMarcarSalida();
  const reingresoMutation = useSolicitarReingreso();
  const isMutating        = entradaMutation.isPending || salidaMutation.isPending || reingresoMutation.isPending;

  // Con geofence (fijo/zonal) el fix ya lo trae useGeofence (vigilancia continua
  // para validar cercanía). Sin geofence (libre) el marcaje queda bloqueado
  // (marcajeBloqueado arriba) hasta tener el fix de useUbicacionParaLibre — así
  // que para cuando esta función corre, ya debería haber coordenadas.
  const obtenerCoordsParaMarcaje = useCallback(async () => {
    if (requiereGeofence) {
      return geo.currentLocation
        ? { latitud: geo.currentLocation.lat, longitud: geo.currentLocation.lng }
        : undefined;
    }
    return ubicacionLibreState.coords
      ? { latitud: ubicacionLibreState.coords.lat, longitud: ubicacionLibreState.coords.lng }
      : undefined;
  }, [requiereGeofence, geo.currentLocation, ubicacionLibreState.coords]);

  const handleEntrada = useCallback(async () => {
    try {
      const coords = await obtenerCoordsParaMarcaje();
      await entradaMutation.mutateAsync(coords);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Error al marcar entrada';
      Alert.alert('Error', msg);
    }
  }, [obtenerCoordsParaMarcaje, entradaMutation]);

  const handleSalida = useCallback(async () => {
    if (!registroHoy?.hora_entrada) return;
    const ok = await confirm({
      title: 'Confirmar salida',
      message: '¿Confirmas que deseas marcar tu salida?',
      confirmLabel: 'Marcar salida',
    });
    if (!ok) return;

    // Por defecto se descuenta 1h de almuerzo en jornadas largas (Art. 167 CST).
    // Solo se ofrece la ventana cuando ya es relevante: si la jornada no llega
    // al umbral, el descuento no aplicaría de todas formas. Es una ventana con
    // tiempo límite (no un diálogo bloqueante) — si no responde a tiempo, se
    // asume el comportamiento por defecto (si tomó almuerzo).
    const jornadaContinua = debePreguntarJornadaContinua(registroHoy.hora_entrada)
      ? await actionToast({
          message: 'Por defecto se descuenta 1h de almuerzo en jornadas largas. ¿Trabajaste jornada continua, sin tomar almuerzo?',
          actionLabel: 'Sí, jornada continua',
        })
      : false;

    try {
      const coords = await obtenerCoordsParaMarcaje();
      const result = await salidaMutation.mutateAsync({ registroId: registroHoy.id, jornada_continua: jornadaContinua, ...coords });
      if (result?.advertencia) Alert.alert('Horas extra', result.advertencia);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Error al marcar salida';
      Alert.alert('Error', msg);
    }
  }, [registroHoy, obtenerCoordsParaMarcaje, salidaMutation]);

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
    puntosZonales,
    periodos,
    periodoActivo,
    setPeriodoSeleccionado,
    registros,
    resumen,
    registroHoy,
    estadoHoy,
    todayISO,
    miLiquidacion,
    tipoContrato,
    misDescuentos,
    aceptaExtras,
    periodoEventual,
    miLineaEventual,
    geo,
    marcajeBloqueado,
    ubicacionLibre: { estado: ubicacionLibreState.estado, reintentar: ubicacionLibreState.reintentar },
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
