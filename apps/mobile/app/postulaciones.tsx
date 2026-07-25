/**
 * Pantalla de postulaciones (gestores / admin_empresa).
 * Dos pestañas — Pendientes / Confirmados — cada una agrupada por
 * fecha → oferta, con botones de confirmar/rechazar/cancelar inline.
 * El filtro por estado va server-side (evita traer confirmados viejos
 * mezclados con lo que realmente necesita acción).
 */
import React, { useCallback, useMemo, useState } from 'react';
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
  return (
    <View
      className="bg-card rounded-2xl overflow-hidden mb-3"
      style={{ elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6 }}
    >
      {/* Cabecera de la oferta */}
      <View className="flex-row">
        <View className="w-1.5 bg-primary-400" />
        <View className="flex-1 px-4 pt-3 pb-2 gap-0.5">
          <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
            {group.titulo}
          </Text>
          <View className="flex-row items-center gap-1">
            <Ionicons name="time-outline" size={11} color="#64748B" />
            <Text className="text-xs text-muted-foreground">
              {fmtHora(group.horaInicio)}
            </Text>
            <Text className="text-xs text-muted-foreground ml-2">
              {group.asignaciones.length} postulante{group.asignaciones.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      </View>

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

export default function PostulacionesScreen() {
  const router  = useRouter();
  const theme   = useTheme();
  const [tab, setTab] = useState<'pendientes' | 'confirmados'>('pendientes');

  const pendientesQuery  = usePostulacionesPendientes();
  const confirmadosQuery = useAsignacionesConfirmadas({ enabled: tab === 'confirmados' });
  const { data: resp, isLoading, isRefetching, isError, refetch } =
    tab === 'pendientes' ? pendientesQuery : confirmadosQuery;

  const confirmarMutation = useConfirmar();
  const rechazarMutation  = useRechazar();
  const cancelarMutation  = useCancelar();

  const totalPendientes = pendientesQuery.data?.data.length ?? 0;

  const sections: Section[] = useMemo(() => {
    const asignaciones = resp?.data ?? [];
    // Agrupar por fecha → oferta_id (el evento/turno al que pertenece cada postulante)
    const byFecha = new Map<string, Map<number, OfertaGroup>>();

    for (const a of asignaciones) {
      if (!byFecha.has(a.oferta_fecha)) byFecha.set(a.oferta_fecha, new Map());
      const byOferta = byFecha.get(a.oferta_fecha)!;
      if (!byOferta.has(a.oferta_id)) {
        byOferta.set(a.oferta_id, {
          ofertaId: a.oferta_id,
          titulo: a.oferta_titulo,
          fecha: a.oferta_fecha,
          horaInicio: a.hora_inicio,
          asignaciones: [],
        });
      }
      byOferta.get(a.oferta_id)!.asignaciones.push(a);
    }

    return Array.from(byFecha.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, byOferta]) => ({
        title: fmtFecha(fecha),
        fecha,
        data: Array.from(byOferta.values()),
      }));
  }, [resp]);

  const totalTab = sections.reduce((s, sec) => s + sec.data.reduce((s2, g) => s2 + g.asignaciones.length, 0), 0);

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

      {/* ── Tabs Pendientes / Confirmados ─────────────────────────────── */}
      <View className="flex-row gap-2 px-5 pt-3 pb-1 bg-card border-b border-border">
        {([
          { key: 'pendientes' as const, label: 'Pendientes', count: totalPendientes },
          { key: 'confirmados' as const, label: 'Confirmados', count: tab === 'confirmados' ? totalTab : undefined },
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
            {tab === 'pendientes' ? 'Sin postulaciones pendientes' : 'Sin confirmados'}
          </Text>
          <Text className="text-sm text-muted-foreground text-center">
            {tab === 'pendientes' ? 'Todas las postulaciones han sido revisadas.' : 'Todavía no hay trabajadores confirmados.'}
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
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
          stickySectionHeadersEnabled={false}
        />
      )}
    </SafeAreaView>
  );
}
