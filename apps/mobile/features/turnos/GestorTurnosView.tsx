import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useOfertas, useOferta, useConfirmar, useRechazar, useCancelar, useNoPresentado, useEliminarOfertaDefinitivo } from '@/features/turnos/useTurnos';
import { bogotaToday } from '@/features/turnos/turnosUtils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { Oferta, AsignacionResumen, EstadoAsignacion } from '@api-client';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { confirm } from '@/lib/confirmDialog';

// ── Helpers ───────────────────────────────────────────────────────────────

const SHORT_MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const SHORT_DAYS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

function formatShortDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return `${SHORT_DAYS[d.getDay()]} ${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}

function fmtRange(start: string, end: string | null) {
  const s = start.slice(0, 5).replace(/^0/, '');
  return end ? `${s} – ${end.slice(0, 5).replace(/^0/, '')}` : s;
}

type BadgeVariant = 'warning' | 'success' | 'info' | 'default' | 'danger';

const ESTADO_CONFIG: Record<EstadoAsignacion, { label: string; variant: BadgeVariant }> = {
  pendiente:      { label: 'Pendiente',      variant: 'warning' },
  confirmado:     { label: 'Confirmado',     variant: 'success' },
  en_progreso:    { label: 'En progreso',    variant: 'info'    },
  completado:     { label: 'Completado',     variant: 'default' },
  no_presentado:  { label: 'No se presentó', variant: 'danger'  },
  cancelado:      { label: 'Cancelado',      variant: 'danger'  },
};

// ── PostulanteRow ─────────────────────────────────────────────────────────

function PostulanteRow({
  asignacion,
  ofertaId,
  esPasado,
  confirmarMutation,
  rechazarMutation,
  cancelarMutation,
  noPresentadoMutation,
}: {
  asignacion: AsignacionResumen;
  ofertaId: number;
  esPasado: boolean;
  confirmarMutation:     ReturnType<typeof useConfirmar>;
  rechazarMutation:      ReturnType<typeof useRechazar>;
  cancelarMutation:      ReturnType<typeof useCancelar>;
  noPresentadoMutation:  ReturnType<typeof useNoPresentado>;
}) {
  const isPending     = asignacion.estado === 'pendiente';
  const isConfirmed   = asignacion.estado === 'confirmado';
  const isEnProgreso  = asignacion.estado === 'en_progreso';
  const cfg           = ESTADO_CONFIG[asignacion.estado];

  const isConfirming =
    confirmarMutation.isPending &&
    (confirmarMutation.variables as { asignacionId: number } | undefined)?.asignacionId === asignacion.id;

  const isRejecting =
    rechazarMutation.isPending &&
    (rechazarMutation.variables as { asignacionId: number } | undefined)?.asignacionId === asignacion.id;

  const isCancelling =
    cancelarMutation.isPending &&
    (cancelarMutation.variables as { asignacionId: number } | undefined)?.asignacionId === asignacion.id;

  const isMarkingNP =
    noPresentadoMutation.isPending &&
    (noPresentadoMutation.variables as { asignacionId: number } | undefined)?.asignacionId === asignacion.id;

  const isBusy = confirmarMutation.isPending || rechazarMutation.isPending || cancelarMutation.isPending || noPresentadoMutation.isPending;

  async function handleRechazar() {
    const ok = await confirm({
      title: 'Rechazar postulación',
      message: `¿Rechazar la postulación de ${asignacion.trabajador_nombre} ${asignacion.trabajador_apellido}?`,
      confirmLabel: 'Rechazar',
      destructive: true,
    });
    if (ok) rechazarMutation.mutate({ asignacionId: asignacion.id, ofertaId });
  }

  async function handleNoPresentado() {
    const ok = await confirm({
      title: 'No se presentó',
      message: `¿Marcar a ${asignacion.trabajador_nombre} ${asignacion.trabajador_apellido} como no presentado? Esto registra 0 estrellas automáticamente y afecta su ranking.`,
      confirmLabel: 'Marcar ausente',
      destructive: true,
    });
    if (ok) noPresentadoMutation.mutate({ asignacionId: asignacion.id, ofertaId });
  }

  return (
    <View className="py-2.5 border-b border-border gap-2">
      {/* Nombre + estado */}
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-medium text-foreground flex-1 mr-3" numberOfLines={1}>
          {asignacion.trabajador_nombre} {asignacion.trabajador_apellido}
        </Text>
        <Badge label={cfg.label} variant={cfg.variant} size="sm" />
      </View>

      {/* Evento pasado: solo "No vino" si aplica; sin confirmar/rechazar/cancelar */}
      {esPasado ? (
        (isConfirmed || isEnProgreso) ? (
          <Button label={isMarkingNP ? '…' : 'No vino'} variant="danger" size="sm"
            loading={isMarkingNP} disabled={isBusy} onPress={handleNoPresentado} />
        ) : isPending ? (
          <Button label={isRejecting ? '…' : 'Rechazar'} variant="danger" size="sm"
            loading={isRejecting} disabled={isBusy} onPress={handleRechazar} />
        ) : null
      ) : (
        <>
          {/* Pendiente → Rechazar + Confirmar */}
          {isPending && (
            <View className="flex-row gap-2">
              <Button label={isRejecting ? '…' : 'Rechazar'} variant="danger" size="sm"
                loading={isRejecting} disabled={isBusy} onPress={handleRechazar} />
              <Button label={isConfirming ? '…' : 'Confirmar'} variant="success" size="sm"
                loading={isConfirming} disabled={isBusy}
                onPress={() => confirmarMutation.mutate({ asignacionId: asignacion.id, ofertaId })} />
            </View>
          )}

          {/* Confirmado → chip Aceptado + Cancelar + No se presentó */}
          {isConfirmed && (
            <View className="flex-row items-center gap-2 flex-wrap">
              <View className="flex-row items-center gap-1 bg-success-light px-3 py-1.5 rounded-xl">
                <Ionicons name="checkmark-circle" size={14} color="#059669" />
                <Text className="text-xs font-semibold text-success">Aceptado</Text>
              </View>
              <Button label={isCancelling ? '…' : 'Cancelar'} variant="secondary" size="sm"
                loading={isCancelling} disabled={isBusy}
                onPress={async () => {
                  const ok = await confirm({
                    title: 'Cancelar asignación',
                    message: `¿Cancelar el turno confirmado de ${asignacion.trabajador_nombre} ${asignacion.trabajador_apellido}? La plaza quedará disponible nuevamente.`,
                    cancelLabel: 'Volver',
                    confirmLabel: 'Cancelar turno',
                    destructive: true,
                  });
                  if (ok) cancelarMutation.mutate({ asignacionId: asignacion.id, ofertaId });
                }} />
              <Button label={isMarkingNP ? '…' : 'No vino'} variant="danger" size="sm"
                loading={isMarkingNP} disabled={isBusy} onPress={handleNoPresentado} />
            </View>
          )}

          {/* En progreso → chip */}
          {isEnProgreso && (
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

// ── GestorOfertaItem ──────────────────────────────────────────────────────

function GestorOfertaItem({
  oferta,
  esPasado,
  confirmarMutation,
  rechazarMutation,
  cancelarMutation,
  noPresentadoMutation,
}: {
  oferta: Oferta;
  esPasado: boolean;
  confirmarMutation:    ReturnType<typeof useConfirmar>;
  rechazarMutation:     ReturnType<typeof useRechazar>;
  cancelarMutation:     ReturnType<typeof useCancelar>;
  noPresentadoMutation: ReturnType<typeof useNoPresentado>;
}) {
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();
  const { data: detalle, isLoading: loadingDetalle } = useOferta(expanded ? oferta.id : null);
  const eliminarMutation = useEliminarOfertaDefinitivo();

  const esCancelada     = oferta.estado === 'cancelada';
  const totalPlazas     = oferta.puestos.reduce((s, p) => s + p.plazas, 0);
  const plazasCubiertas = oferta.puestos.reduce((s, p) => s + p.plazas_cubiertas, 0);
  const pendientes      = detalle?.asignaciones.filter((a) => a.estado === 'pendiente') ?? [];
  const tienePendientes = pendientes.length > 0;

  async function handleEliminar() {
    const ok = await confirm({
      title: 'Eliminar oferta',
      message: `Se eliminará permanentemente "${oferta.titulo}". Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      destructive: true,
    });
    if (!ok) return;
    try {
      await eliminarMutation.mutateAsync(oferta.id);
    } catch (err: unknown) {
      Alert.alert('No se pudo eliminar', apiErrorMessage(err, 'Error al eliminar la oferta'));
    }
  }

  return (
    <View
      className="bg-card rounded-2xl overflow-hidden"
      style={{
        opacity: esCancelada ? 0.55 : esPasado ? 0.72 : 1,
        elevation: (esPasado || esCancelada) ? 0 : 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: (esPasado || esCancelada) ? 0 : 0.06,
        shadowRadius: 8,
      }}
    >
      {/* ── Offer header ── */}
      <TouchableOpacity
        className="flex-row"
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.75}
      >
        <View className="w-1.5" style={{ backgroundColor: esCancelada ? '#94A3B8' : esPasado ? '#CBD5E1' : '#FF7150' }} />

        <View className="flex-1 px-4 py-4 gap-1.5">
          {/* Title + badge finalizado/cancelada */}
          <View className="flex-row items-start justify-between gap-2">
            <Text className="text-base font-semibold text-foreground flex-1" numberOfLines={1}>
              {oferta.titulo}
            </Text>
            <View className="flex-row items-center gap-2">
              {esCancelada && <Badge label="Cancelada" variant="danger" size="sm" />}
              {!esCancelada && esPasado && <Badge label="Finalizado" variant="default" size="sm" />}
              <Text className="text-lg text-muted-foreground">{expanded ? '▲' : '▼'}</Text>
            </View>
          </View>

          {/* Date / time / location */}
          <View className="flex-row gap-3 flex-wrap">
            <Text className="text-sm text-muted-foreground">
              📅 {formatShortDate(oferta.fecha)}
            </Text>
            <Text className="text-sm text-muted-foreground">
              🕐 {fmtRange(oferta.hora_inicio, oferta.hora_fin_estimada)}
            </Text>
            {oferta.lugar ? (
              <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                📍 {oferta.lugar}
              </Text>
            ) : null}
          </View>

          {/* Puestos summary + pending indicator */}
          <View className="flex-row items-center justify-between mt-0.5">
            <Text className="text-xs text-muted-foreground">
              {plazasCubiertas}/{totalPlazas} plazas cubiertas
            </Text>
            {!esPasado && !expanded && tienePendientes ? (
              <Badge
                label={`${pendientes.length} pendiente${pendientes.length > 1 ? 's' : ''}`}
                variant="warning"
                size="sm"
              />
            ) : !esPasado && !expanded && detalle ? (
              <Badge label="Sin pendientes" variant="success" size="sm" />
            ) : null}
          </View>
        </View>
      </TouchableOpacity>

      {/* ── Expandable postulantes section ── */}
      {expanded && (
        <View className="px-4 pb-4 border-t border-border mt-0">
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-3 mb-2">
            {esPasado ? 'Historial de asistencia' : 'Postulantes'}
          </Text>

          <TouchableOpacity
            onPress={() => router.push(`/oferta/${oferta.id}` as any)}
            className="flex-row items-center gap-1 mb-3"
          >
            <Ionicons name="information-circle-outline" size={14} color="#6366F1" />
            <Text className="text-xs font-semibold text-primary">Ver detalles completos</Text>
            <Ionicons name="chevron-forward" size={12} color="#6366F1" />
          </TouchableOpacity>

          {loadingDetalle ? (
            <View className="py-4 items-center">
              <ActivityIndicator size="small" color="#FF5A3C" />
            </View>
          ) : !detalle?.asignaciones.length ? (
            <Text className="text-sm text-muted-foreground py-2">
              Sin postulantes.
            </Text>
          ) : (
            detalle.asignaciones.map((a) => (
              <PostulanteRow
                key={a.id}
                asignacion={a}
                ofertaId={oferta.id}
                esPasado={esPasado}
                confirmarMutation={confirmarMutation}
                rechazarMutation={rechazarMutation}
                cancelarMutation={cancelarMutation}
                noPresentadoMutation={noPresentadoMutation}
              />
            ))
          )}

          {esCancelada && (
            <View className="mt-3">
              <Button
                label={eliminarMutation.isPending ? 'Eliminando…' : 'Eliminar oferta'}
                variant="danger"
                size="sm"
                loading={eliminarMutation.isPending}
                onPress={handleEliminar}
              />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ── GestorTurnosView ──────────────────────────────────────────────────────

interface Props {
  selectedDate: string;
  filtroParaQuien?: 'turnos' | 'nomina' | 'ambos';
}

export function GestorTurnosView({ selectedDate, filtroParaQuien }: Props) {
  const today      = useMemo(() => bogotaToday(), []);
  const esPasado   = selectedDate < today;

  const {
    data: resp,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useOfertas({ fecha: selectedDate, limit: 50, para_quien: filtroParaQuien });

  const confirmarMutation     = useConfirmar();
  const rechazarMutation      = useRechazar();
  const cancelarMutation      = useCancelar();
  const noPresentadoMutation  = useNoPresentado();

  const ofertas = resp?.data ?? [];

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#FF5A3C" />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center gap-3 px-6">
        <Text className="text-4xl">⚠️</Text>
        <Text className="text-base font-semibold text-foreground">
          {apiErrorMessage(error, 'Error al cargar turnos')}
        </Text>
        <Button label="Reintentar" variant="secondary" onPress={() => refetch()} />
      </View>
    );
  }

  return (
    <FlatList
      data={ofertas}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <GestorOfertaItem
          oferta={item}
          esPasado={esPasado}
          confirmarMutation={confirmarMutation}
          rechazarMutation={rechazarMutation}
          cancelarMutation={cancelarMutation}
          noPresentadoMutation={noPresentadoMutation}
        />
      )}
      contentContainerClassName="px-5 py-4 gap-3"
      ListEmptyComponent={
        <View className="flex-1 items-center justify-center py-16 gap-3">
          <Text className="text-4xl">📋</Text>
          <Text className="text-base font-semibold text-foreground">Sin turnos este día</Text>
          <Text className="text-sm text-muted-foreground text-center px-8">
            No hay turnos publicados para este día.
          </Text>
        </View>
      }
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor="#FF5A3C"
          colors={['#FF5A3C']}
        />
      }
      showsVerticalScrollIndicator={false}
    />
  );
}
