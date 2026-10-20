import { showAlert } from '@/lib/alertDialog';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { Text, TextInput } from '@/components/ui/Text';
import { COLORS } from '@/lib/designTokens';
import React, { useState } from 'react';
import {
  View, ScrollView, TouchableOpacity, Linking, Platform, Switch, Modal, Pressable,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useTheme }    from '@/lib/theme';
import { confirm }     from '@/lib/confirmDialog';
import { actionSheet } from '@/lib/actionSheet';
import { showToast }   from '@/lib/toast';
import { showAnuncioTurno } from '@/lib/anuncioTurno';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { turnoYaInicio } from '@/features/turnos/turnosUtils';
import { bogotaToday } from '@/lib/formatters';
import {
  useOferta, useMisTurnos, useAplicar, useRetirar,
  useConfirmar, useRechazar, useCancelar, useNoPresentado, useDuplicarOferta,
  useCancelarOferta, useMarcarOfertaFallida, useCompletarOferta,
  useActualizarOferta, useCrearPuesto, useCargos,
} from '@/features/turnos/useTurnos';
import { parseTarifa } from '@/features/turnos/crear/utils';
import { FuncionesCargoModal } from '@/features/turnos/FuncionesCargoModal';
import { LugarInput } from '@/features/turnos/crear/LugarInput';
import { TurnosExtraOptIn, esErrorTurnosExtraApagadas } from '@/features/nomina/TurnosExtraOptIn';
import { Badge }   from '@/components/ui/Badge';
import { Button }  from '@/components/ui/Button';
import { formatTimeObj, toISODate } from '@/lib/formatters';
import type { AsignacionResumen, Cargo, EstadoAsignacion, OfertaDetalle, OfertaPuesto } from '@api-client';
import { ApiError } from '@api-client';

// ── Helpers ───────────────────────────────────────────────────────────────

const SHORT_DAYS   = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const SHORT_MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function fmtDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return `${SHORT_DAYS[d.getDay()]} ${d.getDate()} de ${SHORT_MONTHS[d.getMonth()]}`;
}
function fmtRange(start: string, end: string | null) {
  const s = start.slice(0, 5).replace(/^0/, '');
  return end ? `${s} – ${end.slice(0, 5).replace(/^0/, '')}` : s;
}

type BadgeVariant = 'warning' | 'success' | 'info' | 'default' | 'danger';
const ESTADO_CFG: Record<EstadoAsignacion, { label: string; variant: BadgeVariant }> = {
  pendiente:     { label: 'Pendiente',      variant: 'warning' },
  confirmado:    { label: 'Confirmado',     variant: 'success' },
  en_progreso:   { label: 'En progreso',    variant: 'info'    },
  completado:    { label: 'Completado',     variant: 'default' },
  no_presentado: { label: 'No se presentó', variant: 'danger'  },
  cancelado:     { label: 'Cancelado',      variant: 'danger'  },
  por_reconfirmar: { label: 'Por reconfirmar', variant: 'warning' },
  fallido:       { label: 'Turno fallido',  variant: 'warning' },
};

// ── PostulanteRow (gestores) ──────────────────────────────────────────────

