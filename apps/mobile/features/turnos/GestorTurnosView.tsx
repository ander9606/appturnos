import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useOfertas, useOferta, useConfirmar, useRechazar, useCancelar, useNoPresentado } from '@/features/turnos/useTurnos';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { Oferta, AsignacionResumen, EstadoAsignacion } from '@api-client';

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
  confirmarMutation,
  rechazarMutation,
  cancelarMutation,
  noPresentadoMutation,
}: {
  asignacion: AsignacionResumen;
  ofertaId: number;
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

  function handleRechazar() {
    Alert.alert(
      'Rechazar postulación',
      `¿Rechazar la postulación de ${asignacion.trabajador_nombre} ${asignacion.trabajador_apellido}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Rechazar', style: 'destructive',
          onPress: () => rechazarMutation.mutate({ asignacionId: asignacion.id, ofertaId }) },
      ]
    );
  }

  function handleCancelar() {
    Alert.alert(
      'Cancelar asignación',
      `¿Cancelar el turno confirmado de ${asignacion.trabajador_nombre} ${asignacion.trabajador_apellido}? La plaza quedará disponible nuevamente.`,
      [
        { text: 'Volver', style: 'cancel' },
        { text: 'Cancelar turno', style: 'destructive',
          onPress: () => cancelarMutation.mutate({ asignacionId: asignacion.id, ofertaId }) },
      ]
    );
  }

  function handleNoPresentado() {
    Alert.alert(
      'No se presentó',
      `¿Marcar a ${asignacion.trabajador_nombre} ${asignacion.trabajador_apellido} como no presentado? Esto registra 0 estrellas automáticamente y afecta su ranking.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Marcar ausente', style: 'destructive',
          onPress: () => noPresentadoMutation.mutate({ asignacionId: asignacion.id, ofertaId }) },
      ]
    );
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
          <Button label={isCancelling ? '…' : 'Cancelar'} variant="danger" size="sm"
            loading={isCancelling} disabled={isBusy} onPress={handleCancelar} />
          <Button label={isMarkingNP ? '…' : 'No vino'} variant="danger" size="sm"
            loading={isMarkingNP} disabled={isBusy} onPress={handleNoPresentado} />
        </View>
      )}

      {/* En progreso → chip + No se presentó */}
      {isEnProgreso && (
        <View className="flex-row items-center gap-2">
          <View className="flex-row items-center gap-1 bg-info/10 px-3 py-1.5 rounded-xl">
            <Ionicons name="time-outline" size={14} color="#3B82F6" />
            <Text className="text-xs font-semibold text-info">En turno</Text>
          </View>
          <Button label={isMarkingNP ? '…' : 'No vino'} variant="danger" size="sm"
            loading={isMarkingNP} disabled={isBusy} onPress={handleNoPresentado} />
        </View>
      )}
    </View>
  );
}

// ── GestorOfertaItem ──────────────────────────────────────────────────────

function GestorOfertaItem({
  oferta,
  confirmarMutation,
  rechazarMutation,
  cancelarMutation,
  noPresentadoMutation,
}: {
  oferta: Oferta;
  confirmarMutation:    ReturnType<typeof useConfirmar>;
  rechazarMutation:     ReturnType<typeof useRechazar>;
  cancelarMutation:     ReturnType<typeof useCancelar>;
  noPresentadoMutation: ReturnType<typeof useNoPresentado>;
}) {
  const [expanded, setExpanded] = useState(false);
  const { data: detalle, isLoading: loadingDetalle } = useOferta(expanded ? oferta.id : null);

  const totalPlazas    = oferta.puestos.reduce((s, p) => s + p.plazas, 0);
  const plazasCubiertas = oferta.puestos.reduce((s, p) => s + p.plazas_cubiertas, 0);
  const pendientes = detalle?.asignaciones.filter((a) => a.estado === 'pendiente') ?? [];
  const tienePendientes = pendientes.length > 0;

  return (
    <View
      className="bg-card rounded-2xl overflow-hidden"
      style={{
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      }}
    >
      {/* ── Offer header ── */}
      <TouchableOpacity
        className="flex-row"
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.75}
      >
        <View className="w-1.5 bg-primary-400" />

        <View className="flex-1 px-4 py-4 gap-1.5">
          {/* Title + estado */}
          <View className="flex-row items-start justify-between gap-2">
            <Text className="text-base font-semibold text-foreground flex-1" numberOfLines={1}>
              {oferta.titulo}
            </Text>
            <Text className="text-lg text-muted-foreground">{expanded ? '▲' : '▼'}</Text>
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
            {!expanded && tienePendientes ? (
              <Badge
                label={`${pendientes.length} pendiente${pendientes.length > 1 ? 's' : ''}`}
                variant="warning"
                size="sm"
              />
            ) : !expanded && detalle ? (
              <Badge label="Sin pendientes" variant="success" size="sm" />
            ) : null}
          </View>
        </View>
      </TouchableOpacity>

      {/* ── Expandable postulantes section ── */}
      {expanded && (
        <View className="px-4 pb-4 border-t border-border mt-0">
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-3 mb-2">
            Postulantes
          </Text>

          {loadingDetalle ? (
            <View className="py-4 items-center">
              <ActivityIndicator size="small" color="#FF5A3C" />
            </View>
          ) : !detalle?.asignaciones.length ? (
            <Text className="text-sm text-muted-foreground py-2">
              Sin postulantes aún.
            </Text>
          ) : (
            detalle.asignaciones.map((a) => (
              <PostulanteRow
                key={a.id}
                asignacion={a}
                ofertaId={oferta.id}
                confirmarMutation={confirmarMutation}
                rechazarMutation={rechazarMutation}
                cancelarMutation={cancelarMutation}
                noPresentadoMutation={noPresentadoMutation}
              />
            ))
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
  const {
    data: resp,
    isLoading,
    isError,
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
        <Text className="text-base font-semibold text-foreground">Error al cargar turnos</Text>
        <Button label="Reintentar" variant="secondary" onPress={() => refetch()} />
      </View>
    );
  }

  return (
    <FlatList
      data={ofertas}
      keyExtractor={(item) => String(item.id)}
      renderItem={({ item }) => (
        <GestorOfertaItem oferta={item} confirmarMutation={confirmarMutation} rechazarMutation={rechazarMutation} cancelarMutation={cancelarMutation} noPresentadoMutation={noPresentadoMutation} />
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
