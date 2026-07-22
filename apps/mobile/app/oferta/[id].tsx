import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Linking, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useTheme }    from '@/lib/theme';
import { confirm }     from '@/lib/confirmDialog';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { bogotaToday, turnoYaInicio } from '@/features/turnos/turnosUtils';
import {
  useOferta, useMisTurnos, useAplicar, useRetirar,
  useConfirmar, useRechazar, useCancelar, useNoPresentado, useDuplicarOferta, useCancelarOferta,
} from '@/features/turnos/useTurnos';
import { Badge }   from '@/components/ui/Badge';
import { Button }  from '@/components/ui/Button';
import type { AsignacionResumen, EstadoAsignacion } from '@api-client';
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
};

// ── PostulanteRow (gestores) ──────────────────────────────────────────────

function PostulanteRow({
  asignacion, ofertaId, esPasado, turnoIniciado,
  confirmarM, rechazarM, cancelarM, noPresentadoM,
}: {
  asignacion:    AsignacionResumen;
  ofertaId:      number;
  esPasado:      boolean;
  turnoIniciado: boolean;
  confirmarM:    ReturnType<typeof useConfirmar>;
  rechazarM:     ReturnType<typeof useRechazar>;
  cancelarM:     ReturnType<typeof useCancelar>;
  noPresentadoM: ReturnType<typeof useNoPresentado>;
}) {
  const cfg       = ESTADO_CFG[asignacion.estado];
  const isPending = asignacion.estado === 'pendiente';
  const isConf    = asignacion.estado === 'confirmado';
  const isEnProg  = asignacion.estado === 'en_progreso';
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

      {esPasado ? (
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
                <Ionicons name="checkmark-circle" size={14} color="#059669" />
                <Text className="text-xs font-semibold text-success">Aceptado</Text>
              </View>
              <Button label={cancelarM.isPending ? '…' : 'Cancelar'} variant="danger" size="sm"
                loading={cancelarM.isPending} disabled={isBusy}
                onPress={async () => {
                  if (await confirm({ title: 'Cancelar turno', message: `¿Cancelar el turno de ${nombre}?`, cancelLabel: 'Volver', confirmLabel: 'Cancelar turno', destructive: true })) {
                    cancelarM.mutate({ asignacionId: asignacion.id, ofertaId });
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
              <Ionicons name="time-outline" size={14} color="#3B82F6" />
              <Text className="text-xs font-semibold text-info">En turno</Text>
            </View>
          )}
        </>
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
  // Backend restringe cancelar oferta a admin_empresa/jefe_turnos (no jefe_nomina).
  const puedeCancelarOferta = rol === 'admin_empresa' || rol === 'jefe_turnos';

  const { data: oferta, isLoading } = useOferta(id);
  const { data: misTurnos }         = useMisTurnos({ enabled: isWorker });
  const esPasado      = oferta ? oferta.fecha < bogotaToday() : false;
  const turnoIniciado = oferta ? turnoYaInicio(oferta.fecha, oferta.hora_inicio) : false;

  const aplicarM       = useAplicar();
  const retirarM       = useRetirar();
  const confirmarM     = useConfirmar();
  const rechazarM      = useRechazar();
  const cancelarM      = useCancelar();
  const noPresentadoM  = useNoPresentado();
  const duplicarM      = useDuplicarOferta();
  const cancelarOfertaM = useCancelarOferta();

  const [showDuplicarPicker, setShowDuplicarPicker] = useState(false);

  const miAsignacion = isWorker
    ? (misTurnos ?? []).find((a) => a.oferta_id === id)
    : undefined;
  const yaAplicado = !!miAsignacion;

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
      Alert.alert('Error', err instanceof ApiError ? err.message : 'No se pudo retirar la postulación.');
    }
  }

  const availablePuestos = oferta?.puestos.filter((p) => p.plazas_cubiertas < p.plazas) ?? [];
  const [selectedPuestoId, setSelectedPuestoId] = useState<number | null>(null);
  const selectedPuesto = availablePuestos.find((p) => p.id === selectedPuestoId) ?? availablePuestos[0];

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

  async function handleAplicar() {
    if (!selectedPuesto) return;
    try {
      await aplicarM.mutateAsync({ ofertaId: id!, puestoId: selectedPuesto.id });
      Alert.alert('¡Postulación enviada!', `Aplicaste como ${selectedPuesto.cargo_nombre}. El gestor revisará tu solicitud.`);
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'No se pudo aplicar.');
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['bottom']}>
        <Stack.Screen options={{ title: 'Detalle del turno', headerShown: true }} />
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (!oferta) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center gap-4 px-6" edges={['bottom']}>
        <Stack.Screen options={{ title: 'Detalle del turno', headerShown: true }} />
        <Ionicons name="search-outline" size={48} color="#94A3B8" />
        <Text className="text-base font-semibold text-foreground text-center">Turno no encontrado</Text>
      </SafeAreaView>
    );
  }

  const totalPlazas    = oferta.puestos.reduce((s, p) => s + p.plazas, 0);
  const plazasCubiertas = oferta.puestos.reduce((s, p) => s + p.plazas_cubiertas, 0);

  return (
    <>
      <Stack.Screen options={{ title: oferta.titulo, headerShown: true }} />

      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <ScrollView contentContainerClassName="px-5 py-5 gap-4 pb-12" showsVerticalScrollIndicator={false}>

          {/* ── Info principal ──────────────────────────────────── */}
          <View className="bg-card rounded-3xl overflow-hidden"
            style={{ elevation: 3, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
            <View className="h-2" style={{ backgroundColor: esPasado ? '#CBD5E1' : '#FF7150' }} />
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
                  <Ionicons name="calendar-outline" size={16} color="#64748B" />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-muted-foreground">Fecha</Text>
                  <Text className="text-sm font-medium text-foreground">{fmtDate(oferta.fecha)}</Text>
                </View>
              </View>

              {/* Horario */}
              <View className="flex-row items-center gap-3">
                <View className="w-8 h-8 bg-muted rounded-xl items-center justify-center">
                  <Ionicons name="time-outline" size={16} color="#64748B" />
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
                    <Ionicons name="location-outline" size={16} color="#64748B" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-muted-foreground">Lugar</Text>
                    <Text className="text-sm font-medium text-foreground">{oferta.lugar}</Text>
                  </View>
                  {hasCoords && (
                    <TouchableOpacity onPress={openInMaps}
                      className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted"
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="map-outline" size={14} color="#3B82F6" />
                      <Text className="text-xs font-semibold text-info">Mapa</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </View>

          {/* ── Descripción ─────────────────────────────────────── */}
          {oferta.descripcion && (
            <View className="bg-card rounded-2xl px-5 py-4 gap-2"
              style={{ elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8 }}>
              <View className="flex-row items-center gap-2">
                <Ionicons name="document-text-outline" size={14} color="#64748B" />
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Descripción
                </Text>
              </View>
              <Text className="text-sm text-foreground leading-5">{oferta.descripcion}</Text>
            </View>
          )}

          {/* ── Puestos / cargos ─────────────────────────────────── */}
          <View className="bg-card rounded-2xl px-5 py-4 gap-3"
            style={{ elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8 }}>
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {isWorker && !yaAplicado && !esPasado && availablePuestos.length > 1
                ? '¿A qué cargo quieres aplicar?'
                : 'Cargos y tarifas'}
            </Text>
            {oferta.puestos.map((p) => {
              const seleccionable = isWorker && !yaAplicado && !esPasado
                && availablePuestos.length > 1 && p.plazas_cubiertas < p.plazas;
              const seleccionado = seleccionable && p.id === selectedPuesto?.id;
              const Row = (
                <View className={`flex-row items-center justify-between py-2 border-b border-border last:border-0 ${seleccionable ? 'px-3 rounded-xl border' : ''} ${seleccionado ? 'bg-primary/10 border-primary' : seleccionable ? 'border-border' : ''}`}>
                  <View className="flex-1 gap-0.5 flex-row items-center gap-2">
                    {seleccionable && (
                      <Ionicons
                        name={seleccionado ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={seleccionado ? '#FF7150' : '#94A3B8'}
                      />
                    )}
                    <View className="flex-1 gap-0.5">
                      <Text className="text-sm font-semibold text-foreground">{p.cargo_nombre}</Text>
                      {p.notas && (
                        <Text className="text-xs text-muted-foreground">{p.notas}</Text>
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
                  <Ionicons name="time-outline" size={20} color="#94A3B8" />
                  <Text className="text-sm text-muted-foreground">Evento finalizado</Text>
                </View>
              ) : yaAplicado ? (
                <View className="gap-3">
                  <View className="bg-info/10 rounded-2xl px-5 py-4 flex-row items-center gap-3">
                    <Ionicons name="checkmark-circle-outline" size={22} color="#3B82F6" />
                    <Text className="text-sm font-semibold text-info">
                      {miAsignacion?.estado === 'pendiente' ? 'Ya estás postulado a este turno' : 'Ya estás confirmado en este turno'}
                    </Text>
                  </View>
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

          {/* ── Duplicar oferta (gestores) ──────────────────────── */}
          {isGestor && (
            <>
              <Button
                label={duplicarM.isPending ? 'Duplicando…' : 'Duplicar a otra fecha'}
                variant="secondary"
                fullWidth
                loading={duplicarM.isPending}
                onPress={() => setShowDuplicarPicker(true)}
              />
              {showDuplicarPicker && (
                <DateTimePicker
                  mode="date"
                  display="default"
                  minimumDate={new Date()}
                  value={new Date()}
                  onChange={async (_, date) => {
                    setShowDuplicarPicker(false);
                    if (!date || !id) return;
                    const fecha = date.toISOString().slice(0, 10);
                    try {
                      const nueva = await duplicarM.mutateAsync({ ofertaId: id, fecha });
                      Alert.alert('Oferta duplicada', `"${nueva.titulo}" creada para el ${fecha}.`);
                    } catch {
                      Alert.alert('Error', 'No se pudo duplicar la oferta.');
                    }
                  }}
                />
              )}
            </>
          )}

          {/* ── Cancelar oferta (admin_empresa / jefe_turnos) ────── */}
          {puedeCancelarOferta && oferta.estado !== 'cancelada' && oferta.estado !== 'completada' && (
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
                  router.back();
                } catch (err) {
                  Alert.alert('Error', err instanceof ApiError ? err.message : 'No se pudo cancelar la oferta.');
                }
              }}
            />
          )}

          {/* ── Postulantes (gestores) ───────────────────────────── */}
          {isGestor && (
            <View className="bg-card rounded-2xl px-5 py-4"
              style={{ elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8 }}>
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
      </SafeAreaView>
    </>
  );
}