function PostulanteRow({
  asignacion, ofertaId, esPasado, turnoIniciado, puedeGestionar,
  confirmarM, rechazarM, cancelarM, noPresentadoM,
}: {
  asignacion:    AsignacionResumen;
  ofertaId:      number;
  esPasado:      boolean;
  turnoIniciado: boolean;
  puedeGestionar: boolean;
  confirmarM:    ReturnType<typeof useConfirmar>;
  rechazarM:     ReturnType<typeof useRechazar>;
  cancelarM:     ReturnType<typeof useCancelar>;
  noPresentadoM: ReturnType<typeof useNoPresentado>;
}) {
  const router    = useRouter();
  // Fallback a 'pendiente' — un bundle viejo durante un rollout OTA gradual
  // puede ver un estado que todavía no conoce (ej. 'fallido' recién agregado).
  const cfg       = ESTADO_CFG[asignacion.estado] ?? ESTADO_CFG.pendiente;
  const isPending = asignacion.estado === 'pendiente';
  const isConf    = asignacion.estado === 'confirmado';
  const isEnProg  = asignacion.estado === 'en_progreso';
  const isCompletado = asignacion.estado === 'completado';
  const isPorReconfirmar = asignacion.estado === 'por_reconfirmar';
  const isBusy    = confirmarM.isPending || rechazarM.isPending || cancelarM.isPending || noPresentadoM.isPending;
  const nombre    = `${asignacion.trabajador_nombre} ${asignacion.trabajador_apellido}`;

  return (
    <View className="py-2.5 border-b border-border gap-2">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 mr-3">
          <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
            {nombre}
          </Text>
          {asignacion.cargo_nombre && (
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {asignacion.cargo_nombre}
            </Text>
          )}
        </View>
        <Badge label={cfg.label} variant={cfg.variant} size="sm" />
      </View>

      {puedeGestionar && (esPasado ? (
        (isConf || isEnProg) ? (
          <Button label={noPresentadoM.isPending ? '…' : 'No vino'} variant="danger" size="sm"
            loading={noPresentadoM.isPending} disabled={isBusy}
            onPress={async () => {
              if (await confirm({ title: 'No se presentó', message: `¿Marcar a ${nombre} como no presentado?`, confirmLabel: 'Marcar ausente', destructive: true })) {
                noPresentadoM.mutate({ asignacionId: asignacion.id, ofertaId });
              }
            }} />
        ) : isPending ? (
          <Button label={rechazarM.isPending ? '…' : 'Rechazar'} variant="danger" size="sm"
            loading={rechazarM.isPending} disabled={isBusy}
            onPress={async () => {
              if (await confirm({ title: 'Rechazar', message: `¿Rechazar a ${nombre}?`, confirmLabel: 'Rechazar', destructive: true })) {
                rechazarM.mutate({ asignacionId: asignacion.id, ofertaId });
              }
            }} />
        ) : null
      ) : (
        <>
          {isPending && (
            <View className="flex-row gap-2">
              <Button label={rechazarM.isPending ? '…' : 'Rechazar'} variant="danger" size="sm"
                loading={rechazarM.isPending} disabled={isBusy}
                onPress={async () => {
                  if (await confirm({ title: 'Rechazar', message: `¿Rechazar a ${nombre}?`, confirmLabel: 'Rechazar', destructive: true })) {
                    rechazarM.mutate({ asignacionId: asignacion.id, ofertaId });
                  }
                }} />
              <Button label={confirmarM.isPending ? '…' : 'Confirmar'} variant="success" size="sm"
                loading={confirmarM.isPending} disabled={isBusy}
                onPress={() => confirmarM.mutate({ asignacionId: asignacion.id, ofertaId })} />
            </View>
          )}
          {isConf && (
            <View className="flex-row items-center gap-2 flex-wrap">
              <View className="flex-row items-center gap-1 bg-success-light px-3 py-1.5 rounded-xl">
                <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                <Text className="text-xs font-semibold text-success">Aceptado</Text>
              </View>
              <Button label={cancelarM.isPending ? '…' : 'Cancelar'} variant="danger" size="sm"
                loading={cancelarM.isPending} disabled={isBusy}
                onPress={async () => {
                  if (await confirm({ title: 'Cancelar turno', message: `¿Cancelar el turno de ${nombre}?`, cancelLabel: 'Volver', confirmLabel: 'Cancelar turno', destructive: true })) {
                    cancelarM.mutate(
                      { asignacionId: asignacion.id, ofertaId },
                      { onSuccess: () => showAnuncioTurno(`Turno de ${nombre} cancelado.`, 'cancelado') }
                    );
                  }
                }} />
              {turnoIniciado && (
                <Button label={noPresentadoM.isPending ? '…' : 'No vino'} variant="danger" size="sm"
                  loading={noPresentadoM.isPending} disabled={isBusy}
                  onPress={async () => {
                    if (await confirm({ title: 'No se presentó', message: `¿Marcar a ${nombre} como no presentado?`, confirmLabel: 'Marcar ausente', destructive: true })) {
                      noPresentadoM.mutate({ asignacionId: asignacion.id, ofertaId });
                    }
                  }} />
              )}
            </View>
          )}
          {isEnProg && (
            <View className="flex-row items-center gap-1 bg-info/10 px-3 py-1.5 rounded-xl self-start">
              <Ionicons name="time-outline" size={14} color={COLORS.info} />
              <Text className="text-xs font-semibold text-info">En turno</Text>
            </View>
          )}
          {isPorReconfirmar && (
            <View className="flex-row items-center gap-1 bg-warning-light px-3 py-1.5 rounded-xl self-start">
              <Ionicons name="alert-circle-outline" size={14} color={COLORS.warningText} />
              <Text className="text-xs font-semibold text-warning">Esperando que reconfirme</Text>
            </View>
          )}
        </>
      ))}

      {/* Ver detalle del turno — ahí se corrige ingreso/egreso y se agrega el
          bono, disponible incluso con esPasado (arreglar una salida que el
          trabajador olvidó marcar). */}
      {(isConf || isEnProg || isCompletado || isPorReconfirmar) && (
        <TouchableOpacity
          onPress={() => router.push(`/turno/${asignacion.id}`)}
          className="flex-row items-center gap-1 self-start"
          hitSlop={6}
        >
          <Ionicons name="chevron-forward-circle-outline" size={13} color={COLORS.mutedForeground} />
          <Text className="text-xs font-semibold text-muted-foreground">Ver detalle</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────

export default function OfertaDetailScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id     = idParam ? Number(idParam) : null;
  const router = useRouter();
  const theme  = useTheme();
  const rol   = useAuthStore((s) => s.usuario?.rol);

  const isGestor = rol === 'admin_empresa' || rol === 'jefe_turnos' || rol === 'jefe_nomina';
  const isWorker = rol === 'trabajador_turnos' || rol === 'trabajador_nomina';
  // jefe_nomina ve la oferta y sus postulantes, pero no la gestiona.
  const puedeGestionar = rol === 'admin_empresa' || rol === 'jefe_turnos';
  // Backend restringe cancelar oferta a admin_empresa/jefe_turnos (no jefe_nomina).
  const puedeCancelarOferta = rol === 'admin_empresa' || rol === 'jefe_turnos';

  const { data: oferta, isLoading, error } = useOferta(id);
  const { data: misTurnos }         = useMisTurnos({ enabled: isWorker });
  const esPasado      = oferta ? oferta.fecha < bogotaToday() : false;
  const turnoIniciado = oferta ? turnoYaInicio(oferta.fecha, oferta.hora_inicio) : false;
  // esPasado solo compara el día — un turno de hoy con hora de inicio ya
  // pasada seguía aceptando postulaciones. El backend valida lo mismo en
  // OfertasService.aplicar().
  const yaNoSePuedePostular = esPasado || turnoIniciado;

  const aplicarM       = useAplicar();
  const retirarM       = useRetirar();
  const confirmarM     = useConfirmar();
  const rechazarM      = useRechazar();
  const cancelarM      = useCancelar();
  const noPresentadoM  = useNoPresentado();
  const cancelarOfertaM = useCancelarOferta();
  const marcarFallidaM = useMarcarOfertaFallida();
  const completarOfertaM = useCompletarOferta();
  const actualizarOfertaM = useActualizarOferta();
  // El backend solo permite editar mientras la oferta sigue 'abierta' o 'borrador'.
  const ofertaEsEditable = oferta?.estado === 'abierta' || oferta?.estado === 'borrador';

  const [showDuplicarModal, setShowDuplicarModal] = useState(false);
  const [showEditarOfertaModal, setShowEditarOfertaModal] = useState(false);
  const [showFallidoModal, setShowFallidoModal] = useState(false);

  const miAsignacion = isWorker
    ? (misTurnos ?? []).find((a) => a.oferta_id === id)
    : undefined;
  const yaAplicado = !!miAsignacion;
  // Mientras sigue 'pendiente', el puesto puede llenarse con otros postulantes
  // antes de que el gestor te confirme — igual se mantiene tu postulación por
  // si alguien cancela o el gestor amplía las plazas.
  const miPuesto = oferta?.puestos.find((p) => p.id === miAsignacion?.puesto_id);
  const miCupoLleno = !!miPuesto && miPuesto.plazas_cubiertas >= miPuesto.plazas;

  async function handleRetirar() {
    if (!miAsignacion?.puesto_id || !id) return;
    const ok = await confirm({
      title: 'Retirar postulación',
      message: '¿Retirar tu postulación a este turno?',
      cancelLabel: 'Volver',
      confirmLabel: 'Retirar',
      destructive: true,
    });
    if (!ok) return;
    try {
      await retirarM.mutateAsync({ ofertaId: id, puestoId: miAsignacion.puesto_id });
    } catch (err) {
      showAlert('Error', err instanceof ApiError ? err.message : 'No se pudo retirar la postulación.');
    }
  }

  const availablePuestos = oferta?.puestos.filter((p) => p.plazas_cubiertas < p.plazas) ?? [];
  const [selectedPuestoId, setSelectedPuestoId] = useState<number | null>(null);
  const selectedPuesto = availablePuestos.find((p) => p.id === selectedPuestoId) ?? availablePuestos[0];
  const [funcionesPuesto, setFuncionesPuesto] = useState<OfertaPuesto | null>(null);

  const hasCoords = oferta?.latitud != null && oferta?.longitud != null;

  function openInMaps() {
    if (!hasCoords) return;
    const lat   = oferta!.latitud!;
    const lng   = oferta!.longitud!;
    const label = encodeURIComponent(oferta?.lugar ?? 'Turno');
    const url = Platform.select({
      ios:     `maps://app?q=${label}&ll=${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
    }) ?? `https://maps.google.com/?q=${lat},${lng}`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`)
    );
  }

  async function handleToggleUbicacionLibre(value: boolean) {
    if (!oferta) return;
    try {
      await actualizarOfertaM.mutateAsync({ id: oferta.id, ubicacion_libre: value });
      showToast(value ? 'Turno marcado con ubicación libre.' : 'Ubicación libre desactivada.');
    } catch (err) {
      showAlert('Error', err instanceof ApiError ? err.message : 'No se pudo actualizar el turno.');
    }
  }

  async function handleAplicar() {
    if (!selectedPuesto) return;
    try {
      const result = await aplicarM.mutateAsync({ ofertaId: id!, puestoId: selectedPuesto.id });

      // Mostrar warning si el turno ya comenzó
      if (result.warnings && result.warnings.length > 0) {
        showToast(result.warnings[0]);
      }

      showToast(`Has solicitado el turno como ${selectedPuesto.cargo_nombre}. El gestor revisará tu solicitud.`);
    } catch (err) {
      showAlert('Error', err instanceof ApiError ? err.message : 'No se pudo aplicar.');
    }
  }

  async function ejecutarCompletar(capearHoras: boolean) {
    if (!oferta) return;
    try {
      const data = await completarOfertaM.mutateAsync({ ofertaId: oferta.id, capearHoras });
      const n = data.no_presentados_al_completar ?? 0;
      const f = data.forzados_al_completar ?? 0;
      const avisos: string[] = [];
      if (f > 0) {
        const horario = data.forzados_con_hora_actual ? 'con la hora actual' : 'con el horario estipulado';
        avisos.push(`${f} trabajador${f > 1 ? 'es' : ''} que no había${f > 1 ? 'n' : ''} marcado salida se cerró${f > 1 ? 'aron' : ''} ${horario}`);
      }
      if (n > 0) avisos.push(`${n} trabajador${n > 1 ? 'es' : ''} sin ingreso quedó${n > 1 ? 'aron' : ''} como no presentado${n > 1 ? 's' : ''}`);
      showToast(
        avisos.length > 0
          ? `"${oferta.titulo}" completado. ${avisos.join('; ')}.`
          : `"${oferta.titulo}" marcado como completado.`
      );
    } catch (err) {
      showAlert('Error', err instanceof ApiError ? err.message : 'No se pudo completar la oferta.');
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <Stack.Screen options={{ title: 'Detalle del turno', headerShown: true }} />
        <SkeletonDetail style={{ paddingHorizontal: 16, paddingTop: 12 }} />
      </SafeAreaView>
    );
  }

  if (!oferta) {
    const apiErr = error instanceof ApiError ? error : null;
    const esExtrasApagadas = esErrorTurnosExtraApagadas(error);
    const esDelayRanking   = apiErr?.status === 403 && apiErr.message.includes('ranking');
    const esNoEncontrada   = apiErr?.status === 404;

    return (
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <Stack.Screen options={{ title: 'Detalle del turno', headerShown: true }} />
        {esExtrasApagadas ? (
          <TurnosExtraOptIn />
        ) : (
          <View className="flex-1 items-center justify-center gap-4 px-6">
            <Ionicons name="search-outline" size={48} color={COLORS.placeholder} />
            <Text className="text-base font-semibold text-foreground text-center">
              {esDelayRanking
                ? 'Este turno aún no está disponible para tu nivel de calificación'
                : esNoEncontrada
                  ? 'Este turno ya no está disponible'
                  : 'Turno no encontrado'}
            </Text>
          </View>
        )}
      </SafeAreaView>
    );
  }

  const totalPlazas    = oferta.puestos.reduce((s, p) => s + p.plazas, 0);
  const plazasCubiertas = oferta.puestos.reduce((s, p) => s + p.plazas_cubiertas, 0);

  // Condiciones de la barra de acciones fija (gestor) — mismas reglas de antes,
  // solo que ahora deciden si esa barra se muestra en vez de un botón inline.
  const mostrarCompletar = puedeGestionar && turnoIniciado
    && oferta.estado !== 'completada' && oferta.estado !== 'cancelada' && oferta.estado !== 'borrador';
  const mostrarCancelarOferta = puedeCancelarOferta
    && oferta.estado !== 'cancelada' && oferta.estado !== 'completada';
  const hayEnProgreso = oferta.asignaciones.some((a) => a.estado === 'en_progreso');
  // Turno fallido solo tiene sentido si hay alguien ya marcó ingreso para
  // compensar — sin eso es exactamente "Cancelar oferta".
  const mostrarTurnoFallido = mostrarCancelarOferta && hayEnProgreso;

  return (
    <>
      <Stack.Screen
        options={{
          title: oferta.titulo,
          headerShown: true,
          headerRight: puedeGestionar ? () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              {ofertaEsEditable && (
                <TouchableOpacity
                  onPress={() => setShowEditarOfertaModal(true)}
                  hitSlop={10}
                  accessibilityLabel="Editar turno"
                >
                  <Ionicons name="create-outline" size={22} color={COLORS.primary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setShowDuplicarModal(true)}
                hitSlop={10}
                accessibilityLabel="Duplicar oferta"
                style={{ marginRight: 4 }}
              >
                <Ionicons name="copy-outline" size={22} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          ) : undefined,
        }}
      />

      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <ScrollView className="flex-1" contentContainerClassName="px-5 py-5 gap-4 pb-12" showsVerticalScrollIndicator={false}>

          {/* ── Info principal ──────────────────────────────────── */}
          <View className="bg-card rounded-3xl overflow-hidden"
            style={{ elevation: 3, shadowColor: COLORS.shadow, shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
            <View className="h-2" style={{ backgroundColor: esPasado ? COLORS.borderStrong : COLORS.primary400 }} />
            <View className="px-5 py-5 gap-3">
              <View className="flex-row items-start justify-between gap-2">
                <Text className="text-xl font-bold text-foreground flex-1 pr-2" numberOfLines={2}>
                  {oferta.titulo}
                </Text>
                <View className="px-2.5 py-1 rounded-full bg-muted">
                  <Text className="text-xs font-semibold text-muted-foreground">
                    {plazasCubiertas}/{totalPlazas} plazas
                  </Text>
                </View>
              </View>

              {/* Fecha */}
              <View className="flex-row items-center gap-3">
                <View className="w-8 h-8 bg-muted rounded-xl items-center justify-center">
                  <Ionicons name="calendar-outline" size={16} color={COLORS.mutedForeground} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-muted-foreground">Fecha</Text>
                  <Text className="text-sm font-medium text-foreground">{fmtDate(oferta.fecha)}</Text>
                </View>
              </View>

              {/* Horario */}
              <View className="flex-row items-center gap-3">
                <View className="w-8 h-8 bg-muted rounded-xl items-center justify-center">
                  <Ionicons name="time-outline" size={16} color={COLORS.mutedForeground} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-muted-foreground">Horario</Text>
                  <Text className="text-sm font-medium text-foreground">
                    {fmtRange(oferta.hora_inicio, oferta.hora_fin_estimada)}
                  </Text>
                </View>
              </View>

              {/* Lugar */}
              {oferta.lugar && (
                <View className="flex-row items-center gap-3">
                  <View className="w-8 h-8 bg-muted rounded-xl items-center justify-center">
                    <Ionicons name="location-outline" size={16} color={COLORS.mutedForeground} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-muted-foreground">Lugar</Text>
                    <Text className="text-sm font-medium text-foreground">{oferta.lugar}</Text>
                  </View>
                  {hasCoords && (
                    <TouchableOpacity onPress={openInMaps}
                      className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted"
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="map-outline" size={14} color={COLORS.info} />
                      <Text className="text-xs font-semibold text-info">Mapa</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Ubicación libre: gestor puede editarla mientras la oferta siga
                  abierta/borrador; el resto solo ve el aviso si está activa. */}
              {puedeGestionar && ofertaEsEditable ? (
                <View className="flex-row items-center gap-3">
                  <View className="w-8 h-8 bg-muted rounded-xl items-center justify-center">
                    <Ionicons name="navigate-circle-outline" size={16} color={COLORS.mutedForeground} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-medium text-foreground">Ubicación libre</Text>
                    <Text className="text-xs text-muted-foreground">
                      Sin restricción al marcar ingreso/egreso
                    </Text>
                  </View>
                  <Switch
                    value={oferta.ubicacion_libre === 1}
                    onValueChange={handleToggleUbicacionLibre}
                    disabled={actualizarOfertaM.isPending}
                    trackColor={{ true: theme.primary }}
                    thumbColor={COLORS.white}
                  />
                </View>
              ) : oferta.ubicacion_libre === 1 ? (
                <View className="flex-row items-center gap-3">
                  <View className="w-8 h-8 bg-muted rounded-xl items-center justify-center">
                    <Ionicons name="navigate-circle-outline" size={16} color={COLORS.mutedForeground} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-muted-foreground">Ubicación</Text>
                    <Text className="text-sm font-medium text-foreground">Libre — sin restricción geográfica</Text>
                  </View>
                </View>
              ) : null}
            </View>
          </View>

          {/* ── Falta marcar completada: el turno ya terminó, todos resueltos, nadie le dio Completar ── */}
          {puedeGestionar && oferta.necesita_completar && (
            <View className="bg-warning-light rounded-2xl px-4 py-3 flex-row items-center gap-3">
              <Ionicons name="warning-outline" size={20} color={COLORS.warningText} />
              <Text className="flex-1 text-sm font-medium text-warning">
                Este turno ya terminó y todos quedaron resueltos, pero nadie lo marcó como completado.
              </Text>
            </View>
          )}

          {/* ── Descripción ─────────────────────────────────────── */}
          {oferta.descripcion && (
            <View className="bg-card rounded-2xl px-5 py-4 gap-2"
              style={{ elevation: 1, shadowColor: COLORS.shadow, shadowOpacity: 0.04, shadowRadius: 8 }}>
              <View className="flex-row items-center gap-2">
                <Ionicons name="document-text-outline" size={14} color={COLORS.mutedForeground} />
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Descripción
                </Text>
              </View>
              <Text className="text-sm text-foreground leading-5">{oferta.descripcion}</Text>
            </View>
          )}

          {/* ── Detalles adicionales — visible para todos, nunca sale en el contrato ── */}
          {oferta.notas_adicionales && (
            <View className="bg-card rounded-2xl px-5 py-4 gap-2"
              style={{ elevation: 1, shadowColor: COLORS.shadow, shadowOpacity: 0.04, shadowRadius: 8 }}>
              <View className="flex-row items-center gap-2">
                <Ionicons name="information-circle-outline" size={14} color={COLORS.mutedForeground} />
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Detalles adicionales
                </Text>
              </View>
              <Text className="text-sm text-foreground leading-5">{oferta.notas_adicionales}</Text>
            </View>
          )}

          {/* ── Puestos / cargos ─────────────────────────────────── */}
          <View className="bg-card rounded-2xl px-5 py-4 gap-3"
            style={{ elevation: 1, shadowColor: COLORS.shadow, shadowOpacity: 0.04, shadowRadius: 8 }}>
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {isWorker && !yaAplicado && !yaNoSePuedePostular && availablePuestos.length > 1
                ? '¿A qué cargo quieres aplicar?'
                : 'Cargos y tarifas'}
            </Text>
            {oferta.puestos.map((p) => {
              const seleccionable = isWorker && !yaAplicado && !yaNoSePuedePostular
                && availablePuestos.length > 1 && p.plazas_cubiertas < p.plazas;
              const seleccionado = seleccionable && p.id === selectedPuesto?.id;
              const Row = (
                <View className={`flex-row items-center justify-between py-2 border-b border-border last:border-0 ${seleccionable ? 'px-3 rounded-xl border' : ''} ${seleccionado ? 'bg-primary/10 border-primary' : seleccionable ? 'border-border' : ''}`}>
                  <View className="flex-1 gap-0.5 flex-row items-center gap-2">
                    {seleccionable && (
                      <Ionicons
                        name={seleccionado ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={seleccionado ? COLORS.primary400 : COLORS.placeholder}
                      />
                    )}
                    <View className="flex-1 gap-0.5">
                      <Text className="text-sm font-semibold text-foreground">{p.cargo_nombre}</Text>
                      {p.notas && (
                        <Text className="text-xs text-muted-foreground">{p.notas}</Text>
                      )}
                      {isWorker && (
                        <TouchableOpacity onPress={() => setFuncionesPuesto(p)} hitSlop={6} className="flex-row items-center gap-1 mt-0.5">
                          <Ionicons name="list-outline" size={12} color={COLORS.info} />
                          <Text className="text-xs text-info font-medium">Ver funciones</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  <View className="items-end gap-0.5">
                    <Text className="text-sm font-bold text-success">
                      ${p.tarifa_dia.toLocaleString('es-CO')}
                    </Text>
                    <Text className="text-xs text-muted-foreground">
                      {p.plazas_cubiertas}/{p.plazas} plazas
                    </Text>
                  </View>
                </View>
              );
              return seleccionable ? (
                <TouchableOpacity key={p.id} onPress={() => setSelectedPuestoId(p.id)}>
                  {Row}
                </TouchableOpacity>
              ) : (
                <View key={p.id}>{Row}</View>
              );
            })}
          </View>

          {/* ── CTA trabajador: Aplicar ──────────────────────────── */}
          {isWorker && (
            <View>
              {esPasado ? (
                <View className="bg-muted rounded-2xl px-5 py-4 flex-row items-center gap-3">
                  <Ionicons name="time-outline" size={20} color={COLORS.placeholder} />
                  <Text className="text-sm text-muted-foreground">Evento finalizado</Text>
                </View>
              ) : yaAplicado ? (
                <View className="gap-3">
                  {miAsignacion?.estado === 'pendiente' && miCupoLleno ? (
                    <View className="bg-warning-light rounded-2xl px-5 py-4 flex-row items-center gap-3">
                      <Ionicons name="alert-circle-outline" size={22} color={COLORS.warningDark} />
                      <Text className="text-sm font-semibold text-amber-700 flex-1">
                        Cupo lleno — tu postulación se mantiene. Te avisaremos si se libera un cupo o se amplía la oferta.
                      </Text>
                    </View>
                  ) : (
                    <View className="bg-info/10 rounded-2xl px-5 py-4 flex-row items-center gap-3">
                      <Ionicons name="checkmark-circle-outline" size={22} color={COLORS.info} />
                      <Text className="text-sm font-semibold text-info">
                        {miAsignacion?.estado === 'pendiente' ? 'Ya estás postulado a este turno' : 'Ya estás confirmado en este turno'}
                      </Text>
                    </View>
                  )}
                  {miAsignacion?.estado === 'pendiente' && (
                    <Button
                      label={retirarM.isPending ? 'Retirando…' : 'Retirar postulación'}
                      variant="danger"
                      fullWidth
                      loading={retirarM.isPending}
                      onPress={handleRetirar}
                    />
                  )}
                </View>
              ) : turnoIniciado ? (
                <View className="bg-muted rounded-2xl px-5 py-4 flex-row items-center gap-3">
                  <Ionicons name="time-outline" size={20} color={COLORS.placeholder} />
                  <Text className="text-sm text-muted-foreground">El turno ya empezó — ya no se puede postular</Text>
                </View>
              ) : selectedPuesto ? (
                <Button
                  label={aplicarM.isPending ? 'Enviando postulación…' : `Aplicar como ${selectedPuesto.cargo_nombre}`}
                  variant="primary"
                  fullWidth
                  loading={aplicarM.isPending}
                  onPress={handleAplicar}
                />
              ) : (
                <View className="bg-muted rounded-2xl px-5 py-4 items-center">
                  <Text className="text-sm text-muted-foreground">No hay plazas disponibles</Text>
                </View>
              )}
            </View>
          )}

          {/* ── Postulantes (gestores) ───────────────────────────── */}
          {isGestor && (
            <View className="bg-card rounded-2xl px-5 py-4"
              style={{ elevation: 1, shadowColor: COLORS.shadow, shadowOpacity: 0.04, shadowRadius: 8 }}>
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                {esPasado ? 'Historial de asistencia' : 'Postulantes'}
              </Text>
              {!oferta.asignaciones?.length ? (
                <Text className="text-sm text-muted-foreground py-2">Sin postulantes.</Text>
              ) : (
                oferta.asignaciones.map((a) => (
                  <PostulanteRow
                    key={a.id}
                    asignacion={a}
                    ofertaId={oferta.id}
                    esPasado={esPasado}
                    turnoIniciado={turnoIniciado}
                    puedeGestionar={puedeGestionar}
                    confirmarM={confirmarM}
                    rechazarM={rechazarM}
                    cancelarM={cancelarM}
                    noPresentadoM={noPresentadoM}
                  />
                ))
              )}
            </View>
          )}

        </ScrollView>

        {/* ── Barra de acciones fija (gestor) — siempre en la zona inferior, separada
            del contenido scrolleable para que no se pierda entre el resto de cards. */}
        {(mostrarCompletar || mostrarCancelarOferta || mostrarTurnoFallido) && (
          <View className="px-5 pt-3 pb-3 gap-2 border-t border-border bg-background">
            {mostrarCompletar && (
              <Button
                label={completarOfertaM.isPending ? 'Marcando…' : 'Marcar completada'}
                variant="successOutline"
                fullWidth
                loading={completarOfertaM.isPending}
                onPress={async () => {
                  const hayEnProgreso = oferta.asignaciones.some((a) => a.estado === 'en_progreso');

                  if (hayEnProgreso) {
                    const eleccion = await actionSheet({
                      title: 'Hay trabajadores sin marcar salida',
                      message: 'Si el turno ya lleva más de 2 días sin resolver, esto los cerrará automáticamente. ¿Cómo calculamos sus horas?',
                      items: [
                        { key: 'estipulado', label: 'Horario estipulado' },
                        { key: 'ahora', label: 'Cerrar ahora' },
                      ],
                    });
                    if (eleccion) ejecutarCompletar(eleccion === 'estipulado');
                    return;
                  }

                  const ok = await confirm({
                    title: 'Marcar como completada',
                    message: 'Úsalo cuando el turno ya terminó en la realidad.',
                    cancelLabel: 'Volver',
                    confirmLabel: 'Marcar completada',
                  });
                  if (ok) ejecutarCompletar(true);
                }}
              />
            )}

            {mostrarCancelarOferta && (
              <Button
                label={cancelarOfertaM.isPending ? 'Cancelando…' : 'Cancelar oferta'}
                variant="danger"
                fullWidth
                loading={cancelarOfertaM.isPending}
                onPress={async () => {
                  const ok = await confirm({
                    title: 'Cancelar oferta',
                    message: `Se cancelará "${oferta.titulo}" y se notificará a los trabajadores postulados o asignados. Esta acción no se puede deshacer.`,
                    cancelLabel: 'Volver',
                    confirmLabel: 'Cancelar oferta',
                    destructive: true,
                  });
                  if (!ok) return;
                  try {
                    await cancelarOfertaM.mutateAsync(oferta.id);
                    showAnuncioTurno(`"${oferta.titulo}" cancelado.`, 'cancelado');
                    router.back();
                  } catch (err) {
                    showAlert('Error', err instanceof ApiError ? err.message : 'No se pudo cancelar la oferta.');
                  }
                }}
              />
            )}

            {mostrarTurnoFallido && (
              <Button
                label="Turno fallido (fuerza mayor)"
                variant="secondary"
                fullWidth
                onPress={() => setShowFallidoModal(true)}
              />
            )}
          </View>
        )}
      </SafeAreaView>

      <FuncionesCargoModal
        visible={!!funcionesPuesto}
        onClose={() => setFuncionesPuesto(null)}
        cargoId={funcionesPuesto?.cargo_id ?? null}
        cargoNombre={funcionesPuesto?.cargo_nombre ?? ''}
      />

      <DuplicarOfertaModal
        visible={showDuplicarModal}
        oferta={oferta}
        onClose={() => setShowDuplicarModal(false)}
      />

      <EditarOfertaModal
        visible={showEditarOfertaModal}
        oferta={oferta}
        onClose={() => setShowEditarOfertaModal(false)}
      />

      <TurnoFallidoModal
        visible={showFallidoModal}
        oferta={oferta}
        marcarFallidaM={marcarFallidaM}
        onClose={() => setShowFallidoModal(false)}
        onDone={() => {
          setShowFallidoModal(false);
          showAnuncioTurno(`"${oferta.titulo}" marcado como fallido.`, 'cancelado');
          router.back();
        }}
      />
    </>
  );
}

// ── Duplicar oferta (gestores) ──────────────────────────────────────────────

function DuplicarOfertaModal({
  visible,
  oferta,
  onClose,
}: {
  visible: boolean;
  oferta: { id: number; hora_inicio: string };
  onClose: () => void;
}) {
  const duplicarM = useDuplicarOferta();
  const [fecha, setFecha] = useState(new Date());
  const [hora, setHora]   = useState(new Date());
  const [showFecha, setShowFecha] = useState(false);
  const [showHora, setShowHora]   = useState(false);

  React.useEffect(() => {
    if (!visible) return;
    setFecha(new Date());
    const [h, m] = oferta.hora_inicio.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    setHora(d);
    setShowFecha(false);
    setShowHora(false);
  }, [visible, oferta.hora_inicio]);

  function onChangeFecha(_: DateTimePickerEvent, d?: Date) {
    if (Platform.OS === 'android') setShowFecha(false);
    if (d) setFecha(d);
  }
  function onChangeHora(_: DateTimePickerEvent, d?: Date) {
    if (Platform.OS === 'android') setShowHora(false);
    if (d) setHora(d);
  }

  async function handleDuplicar() {
    try {
      const nueva = await duplicarM.mutateAsync({
        ofertaId: oferta.id,
        fecha: toISODate(fecha),
        hora_inicio: `${formatTimeObj(hora)}:00`,
      });
      onClose();
      showToast(`"${nueva.titulo}" creada para el ${fmtDate(toISODate(fecha))}.`);
    } catch {
      showAlert('Error', 'No se pudo duplicar la oferta.');
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          className="bg-background rounded-t-3xl"
          contentContainerClassName="px-6 pt-5 pb-10 gap-5"
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold text-foreground">Duplicar oferta</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={COLORS.mutedForeground} />
            </Pressable>
          </View>

          <View className="gap-1.5">
            <Text className="text-sm font-semibold text-foreground">Fecha</Text>
            <TouchableOpacity
              onPress={() => setShowFecha(true)}
              className="bg-card border border-border rounded-xl px-4 py-3 flex-row items-center gap-2"
            >
              <Ionicons name="calendar-outline" size={16} color={COLORS.mutedForeground} />
              <Text className="text-sm text-foreground">{fmtDate(toISODate(fecha))}</Text>
            </TouchableOpacity>
            {showFecha && (
              <DateTimePicker
                value={fecha}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                minimumDate={new Date()}
                onChange={onChangeFecha}
              />
            )}
            {showFecha && Platform.OS === 'ios' && (
              <TouchableOpacity onPress={() => setShowFecha(false)} className="bg-primary/10 rounded-xl py-2 items-center">
                <Text className="text-sm font-semibold text-primary">Listo</Text>
              </TouchableOpacity>
            )}
          </View>

          <View className="gap-1.5">
            <Text className="text-sm font-semibold text-foreground">Hora de inicio</Text>
            <TouchableOpacity
              onPress={() => setShowHora(true)}
              className="bg-card border border-border rounded-xl px-4 py-3 flex-row items-center gap-2"
            >
              <Ionicons name="time-outline" size={16} color={COLORS.mutedForeground} />
              <Text className="text-sm text-foreground">{formatTimeObj(hora)}</Text>
            </TouchableOpacity>
            {showHora && (
              <DateTimePicker
                value={hora}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onChangeHora}
              />
            )}
            {showHora && Platform.OS === 'ios' && (
              <TouchableOpacity onPress={() => setShowHora(false)} className="bg-primary/10 rounded-xl py-2 items-center">
                <Text className="text-sm font-semibold text-primary">Listo</Text>
              </TouchableOpacity>
            )}
          </View>

          <Button
            label={duplicarM.isPending ? 'Duplicando…' : 'Duplicar'}
            variant="primary"
            fullWidth
            loading={duplicarM.isPending}
            onPress={handleDuplicar}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Editar oferta (gestores) — título/descripción/fecha/hora/lugar. Si cambian
// fecha/hora/lugar, el backend pasa a los confirmados a 'por_reconfirmar'. ──

type OfertaEditable = {
  id: number; titulo: string; descripcion: string | null;
  fecha: string; hora_inicio: string; hora_fin_estimada: string | null;
  lugar: string | null; latitud: number | null; longitud: number | null;
  puestos: OfertaPuesto[];
};

function EditarOfertaModal({
  visible,
  oferta,
  onClose,
}: {
  visible: boolean;
  oferta: OfertaEditable;
  onClose: () => void;
}) {
  const actualizarM = useActualizarOferta();
  const [titulo, setTitulo] = useState(oferta.titulo);
  const [descripcion, setDescripcion] = useState(oferta.descripcion ?? '');
  const [fecha, setFecha] = useState(new Date());
  const [horaInicio, setHoraInicio] = useState(new Date());
  const [horaFin, setHoraFin] = useState<Date | null>(null);
  const [lugar, setLugar] = useState(oferta.lugar ?? '');
  // mysql2 devuelve DECIMAL como string: se convierte para que LugarInput pueda usar toFixed.
  const [latitud, setLatitud] = useState<number | null>(oferta.latitud == null ? null : Number(oferta.latitud));
  const [longitud, setLongitud] = useState<number | null>(oferta.longitud == null ? null : Number(oferta.longitud));
  const [showFecha, setShowFecha] = useState(false);
  const [showHoraInicio, setShowHoraInicio] = useState(false);
  const [showHoraFin, setShowHoraFin] = useState(false);
  const [agregandoVacante, setAgregandoVacante] = useState(false);
  const [vacante, setVacante] = useState<{ cargo: Cargo | null; plazas: number; tarifa: string }>({ cargo: null, plazas: 1, tarifa: '' });
  const crearPuestoM = useCrearPuesto();
  const { data: cargos = [] } = useCargos(agregandoVacante);
  const usedIds = new Set(oferta.puestos.map(p => p.cargo_id));

  // Solo al abrir: un refetch de la oferta (p. ej. tras agregar una vacante) no debe pisar lo que el gestor ya escribió.
  React.useEffect(() => {
    if (!visible) return;
    setTitulo(oferta.titulo);
    setDescripcion(oferta.descripcion ?? '');
    const [ay, am, ad] = oferta.fecha.split('-').map(Number);
    setFecha(new Date(ay, am - 1, ad));
    const [hi, mi] = oferta.hora_inicio.split(':').map(Number);
    const dInicio = new Date();
    dInicio.setHours(hi, mi, 0, 0);
    setHoraInicio(dInicio);
    if (oferta.hora_fin_estimada) {
      const [hf, mf] = oferta.hora_fin_estimada.split(':').map(Number);
      const dFin = new Date();
      dFin.setHours(hf, mf, 0, 0);
      setHoraFin(dFin);
    } else {
      setHoraFin(null);
    }
    setLugar(oferta.lugar ?? '');
    setLatitud(oferta.latitud == null ? null : Number(oferta.latitud));
    setLongitud(oferta.longitud == null ? null : Number(oferta.longitud));
    setShowFecha(false);
    setShowHoraInicio(false);
    setShowHoraFin(false);
    setAgregandoVacante(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const cambianCriticos = toISODate(fecha) !== oferta.fecha
    || `${formatTimeObj(horaInicio)}:00` !== oferta.hora_inicio.slice(0, 5) + ':00'
    || (horaFin ? `${formatTimeObj(horaFin)}:00` : null) !== oferta.hora_fin_estimada
    || lugar !== (oferta.lugar ?? '');

  async function handleAgregarVacante() {
    if (!vacante.cargo) { showAlert('Datos incompletos', 'Elige un rol para la vacante.', 'warning'); return; }
    const tarifa = parseTarifa(vacante.tarifa);
    if (tarifa <= 0) { showAlert('Datos incompletos', 'Ingresa la tarifa por turno.', 'warning'); return; }
    try {
      await crearPuestoM.mutateAsync({ ofertaId: oferta.id, cargo_id: vacante.cargo.id, plazas: vacante.plazas, tarifa_dia: tarifa });
      setAgregandoVacante(false);
      setVacante({ cargo: null, plazas: 1, tarifa: '' });
      showToast('Vacante agregada.');
    } catch (err) {
      showAlert('Error', err instanceof ApiError ? err.message : 'No se pudo agregar la vacante.');
    }
  }

  async function handleGuardar() {
    if (horaFin && formatTimeObj(horaFin) <= formatTimeObj(horaInicio)) {
      showAlert('Error', 'La hora de fin debe ser posterior a la hora de inicio');
      return;
    }
    try {
      await actualizarM.mutateAsync({
        id: oferta.id,
        titulo,
        // Tal cual (no `|| undefined`): así vaciar el campo sí lo borra.
        // `undefined` significa "no tocar" para el backend — con eso, borrar
        // la descripción o el lugar nunca se guardaba.
        descripcion,
        fecha: toISODate(fecha),
        hora_inicio: `${formatTimeObj(horaInicio)}:00`,
        hora_fin_estimada: horaFin ? `${formatTimeObj(horaFin)}:00` : undefined,
        lugar,
        latitud: latitud ?? undefined,
        longitud: longitud ?? undefined,
      });
      onClose();
      showToast('Turno actualizado.');
    } catch (err) {
      showAlert('Error', err instanceof ApiError ? err.message : 'No se pudo actualizar el turno.');
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          className="bg-background rounded-t-3xl"
          contentContainerClassName="px-6 pt-5 pb-10 gap-5"
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold text-foreground">Editar turno</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={COLORS.mutedForeground} />
            </Pressable>
          </View>

          <View className="gap-1.5">
            <Text className="text-sm font-semibold text-foreground">Título</Text>
            <TextInput
              value={titulo}
              onChangeText={setTitulo}
              className="bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground"
            />
          </View>

          <View className="gap-1.5">
            <Text className="text-sm font-semibold text-foreground">Fecha</Text>
            <TouchableOpacity
              onPress={() => setShowFecha(true)}
              className="bg-card border border-border rounded-xl px-4 py-3 flex-row items-center gap-2"
            >
              <Ionicons name="calendar-outline" size={16} color={COLORS.mutedForeground} />
              <Text className="text-sm text-foreground">{fmtDate(toISODate(fecha))}</Text>
            </TouchableOpacity>
            {showFecha && (
              <DateTimePicker
                value={fecha}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                minimumDate={new Date()}
                onChange={(_: DateTimePickerEvent, d?: Date) => {
                  if (Platform.OS === 'android') setShowFecha(false);
                  if (d) setFecha(d);
                }}
              />
            )}
            {showFecha && Platform.OS === 'ios' && (
              <TouchableOpacity onPress={() => setShowFecha(false)} className="bg-primary/10 rounded-xl py-2 items-center">
                <Text className="text-sm font-semibold text-primary">Listo</Text>
              </TouchableOpacity>
            )}
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1 gap-1.5">
              <Text className="text-sm font-semibold text-foreground">Hora inicio</Text>
              <TouchableOpacity
                onPress={() => setShowHoraInicio(true)}
                className="bg-card border border-border rounded-xl px-4 py-3 flex-row items-center gap-2"
              >
                <Ionicons name="time-outline" size={16} color={COLORS.mutedForeground} />
                <Text className="text-sm text-foreground">{formatTimeObj(horaInicio)}</Text>
              </TouchableOpacity>
              {showHoraInicio && (
                <DateTimePicker
                  value={horaInicio}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_: DateTimePickerEvent, d?: Date) => {
                    if (Platform.OS === 'android') setShowHoraInicio(false);
                    if (d) setHoraInicio(d);
                  }}
                />
              )}
              {showHoraInicio && Platform.OS === 'ios' && (
                <TouchableOpacity onPress={() => setShowHoraInicio(false)} className="bg-primary/10 rounded-xl py-2 items-center">
                  <Text className="text-sm font-semibold text-primary">Listo</Text>
                </TouchableOpacity>
              )}
            </View>

            <View className="flex-1 gap-1.5">
              <Text className="text-sm font-semibold text-foreground">Hora fin</Text>
              <TouchableOpacity
                onPress={() => setShowHoraFin(true)}
                className="bg-card border border-border rounded-xl px-4 py-3 flex-row items-center gap-2"
              >
                <Ionicons name="time-outline" size={16} color={COLORS.mutedForeground} />
                <Text className="text-sm text-foreground">{horaFin ? formatTimeObj(horaFin) : 'Sin definir'}</Text>
              </TouchableOpacity>
              {showHoraFin && (
                <DateTimePicker
                  value={horaFin ?? horaInicio}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_: DateTimePickerEvent, d?: Date) => {
                    if (Platform.OS === 'android') setShowHoraFin(false);
                    if (d) setHoraFin(d);
                  }}
                />
              )}
              {showHoraFin && Platform.OS === 'ios' && (
                <TouchableOpacity onPress={() => setShowHoraFin(false)} className="bg-primary/10 rounded-xl py-2 items-center">
                  <Text className="text-sm font-semibold text-primary">Listo</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View className="gap-1.5">
            <Text className="text-sm font-semibold text-foreground">Lugar</Text>
            <LugarInput
              value={lugar}
              latitud={latitud}
              longitud={longitud}
              onChange={(l, lat, lng) => { setLugar(l); setLatitud(lat); setLongitud(lng); }}
            />
          </View>

          <View className="gap-1.5">
            <Text className="text-sm font-semibold text-foreground">Descripción</Text>
            <TextInput
              value={descripcion}
              onChangeText={setDescripcion}
              multiline
              numberOfLines={3}
              className="bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground"
              style={{ minHeight: 72, textAlignVertical: 'top' }}
            />
          </View>

          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-foreground">Vacantes</Text>
              {!agregandoVacante && (
                <TouchableOpacity onPress={() => setAgregandoVacante(true)} hitSlop={8} className="flex-row items-center gap-1">
                  <Ionicons name="add-circle-outline" size={16} color={COLORS.primary} />
                  <Text className="text-xs font-semibold text-primary">Agregar vacante</Text>
                </TouchableOpacity>
              )}
            </View>
            {oferta.puestos.length === 0 && <Text className="text-sm text-muted-foreground">Sin vacantes</Text>}
            {oferta.puestos.map(p => (
              <Text key={p.id} className="text-sm text-muted-foreground">{p.cargo_nombre} · {p.plazas} plaza(s)</Text>
            ))}
            {agregandoVacante && (
              <View className="bg-card border border-border rounded-xl p-3 gap-3">
                {/* ponytail: chips sin buscador — CargoModal es otro Modal y RN no anida Modals bien en iOS. Upgrade path: buscador si el catálogo crece. */}
                <View className="flex-row flex-wrap gap-2">
                  {cargos.filter(c => !usedIds.has(c.id)).map(c => {
                    const sel = vacante.cargo?.id === c.id;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        onPress={() => setVacante(v => ({ ...v, cargo: c }))}
                        className={`px-3 py-1.5 rounded-full border ${sel ? 'bg-primary border-primary' : 'border-border'}`}
                      >
                        <Text className={`text-xs font-semibold ${sel ? 'text-white' : 'text-foreground'}`}>{c.nombre}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View className="flex-row gap-4">
                  <View className="gap-1">
                    <Text className="text-xs text-muted-foreground">Plazas</Text>
                    <View className="flex-row items-center gap-2">
                      <TouchableOpacity
                        className="w-8 h-8 bg-muted rounded-xl items-center justify-center"
                        onPress={() => setVacante(v => ({ ...v, plazas: Math.max(1, v.plazas - 1) }))}
                      >
                        <Ionicons name="remove" size={16} color={COLORS.mutedForeground} />
                      </TouchableOpacity>
                      <Text className="text-base font-bold text-foreground w-6 text-center">{vacante.plazas}</Text>
                      <TouchableOpacity
                        className="w-8 h-8 bg-muted rounded-xl items-center justify-center"
                        onPress={() => setVacante(v => ({ ...v, plazas: v.plazas + 1 }))}
                      >
                        <Ionicons name="add" size={16} color={COLORS.mutedForeground} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View className="flex-1 gap-1">
                    <Text className="text-xs text-muted-foreground">Tarifa por turno</Text>
                    <View className="flex-row items-center bg-muted rounded-xl px-3 gap-1">
                      <Text className="text-sm font-bold text-muted-foreground">$</Text>
                      <TextInput
                        className="flex-1 py-2 text-sm font-semibold text-foreground"
                        placeholder="120.000"
                        placeholderTextColor={COLORS.placeholder}
                        value={vacante.tarifa}
                        onChangeText={t => setVacante(v => ({ ...v, tarifa: t.replace(/[^\d.,]/g, '') }))}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                </View>
                <View className="flex-row gap-2">
                  <Button label="Cancelar" variant="secondary" onPress={() => setAgregandoVacante(false)} style={{ flex: 1 }} />
                  <Button
                    label="Agregar"
                    variant="primary"
                    loading={crearPuestoM.isPending}
                    onPress={handleAgregarVacante}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            )}
          </View>

          {cambianCriticos && (
            <View className="flex-row items-center gap-2 bg-warning-light rounded-xl px-3 py-2.5">
              <Ionicons name="warning-outline" size={16} color={COLORS.warningText} />
              <Text className="flex-1 text-xs font-medium text-warning">
                Quienes ya estén confirmados deberán reconfirmar su participación tras este cambio.
              </Text>
            </View>
          )}

          <Button
            label={actualizarM.isPending ? 'Guardando…' : 'Guardar cambios'}
            variant="primary"
            fullWidth
            loading={actualizarM.isPending}
            onPress={handleGuardar}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Turno fallido (gestores) — fuerza mayor: quien ya marcó ingreso recibe
// una compensación en vez de perder el turno sin nada. ─────────────────────

function TurnoFallidoModal({
  visible,
  oferta,
  marcarFallidaM,
  onClose,
  onDone,
}: {
  visible: boolean;
  oferta: OfertaDetalle;
  marcarFallidaM: ReturnType<typeof useMarcarOfertaFallida>;
  onClose: () => void;
  onDone: () => void;
}) {
  const enProgreso = oferta.asignaciones.filter((a) => a.estado === 'en_progreso');
  const otros = oferta.asignaciones.filter((a) =>
    a.estado !== 'en_progreso' && a.estado !== 'completado' && a.estado !== 'cancelado'
  );

  const [motivo, setMotivo] = useState('Fuerza mayor');
  const [montos, setMontos] = useState<Record<number, string>>({});

  React.useEffect(() => {
    if (!visible) return;
    setMotivo('Fuerza mayor');
    setMontos(Object.fromEntries(enProgreso.map((a) => {
      const tarifa = oferta.puestos.find((p) => p.id === a.puesto_id)?.tarifa_dia ?? 0;
      return [a.id, String(tarifa)];
    })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, oferta.id]);

  if (!visible) return null;

  async function handleConfirmar() {
    if (!motivo.trim()) {
      showAlert('Falta el motivo', 'Escribe por qué este turno es fuerza mayor.', 'warning');
      return;
    }
    const compensaciones = enProgreso.map((a) => ({
      asignacion_id: a.id,
      monto: parseTarifa(montos[a.id] ?? '0'),
    }));
    try {
      await marcarFallidaM.mutateAsync({ ofertaId: oferta.id, motivo: motivo.trim(), compensaciones });
      onDone();
    } catch (err) {
      showAlert('Error', err instanceof ApiError ? err.message : 'No se pudo marcar el turno como fallido.');
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          className="bg-background rounded-t-3xl"
          contentContainerClassName="px-6 pt-5 pb-10 gap-5"
          style={{ maxHeight: '85%' }}
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold text-foreground">Turno fallido</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={COLORS.mutedForeground} />
            </Pressable>
          </View>

          <Text className="text-sm text-muted-foreground">
            El turno se cancelará por fuerza mayor. Quienes ya marcaron ingreso recibirán la compensación
            que definas abajo; el resto queda cancelado sin pago, como siempre.
          </Text>

          <View className="gap-1.5">
            <Text className="text-sm font-semibold text-foreground">Motivo</Text>
            <TextInput
              value={motivo}
              onChangeText={setMotivo}
              placeholder="Ej. fuerza mayor"
              placeholderTextColor={COLORS.placeholder}
              maxLength={255}
              className="bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground"
            />
          </View>

          <View className="gap-3">
            <Text className="text-sm font-semibold text-foreground">
              Compensación ({enProgreso.length} ya en turno)
            </Text>
            {enProgreso.map((a) => (
              <View key={a.id} className="gap-1.5">
                <Text className="text-xs text-muted-foreground">
                  {a.trabajador_nombre} {a.trabajador_apellido} · {a.cargo_nombre}
                </Text>
                <View className="flex-row items-center bg-card border border-border rounded-xl px-3 gap-1">
                  <Text className="text-sm font-bold text-muted-foreground">$</Text>
                  <TextInput
                    className="flex-1 py-3 text-sm font-semibold text-foreground"
                    value={montos[a.id] ?? ''}
                    onChangeText={(t) => setMontos((m) => ({ ...m, [a.id]: t.replace(/[^\d.,]/g, '') }))}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            ))}
          </View>

          {otros.length > 0 && (
            <Text className="text-xs text-muted-foreground">
              {otros.length} trabajador{otros.length > 1 ? 'es' : ''} más que aún no había
              {otros.length > 1 ? 'n' : ''} empezado quedará{otros.length > 1 ? 'n' : ''} cancelado
              {otros.length > 1 ? 's' : ''} sin compensación.
            </Text>
          )}

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Button label="Volver" variant="secondary" fullWidth disabled={marcarFallidaM.isPending} onPress={onClose} />
            </View>
            <View className="flex-1">
              <Button
                label={marcarFallidaM.isPending ? 'Confirmando…' : 'Confirmar turno fallido'}
                variant="danger"
                fullWidth
                loading={marcarFallidaM.isPending}
                onPress={handleConfirmar}
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

