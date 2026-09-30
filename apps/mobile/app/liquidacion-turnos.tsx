/**
 * Liquidación de turnos — app/liquidacion-turnos.tsx
 *
 * Gestores ven cuánto se le debe pagar a cada trabajador por sus turnos
 * completados en el período seleccionado.  Cada card es expandible para
 * ver el desglose turno por turno (pago base + extra + total).
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useLiquidacionTurnos } from '@/features/turnos/useTurnos';
import { usePeriodos } from '@/features/nomina/useNomina';
import { PeriodoSelector } from '@/features/nomina/PeriodoSelector';
import { TipoPeriodoBadge } from '@/features/nomina/TipoPeriodoBadge';
import { fmtPeriodo } from '@/features/nomina/trabajador/nominaTrabajadorUtils';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/lib/theme';
import { useRoleGuard } from '@/components/RoleGuard';
import type { LiquidacionTurnosTrabajador, LiquidacionTurnoLinea } from '@api-client';

type Vista = 'trabajador' | 'turno';

interface TurnoGrupo {
  oferta_id: number;
  oferta_titulo: string;
  oferta_fecha: string;
  lugar: string | null;
  hora_inicio: string;
  hora_fin_estimada: string | null;
  total_horas: number;
  total_pago: number;
  pendientes_firma: number;
  lineas: (LiquidacionTurnoLinea & { trabajador_id: number; nombre: string; apellido: string })[];
}

/** Misma liquidación, reagrupada por turno en vez de por trabajador — útil
 *  para ver de un vistazo cuánta gente cubrió un turno puntual y su costo total. */
function agruparPorTurno(trabajadores: LiquidacionTurnosTrabajador[]): TurnoGrupo[] {
  const grupos = new Map<number, TurnoGrupo>();
  for (const w of trabajadores) {
    for (const t of w.turnos) {
      let g = grupos.get(t.oferta_id);
      if (!g) {
        g = {
          oferta_id: t.oferta_id,
          oferta_titulo: t.oferta_titulo,
          oferta_fecha: t.oferta_fecha,
          lugar: t.lugar,
          hora_inicio: t.hora_inicio,
          hora_fin_estimada: t.hora_fin_estimada,
          total_horas: 0,
          total_pago: 0,
          pendientes_firma: 0,
          lineas: [],
        };
        grupos.set(t.oferta_id, g);
      }
      g.lineas.push({ ...t, trabajador_id: w.trabajador_id, nombre: w.nombre, apellido: w.apellido });
      // Mismo criterio que el total por trabajador: un turno sin firmar no
      // cuenta en el total a pagar todavía (ver asignaciones.liquidacion.model.js).
      if (t.firmado_trabajador) {
        g.total_horas += t.horas_trabajadas;
        g.total_pago += t.pago_total;
      } else {
        g.pendientes_firma++;
      }
    }
  }
  return Array.from(grupos.values()).sort((a, b) => (a.oferta_fecha < b.oferta_fecha ? 1 : -1));
}

// ── Helpers ───────────────────────────────────────────────────────────────

const SHORT_DAYS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const SHORT_MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${SHORT_DAYS[d.getDay()]} ${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}
function fmtHora(ts: string | null): string {
  if (!ts) return '—';
  // ts puede ser "2026-06-03 06:10:00" o "2026-06-03T06:10:00"
  const parts = ts.replace('T', ' ').split(' ');
  return parts[1]?.slice(0, 5) ?? '—';
}
function cop(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-CO');
}

// ── TurnoLineaRow ─────────────────────────────────────────────────────────

