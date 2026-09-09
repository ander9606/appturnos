/**
 * Pantalla de postulaciones (gestores / admin_empresa).
 * Tres pestañas — Pendientes / Aceptados / Rechazados — cada una agrupada
 * por fecha → oferta (evento), ordenadas de más reciente a más antigua.
 * Aceptados y Rechazados cargan de a 10 eventos con "Ver más" (Pendientes
 * siempre se ve completa: requiere acción). El filtro por estado va
 * server-side (evita traer confirmados viejos mezclados con lo que
 * realmente necesita acción); Rechazados se filtra client-side por
 * rechazado_por, porque comparte estado='cancelado' con las cancelaciones.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  usePostulacionesPendientes,
  useAsignacionesConfirmadas,
  useAsignacionesRechazadas,
  useConfirmar,
  useRechazar,
  useCancelar,
} from '@/features/turnos/useTurnos';
import { useTheme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { useRoleGuard } from '@/components/RoleGuard';
import { confirm } from '@/lib/confirmDialog';
import type { Asignacion } from '@api-client';

// ── Helpers ───────────────────────────────────────────────────────────────

const SHORT_DAYS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const SHORT_MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function fmtFecha(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return `${SHORT_DAYS[d.getDay()]} ${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}

function fmtHora(h: string) {
  return h.slice(0, 5).replace(/^0/, '');
}

// ── Types para la lista seccional ─────────────────────────────────────────

interface OfertaGroup {
  ofertaId: number;
  titulo: string;
  descripcion: string | null;
  fecha: string;
  horaInicio: string;
  asignaciones: Asignacion[];
}

interface Section {
  title: string;  // "Jue 5 Jun"
  fecha: string;  // "2026-06-05"
  data: OfertaGroup[];
}

// ── PostulanteItem ─────────────────────────────────────────────────────────

function PostulanteItem({
  asignacion,
  confirmarMutation,
  rechazarMutation,
  cancelarMutation,
}: {
  asignacion: Asignacion;
  confirmarMutation: ReturnType<typeof useConfirmar>;
  rechazarMutation:  ReturnType<typeof useRechazar>;
  cancelarMutation:  ReturnType<typeof useCancelar>;
}) {
  const isPending   = asignacion.estado === 'pendiente';
  const isConfirmed = asignacion.estado === 'confirmado';
  const isRechazado = asignacion.estado === 'cancelado' && asignacion.rechazado_por != null;

  const isConfirming =
    confirmarMutation.isPending &&
    (confirmarMutation.variables as { asignacionId: number } | undefined)?.asignacionId === asignacion.id;
  const isRejecting =
    rechazarMutation.isPending &&
    (rechazarMutation.variables as { asignacionId: number } | undefined)?.asignacionId === asignacion.id;
  const isCancelling =
    cancelarMutation.isPending &&
    (cancelarMutation.variables as { asignacionId: number } | undefined)?.asignacionId === asignacion.id;

  const isBusy = confirmarMutation.isPending || rechazarMutation.isPending || cancelarMutation.isPending;

  async function handleRechazar() {
    const ok = await confirm({
      title: 'Rechazar postulación',
      message: `¿Rechazar la postulación de ${asignacion.trabajador_nombre} ${asignacion.trabajador_apellido}?`,
      confirmLabel: 'Rechazar',
      destructive: true,
    });
    if (ok) rechazarMutation.mutate({ asignacionId: asignacion.id, ofertaId: asignacion.oferta_id });
  }

  async function handleCancelar() {
    const ok = await confirm({
      title: 'Cancelar asignación',
      message: `¿Cancelar el turno confirmado de ${asignacion.trabajador_nombre} ${asignacion.trabajador_apellido}? La plaza quedará disponible nuevamente.`,
      cancelLabel: 'Volver',
      confirmLabel: 'Cancelar turno',
      destructive: true,
    });
    if (ok) cancelarMutation.mutate({ asignacionId: asignacion.id, ofertaId: asignacion.oferta_id });
  }

  return (
    <View className="py-2.5 border-b border-border gap-1.5">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 mr-3">
          <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
            {asignacion.trabajador_nombre} {asignacion.trabajador_apellido}
          </Text>
          {asignacion.cargo_nombre ? (
            <Text className="text-xs text-muted-foreground">{asignacion.cargo_nombre}</Text>
          ) : null}
        </View>
      </View>

      {/* Pendiente → Rechazar + Confirmar */}
      {isPending && (
        <View className="flex-row gap-2">
          <Button label={isRejecting ? '…' : 'Rechazar'} variant="danger" size="sm"
            loading={isRejecting} disabled={isBusy} onPress={handleRechazar} />
          <Button label={isConfirming ? '…' : 'Confirmar'} variant="success" size="sm"
            loading={isConfirming} disabled={isBusy}
            onPress={() => confirmarMutation.mutate({ asignacionId: asignacion.id, ofertaId: asignacion.oferta_id })} />
        </View>
      )}

      {/* Confirmado → chip Aceptado + Cancelar turno */}
      {isConfirmed && (
        <View className="flex-row items-center gap-2">
          <View className="flex-row items-center gap-1 bg-success-light px-3 py-1.5 rounded-xl">
            <Ionicons name="checkmark-circle" size={14} color="#059669" />
            <Text className="text-xs font-semibold text-success">Aceptado</Text>
          </View>
          <Button label={isCancelling ? '…' : 'Cancelar turno'} variant="danger" size="sm"
            loading={isCancelling} disabled={isBusy} onPress={handleCancelar} />
        </View>
      )}

      {/* Rechazado → solo chip, es un estado final sin acciones */}
      {isRechazado && (
        <View className="flex-row items-center gap-1 self-start bg-danger-light px-3 py-1.5 rounded-xl">
          <Ionicons name="close-circle" size={14} color="#EF4444" />
          <Text className="text-xs font-semibold text-danger">Rechazado</Text>
        </View>
      )}
    </View>
  );
}

