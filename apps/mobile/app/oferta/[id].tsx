import { showAlert } from '@/lib/alertDialog';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { COLORS } from '@/lib/designTokens';
import { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Linking, Platform, Switch } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/theme';
import { confirm } from '@/lib/confirmDialog';
import { actionSheet } from '@/lib/actionSheet';
import { showToast } from '@/lib/toast';
import { showAnuncioTurno } from '@/lib/anuncioTurno';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { turnoYaInicio } from '@/features/turnos/turnosUtils';
import { bogotaToday } from '@/lib/formatters';
import {
  useOferta,
  useMisTurnos,
  useAplicar,
  useRetirar,
  useConfirmar,
  useRechazar,
  useCancelar,
  useNoPresentado,
  useCancelarOferta,
  useMarcarOfertaFallida,
  useCompletarOferta,
  useActualizarOferta,
} from '@/features/turnos/useTurnos';
import { FuncionesCargoModal } from '@/features/turnos/FuncionesCargoModal';
import { TurnosExtraOptIn, esErrorTurnosExtraApagadas } from '@/features/nomina/TurnosExtraOptIn';
import { Button } from '@/components/ui/Button';
import type { OfertaPuesto } from '@api-client';
import { ApiError } from '@api-client';
import { PostulanteRow } from '@/features/turnos/oferta/PostulanteRow';
import { DuplicarOfertaModal } from '@/features/turnos/oferta/DuplicarOfertaModal';
import { EditarOfertaModal } from '@/features/turnos/oferta/EditarOfertaModal';
import { TurnoFallidoModal } from '@/features/turnos/oferta/TurnoFallidoModal';
import { fmtDate } from '@/features/turnos/oferta/fechasOferta';

function fmtRange(start: string, end: string | null) {
  const s = start.slice(0, 5).replace(/^0/, '');
  return end ? `${s} – ${end.slice(0, 5).replace(/^0/, '')}` : s;
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