function TurnoLineaRow({ t, primary }: { t: LiquidacionTurnoLinea; primary: string }) {
  const router = useRouter();
  const hasExtra = t.pago_extra > 0;
  const hasBono = t.bono_monto > 0;
  return (
    <TouchableOpacity
      onPress={() => router.push(`/turno/${t.asignacion_id}`)}
      activeOpacity={0.7}
      className="py-3 border-b border-border last:border-b-0"
    >
      {/* Fila 1: fecha + monto */}
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
            {t.oferta_titulo}
          </Text>
          <Text className="text-xs text-muted-foreground mt-0.5">
            {fmtDate(t.oferta_fecha)}
            {t.lugar ? `  ·  ${t.lugar}` : ''}
          </Text>
        </View>
        <Text className="text-sm font-bold text-foreground">{cop(t.pago_total)}</Text>
      </View>

      {/* Fila 2: horas + desglose pago */}
      <View className="flex-row items-center gap-3 mt-1.5 flex-wrap">
        <View className="flex-row items-center gap-1">
          <Ionicons name="time-outline" size={12} color="#64748B" />
          <Text className="text-xs text-muted-foreground">
            {fmtHora(t.hora_ingreso_real)} – {fmtHora(t.hora_egreso_real)}
            {'  '}({t.horas_trabajadas.toFixed(1)}h)
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Ionicons name="cash-outline" size={12} color="#64748B" />
          <Text className="text-xs text-muted-foreground">
            Base: {cop(t.pago_total - t.pago_extra - t.bono_monto)}
          </Text>
        </View>
        {hasExtra && (
          <View className="bg-amber-100 px-2 py-0.5 rounded-full">
            <Text className="text-[10px] font-semibold text-amber-700">
              Extra +{cop(t.pago_extra)}
            </Text>
          </View>
        )}
        {hasBono && (
          <View className="bg-success-light px-2 py-0.5 rounded-full">
            <Text className="text-[10px] font-semibold text-success">
              Bono +{cop(t.bono_monto)}
            </Text>
          </View>
        )}
        {t.calificacion != null ? (
          <View className="flex-row items-center gap-0.5">
            <Ionicons name="star" size={11} color="#F59E0B" />
            <Text className="text-xs text-muted-foreground">{t.calificacion}</Text>
          </View>
        ) : (
          <View className="flex-row items-center gap-0.5">
            <Ionicons name="star-outline" size={11} color="#94A3B8" />
            <Text className="text-xs text-muted-foreground">Calificar</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── TrabajadorCard ────────────────────────────────────────────────────────

function TrabajadorCard({
  item,
  primary,
}: {
  item: LiquidacionTurnosTrabajador;
  primary: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasExtra = item.pago_extra > 0;
  const hasBono = item.bono_monto > 0;

  return (
    <View
      className="bg-card rounded-2xl overflow-hidden"
      style={{ elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}
    >
      {/* ── Header: nombre + monto a pagar, visibles sin expandir ─────── */}
      <TouchableOpacity
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.75}
        className="flex-row"
      >
        {/* Barra lateral de color */}
        <View className="w-1.5" style={{ backgroundColor: primary }} />

        <View className="flex-1 px-4 py-4 flex-row items-center gap-3">
          {/* Nombre + meta */}
          <View className="flex-1 gap-1">
            <Text className="text-base font-bold text-foreground" numberOfLines={1}>
              {item.nombre} {item.apellido}
            </Text>
            <View className="flex-row items-center gap-3 flex-wrap">
              {item.cargo && (
                <Text className="text-xs text-muted-foreground">{item.cargo}</Text>
              )}
              {item.ranking != null && (
                <View className="flex-row items-center gap-0.5">
                  <Ionicons name="star" size={11} color="#F59E0B" />
                  <Text className="text-xs text-muted-foreground">{Number(item.ranking).toFixed(1)}</Text>
                </View>
              )}
              <Text className="text-xs text-muted-foreground">
                {item.total_turnos} turno{item.total_turnos !== 1 ? 's' : ''} · {item.total_horas.toFixed(1)}h
              </Text>
            </View>
            {hasExtra && (
              <View className="bg-amber-100 self-start px-2 py-0.5 rounded-full mt-0.5">
                <Text className="text-[10px] font-semibold text-amber-700">
                  Incluye {cop(item.pago_extra)} extra
                </Text>
              </View>
            )}
            {hasBono && (
              <View className="bg-success-light self-start px-2 py-0.5 rounded-full mt-0.5">
                <Text className="text-[10px] font-semibold text-success">
                  Incluye {cop(item.bono_monto)} en bonos
                </Text>
              </View>
            )}
          </View>

          {/* Monto a pagar + chevron */}
          <View className="items-end gap-0.5">
            <Text className="text-lg font-bold" style={{ color: primary }}>
              {cop(item.pago_total)}
            </Text>
            <View className="flex-row items-center gap-0.5">
              <Text className="text-[10px] text-muted-foreground">A pagar</Text>
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={14}
                color="#94A3B8"
              />
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* ── Detalle de turnos (expandible) ──────────────────────────── */}
      {expanded && (
        <View className="px-4 pb-4 border-t border-border">
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-3 mb-1">
            Desglose por turno
          </Text>
          {item.turnos.map((t) => (
            <TurnoLineaRow key={t.asignacion_id} t={t} primary={primary} />
          ))}
          {/* Totales */}
          <View className="flex-row justify-end items-center gap-6 pt-3 border-t border-border mt-1">
            <Text className="text-xs text-muted-foreground">
              {item.total_turnos} turnos · {item.total_horas.toFixed(1)}h
            </Text>
            <Text className="text-base font-bold text-foreground">
              {cop(item.pago_total)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ── TurnoGroupCard ────────────────────────────────────────────────────────

function TurnoGroupCard({ item, primary }: { item: TurnoGrupo; primary: string }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  return (
    <View
      className="bg-card rounded-2xl overflow-hidden"
      style={{ elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}
    >
      <TouchableOpacity onPress={() => setExpanded((v) => !v)} activeOpacity={0.75} className="flex-row">
        <View className="w-1.5" style={{ backgroundColor: primary }} />
        <View className="flex-1 px-4 py-4 flex-row items-center gap-3">
          <View className="flex-1 gap-1">
            <Text className="text-base font-bold text-foreground" numberOfLines={1}>
              {item.oferta_titulo}
            </Text>
            <View className="flex-row items-center gap-3 flex-wrap">
              <Text className="text-xs text-muted-foreground">{fmtDate(item.oferta_fecha)}</Text>
              {item.lugar && (
                <Text className="text-xs text-muted-foreground" numberOfLines={1}>{item.lugar}</Text>
              )}
              <Text className="text-xs text-muted-foreground">
                {item.lineas.length} trabajador{item.lineas.length !== 1 ? 'es' : ''} · {item.total_horas.toFixed(1)}h
              </Text>
            </View>
            {item.pendientes_firma > 0 && (
              <View className="bg-warning/10 self-start px-2 py-0.5 rounded-full mt-0.5 flex-row items-center gap-1">
                <Ionicons name="alert-circle-outline" size={11} color="#D97706" />
                <Text className="text-[10px] font-semibold text-warning">
                  {item.pendientes_firma} sin firmar
                </Text>
              </View>
            )}
          </View>
          <View className="items-end gap-0.5">
            <Text className="text-lg font-bold" style={{ color: primary }}>{cop(item.total_pago)}</Text>
            <View className="flex-row items-center gap-0.5">
              <Text className="text-[10px] text-muted-foreground">Costo total</Text>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="#94A3B8" />
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View className="px-4 pb-4 border-t border-border">
          <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-3 mb-1">
            Trabajadores asignados
          </Text>
          {item.lineas.map((l) => (
            <TouchableOpacity
              key={l.asignacion_id}
              onPress={() => router.push(`/turno/${l.asignacion_id}`)}
              activeOpacity={0.7}
              className="py-3 border-b border-border last:border-b-0 flex-row items-center justify-between gap-2"
            >
              <View className="flex-1">
                <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                  {l.nombre} {l.apellido}
                </Text>
                <View className="flex-row items-center gap-2 mt-0.5 flex-wrap">
                  <Text className="text-xs text-muted-foreground">{l.cargo_nombre}</Text>
                  <Text className="text-xs text-muted-foreground">{l.horas_trabajadas.toFixed(1)}h</Text>
                  {!l.firmado_trabajador && (
                    <View className="flex-row items-center gap-0.5">
                      <Ionicons name="alert-circle-outline" size={11} color="#D97706" />
                      <Text className="text-[10px] font-semibold text-warning">Sin firmar</Text>
                    </View>
                  )}
                </View>
              </View>
              <Text className="text-sm font-bold text-foreground">{cop(l.pago_total)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────

export default function LiquidacionTurnosScreen() {
  const theme  = useTheme();
  const router = useRouter();

  // periodos_nomina — mismo período que ve el trabajador de turnos, no un mes
  // calendario fijo (una empresa quincenal no factura por mes completo).
  const { data: periodosResp, refetch: refetchPeriodos } = usePeriodos();
  const periodos = periodosResp?.data ?? [];
  const [periodoId, setPeriodoId] = useState<number | undefined>(undefined);
  const activePeriodoId = periodoId ?? periodos[0]?.id;
  const periodo = periodos.find((p) => p.id === activePeriodoId);

  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useLiquidacionTurnos(
    { fecha_inicio: periodo?.fecha_inicio ?? '', fecha_fin: periodo?.fecha_fin ?? '' },
    { enabled: periodo !== undefined },
  );

  const trabajadores = data ?? [];
  const [vista, setVista] = useState<Vista>('trabajador');
  const turnosAgrupados = useMemo(() => agruparPorTurno(trabajadores), [trabajadores]);
  const listData: (LiquidacionTurnosTrabajador | TurnoGrupo)[] = vista === 'trabajador' ? trabajadores : turnosAgrupados;

  const totalGeneral = useMemo(
    () => trabajadores.reduce((s, w) => s + w.pago_total, 0),
    [trabajadores]
  );

  const onRefresh = useCallback(() => { refetch(); refetchPeriodos(); }, [refetch, refetchPeriodos]);

  const denied = useRoleGuard(['admin_empresa', 'jefe_turnos']);
  if (denied) return denied;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Liquidación',
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          headerTintColor: theme.primary,
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerShadowVisible: true,
        }}
      />

      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : isError ? (
          <View className="flex-1 items-center justify-center gap-3 px-6">
            <Ionicons name="warning-outline" size={48} color="#94A3B8" />
            <Text className="text-base font-semibold text-foreground text-center">
              Error al cargar la liquidación
            </Text>
            <Button label="Reintentar" variant="secondary" onPress={() => refetch()} />
          </View>
        ) : (
          <FlatList
            data={listData}
            keyExtractor={(item) => ('trabajador_id' in item ? `t-${item.trabajador_id}` : `o-${item.oferta_id}`)}
            contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={onRefresh}
                tintColor={theme.primary}
                colors={[theme.primary]}
              />
            }
            ListHeaderComponent={
              <View className="mb-2 gap-3">
                {/* Período */}
                <View className="gap-2">
                  <PeriodoSelector periodos={periodos} activeId={activePeriodoId} onSelect={setPeriodoId} />
                  {periodo && (
                    <View className="flex-row items-center gap-1.5">
                      <Text className="text-base font-semibold text-foreground">
                        {fmtPeriodo(periodo)}
                      </Text>
                      <TipoPeriodoBadge tipo={periodo.tipo} />
                    </View>
                  )}
                </View>

                {/* Vista: por trabajador (quién cobra cuánto) o por turno (qué costó cada evento) */}
                <View className="flex-row gap-2">
                  {([
                    { v: 'trabajador' as const, label: 'Por trabajador' },
                    { v: 'turno' as const, label: 'Por turno' },
                  ]).map(({ v, label }) => {
                    const active = vista === v;
                    return (
                      <TouchableOpacity
                        key={v}
                        onPress={() => setVista(v)}
                        className="flex-1 h-9 rounded-xl items-center justify-center border"
                        style={{
                          backgroundColor: active ? theme.primary : 'transparent',
                          borderColor: active ? theme.primary : '#E2E8F0',
                        }}
                      >
                        <Text className={`text-sm font-semibold ${active ? 'text-white' : 'text-muted-foreground'}`}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Resumen global */}
                {trabajadores.length > 0 && (
                  <View
                    className="rounded-2xl px-5 py-4 flex-row items-center justify-between"
                    style={{ backgroundColor: theme.primary + '15' }}
                  >
                    <View className="gap-0.5">
                      <Text className="text-xs font-medium" style={{ color: theme.primary + 'AA' }}>
                        Total a pagar
                      </Text>
                      <Text className="text-2xl font-bold" style={{ color: theme.primary }}>
                        {cop(totalGeneral)}
                      </Text>
                    </View>
                    <View className="items-end gap-0.5">
                      <Text className="text-xs text-muted-foreground">
                        {trabajadores.length} trabajador{trabajadores.length !== 1 ? 'es' : ''}
                      </Text>
                      <Text className="text-xs text-muted-foreground">
                        {trabajadores.reduce((s, w) => s + w.total_turnos, 0)} turnos completados
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            }
            renderItem={({ item }) => (
              'trabajador_id' in item
                ? <TrabajadorCard item={item} primary={theme.primary} />
                : <TurnoGroupCard item={item} primary={theme.primary} />
            )}
            ItemSeparatorComponent={() => <View className="h-0" />}
            ListEmptyComponent={
              <View className="py-20 items-center gap-3 px-8">
                <Ionicons name="receipt-outline" size={48} color="#CBD5E1" />
                <Text className="text-base font-semibold text-foreground text-center">
                  Sin turnos completados
                </Text>
                <Text className="text-sm text-muted-foreground text-center">
                  No hay asignaciones completadas en el período{periodo ? ` ${fmtPeriodo(periodo)}` : ''}.
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </>
  );
}