// ── OfertaCard ────────────────────────────────────────────────────────────

function OfertaCard({
  group,
  confirmarMutation,
  rechazarMutation,
  cancelarMutation,
}: {
  group: OfertaGroup;
  confirmarMutation: ReturnType<typeof useConfirmar>;
  rechazarMutation:  ReturnType<typeof useRechazar>;
  cancelarMutation:  ReturnType<typeof useCancelar>;
}) {
  const router = useRouter();

  return (
    <View
      className="bg-card rounded-2xl overflow-hidden mb-3"
      style={{ elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6 }}
    >
      {/* Cabecera de la oferta — toca para ver el detalle completo del evento */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push(`/oferta/${group.ofertaId}` as any)}
        className="flex-row"
      >
        <View className="w-1.5 bg-primary-400" />
        <View className="flex-1 px-4 pt-3 pb-2 gap-0.5">
          <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
            {group.titulo}
          </Text>
          <View className="flex-row items-center gap-1 flex-wrap">
            <Ionicons name="calendar-outline" size={11} color="#64748B" />
            <Text className="text-xs text-muted-foreground">
              {fmtFecha(group.fecha)}
            </Text>
            <Ionicons name="time-outline" size={11} color="#64748B" style={{ marginLeft: 6 }} />
            <Text className="text-xs text-muted-foreground">
              {fmtHora(group.horaInicio)}
            </Text>
            <Text className="text-xs text-muted-foreground ml-2">
              {group.asignaciones.length} postulante{group.asignaciones.length !== 1 ? 's' : ''}
            </Text>
          </View>
          {group.descripcion ? (
            <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={2}>
              {group.descripcion}
            </Text>
          ) : null}
        </View>
        <View className="items-center justify-center pr-3">
          <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
        </View>
      </TouchableOpacity>

      {/* Lista de postulantes */}
      <View className="px-4 pb-2">
        {group.asignaciones.map((a) => (
          <PostulanteItem
            key={a.id}
            asignacion={a}
            confirmarMutation={confirmarMutation}
            rechazarMutation={rechazarMutation}
            cancelarMutation={cancelarMutation}
          />
        ))}
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

export default function PostulacionesScreen() {
  const router  = useRouter();
  const theme   = useTheme();
  const [tab, setTab] = useState<'pendientes' | 'aceptados' | 'rechazados'>('pendientes');

  const pendientesQuery  = usePostulacionesPendientes();
  const aceptadosQuery   = useAsignacionesConfirmadas({ enabled: tab === 'aceptados' });
  const rechazadosQuery  = useAsignacionesRechazadas({ enabled: tab === 'rechazados' });
  const { data: resp, isLoading, isRefetching, isError, refetch } =
    tab === 'pendientes' ? pendientesQuery : tab === 'aceptados' ? aceptadosQuery : rechazadosQuery;

  const confirmarMutation = useConfirmar();
  const rechazarMutation  = useRechazar();
  const cancelarMutation  = useCancelar();

  const totalPendientes = pendientesQuery.data?.data.length ?? 0;

  // Aceptados/Rechazados cargan de a PAGE_SIZE eventos (más recientes primero);
  // Pendientes siempre se ve completa porque requiere acción del gestor.
  const paginaPorEventos = tab !== 'pendientes';
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => setVisibleCount(PAGE_SIZE), [tab]);

  const grupos: OfertaGroup[] = useMemo(() => {
    let asignaciones = resp?.data ?? [];
    // Rechazar deja estado='cancelado', igual que cancelar un confirmado —
    // solo lo rechazado desde "pendiente" trae rechazado_por.
    if (tab === 'rechazados') {
      asignaciones = asignaciones.filter((a) => a.rechazado_por != null);
    }
    // Agrupar por oferta_id (el evento/turno al que pertenece cada postulante)
    const byOferta = new Map<number, OfertaGroup>();
    for (const a of asignaciones) {
      if (!byOferta.has(a.oferta_id)) {
        byOferta.set(a.oferta_id, {
          ofertaId: a.oferta_id,
          titulo: a.oferta_titulo,
          descripcion: a.oferta_descripcion,
          fecha: a.oferta_fecha,
          horaInicio: a.hora_inicio,
          asignaciones: [],
        });
      }
      byOferta.get(a.oferta_id)!.asignaciones.push(a);
    }
    // Más reciente primero.
    return Array.from(byOferta.values()).sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [resp, tab]);

  const gruposVisibles = paginaPorEventos ? grupos.slice(0, visibleCount) : grupos;
  const hayMasEventos  = paginaPorEventos && grupos.length > gruposVisibles.length;

  const sections: Section[] = useMemo(() => {
    const byFecha = new Map<string, OfertaGroup[]>();
    for (const g of gruposVisibles) {
      if (!byFecha.has(g.fecha)) byFecha.set(g.fecha, []);
      byFecha.get(g.fecha)!.push(g);
    }
    return Array.from(byFecha.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([fecha, data]) => ({ title: fmtFecha(fecha), fecha, data }));
  }, [gruposVisibles]);

  const totalTab = grupos.reduce((s, g) => s + g.asignaciones.length, 0);

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  const denied = useRoleGuard(['admin_empresa', 'jefe_turnos']);
  if (denied) return denied;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <View className="flex-row items-center px-5 pt-4 pb-3 gap-3 border-b border-border bg-card">
          <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 items-center justify-center rounded-xl bg-background" hitSlop={8}>
            <Ionicons name="arrow-back" size={20} color={theme.primary} />
          </TouchableOpacity>
          <Text className="text-lg font-bold text-foreground">Postulaciones</Text>
        </View>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <View className="flex-row items-center px-5 pt-4 pb-3 gap-3 border-b border-border bg-card">
          <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 items-center justify-center rounded-xl bg-background" hitSlop={8}>
            <Ionicons name="arrow-back" size={20} color={theme.primary} />
          </TouchableOpacity>
          <Text className="text-lg font-bold text-foreground">Postulaciones</Text>
        </View>
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <Ionicons name="warning-outline" size={48} color="#94A3B8" />
          <Text className="text-base font-semibold text-foreground text-center">Error al cargar postulaciones</Text>
          <Button label="Reintentar" variant="secondary" onPress={() => refetch()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View className="flex-row items-center px-5 pt-4 pb-3 gap-3 border-b border-border bg-card">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-9 h-9 items-center justify-center rounded-xl bg-background"
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={20} color={theme.primary} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-lg font-bold text-foreground">Postulaciones</Text>
        </View>
      </View>

      {/* ── Tabs Pendientes / Aceptados / Rechazados ────────────────────── */}
      <View className="flex-row gap-2 px-5 pt-3 pb-1 bg-card border-b border-border">
        {([
          { key: 'pendientes' as const, label: 'Pendientes', count: totalPendientes },
          { key: 'aceptados' as const, label: 'Aceptados', count: tab === 'aceptados' ? totalTab : undefined },
          { key: 'rechazados' as const, label: 'Rechazados', count: tab === 'rechazados' ? totalTab : undefined },
        ]).map((opt) => {
          const active = tab === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              onPress={() => setTab(opt.key)}
              className={`flex-1 py-2 mb-2 rounded-full items-center ${active ? 'bg-primary/10' : 'bg-background'}`}
            >
              <Text className={`text-sm font-semibold ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                {opt.label}{opt.count != null ? ` (${opt.count})` : ''}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── List ───────────────────────────────────────────────────────── */}
      {sections.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <View
            className="w-20 h-20 rounded-full items-center justify-center"
            style={{ backgroundColor: `${theme.primary}18` }}
          >
            <Ionicons name="checkmark-done-outline" size={36} color={theme.primary} />
          </View>
          <Text className="text-base font-semibold text-foreground text-center">
            {tab === 'pendientes' ? 'Sin postulaciones pendientes' : tab === 'aceptados' ? 'Sin aceptados' : 'Sin rechazados'}
          </Text>
          <Text className="text-sm text-muted-foreground text-center">
            {tab === 'pendientes'
              ? 'Todas las postulaciones han sido revisadas.'
              : tab === 'aceptados'
              ? 'Todavía no hay trabajadores confirmados.'
              : 'No hay postulaciones rechazadas.'}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(group) => String(group.ofertaId)}
          renderSectionHeader={({ section }) => (
            <View className="pt-5 pb-2 px-5 bg-background">
              <Text className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                {section.title}
              </Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View className="px-5">
              <OfertaCard
                group={item}
                confirmarMutation={confirmarMutation}
                rechazarMutation={rechazarMutation}
                cancelarMutation={cancelarMutation}
              />
            </View>
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={onRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
          ListFooterComponent={
            hayMasEventos ? (
              <View className="px-5 pt-1 pb-2">
                <Button
                  label={`Ver ${Math.min(PAGE_SIZE, grupos.length - gruposVisibles.length)} más`}
                  variant="secondary"
                  onPress={() => setVisibleCount((v) => v + PAGE_SIZE)}
                />
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
          stickySectionHeadersEnabled={false}
        />
      )}
    </SafeAreaView>
  );
}
