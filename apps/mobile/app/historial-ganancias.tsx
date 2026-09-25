/**
 * Historial de ganancias — vista consolidada por período.
 *
 *   trabajador_turnos → total cobrado por período de nómina (turnos completados)
 *   trabajador_nomina → extras por período de nómina (el salario base es fijo,
 *                        se muestra aparte; lo que varía período a período son
 *                        las horas con recargo)
 */
import React, { useMemo, useCallback, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, TouchableOpacity, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { useAuthStore } from '@/features/auth/useAuthStore';
import { useTheme } from '@/lib/theme';
import { formatCOP, formatDate, toISODate } from '@/lib/formatters';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import { Button } from '@/components/ui/Button';
import { PeriodoBadge } from '@/features/nomina/PeriodoBadge';
import { TipoPeriodoBadge } from '@/features/nomina/TipoPeriodoBadge';
import { useMisTurnos } from '@/features/turnos/useTurnos';
import { usePeriodos, useNominaPerfil, useRegistrosHistorial } from '@/features/nomina/useNomina';
import { calcularResumenPeriodo, getValorHora, fmtPeriodo, fmtFechaCorta, TIPO_PERIODO_LABEL_SALARIO, type ResumenPeriodoNomina } from '@/features/nomina/trabajador/nominaTrabajadorUtils';
import type { PeriodoNomina, RegistroDiario, Asignacion } from '@api-client';

export default function HistorialGananciasScreen() {
  const rol = useAuthStore((s) => s.usuario?.rol);
  return rol === 'trabajador_nomina' ? <HistorialNomina /> : <HistorialTurnos />;
}

// ══════════════════════════════════════════════════════════════════════════
// trabajador_turnos — historial por período de nómina
// ══════════════════════════════════════════════════════════════════════════

interface TotalesPeriodo { count: number; horas: number; pago: number }

function turnosDePeriodo(turnos: Asignacion[], periodo: PeriodoNomina): Asignacion[] {
  return turnos.filter(
    (a) => a.estado === 'completado'
      && a.oferta_fecha >= periodo.fecha_inicio
      && a.oferta_fecha <= periodo.fecha_fin,
  );
}

function sumarPeriodo(turnos: Asignacion[]): TotalesPeriodo {
  return turnos.reduce((acc, a) => ({
    count: acc.count + 1,
    horas: acc.horas + (Number(a.horas_trabajadas) || 0),
    pago:  acc.pago  + (Number(a.pago_total) || 0),
  }), { count: 0, horas: 0, pago: 0 });
}

// ── Tabla de turnos agrupada por empresa, paginada de a 10 ────────────────

interface GrupoEmpresa { empresa: string; turnos: Asignacion[]; horas: number; pago: number }

const PAGE_SIZE = 10;

function agruparPorEmpresa(turnos: Asignacion[]): GrupoEmpresa[] {
  const porEmpresa = new Map<string, Asignacion[]>();
  for (const a of turnos) {
    const key = a.empresa_nombre ?? 'Turnos';
    const arr = porEmpresa.get(key) ?? [];
    arr.push(a);
    porEmpresa.set(key, arr);
  }
  return Array.from(porEmpresa.entries())
    .map(([empresa, arr]) => {
      const ordenados = [...arr].sort((a, b) => b.oferta_fecha.localeCompare(a.oferta_fecha));
      const { horas, pago } = sumarPeriodo(ordenados);
      return { empresa, turnos: ordenados, horas, pago };
    })
    .sort((a, b) => b.pago - a.pago);
}

function TablaTurnosPorEmpresa({ turnos, primaryColor, onPressTurno }: {
  turnos: Asignacion[];
  primaryColor: string;
  onPressTurno: (id: number) => void;
}) {
  const grupos = useMemo(() => agruparPorEmpresa(turnos), [turnos]);
  const [visibles, setVisibles] = useState<Record<string, number>>({});

  if (grupos.length === 0) {
    return (
      <View className="py-10 items-center gap-2">
        <Ionicons name="document-text-outline" size={32} color="#94A3B8" />
        <Text className="text-sm text-muted-foreground">Sin turnos completados en este rango.</Text>
      </View>
    );
  }

  return (
    <View className="gap-4">
      {grupos.map((g) => {
        const mostrar = visibles[g.empresa] ?? PAGE_SIZE;
        const filas = g.turnos.slice(0, mostrar);
        const restantes = g.turnos.length - mostrar;
        return (
          <View key={g.empresa} className="bg-card border border-border rounded-2xl overflow-hidden">
            <View className="flex-row items-center justify-between px-4 py-3 bg-muted">
              <Text className="text-sm font-semibold text-foreground flex-1 pr-2" numberOfLines={1}>{g.empresa}</Text>
              <Text className="text-xs font-semibold text-muted-foreground">
                {formatCOP(g.pago)} · {g.horas.toFixed(1)}h
              </Text>
            </View>

            <View className="flex-row px-4 py-2 border-b border-border">
              <Text className="flex-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Fecha / turno</Text>
              <Text className="w-14 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide text-right">Horas</Text>
              <Text className="w-24 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide text-right">Pago</Text>
            </View>

            {filas.map((a) => (
              <TouchableOpacity
                key={a.id}
                onPress={() => onPressTurno(a.id)}
                className="flex-row items-center px-4 py-2.5 border-b border-border last:border-b-0"
              >
                <View className="flex-1 pr-2">
                  <Text className="text-sm text-foreground" numberOfLines={1}>{fmtFechaCorta(a.oferta_fecha)}</Text>
                  <Text className="text-xs text-muted-foreground" numberOfLines={1}>{a.oferta_titulo}</Text>
                </View>
                <Text className="w-14 text-sm text-foreground text-right">{Number(a.horas_trabajadas ?? 0).toFixed(1)}</Text>
                <Text className="w-24 text-sm font-semibold text-foreground text-right">{formatCOP(a.pago_total ?? 0)}</Text>
              </TouchableOpacity>
            ))}

            {restantes > 0 && (
              <TouchableOpacity
                onPress={() => setVisibles((v) => ({ ...v, [g.empresa]: mostrar + PAGE_SIZE }))}
                className="items-center py-3"
              >
                <Text className="text-xs font-semibold" style={{ color: primaryColor }}>
                  Ver más ({restantes} {restantes === 1 ? 'restante' : 'restantes'})
                </Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
}

function HistorialTurnos() {
  const theme = useTheme();
  const router = useRouter();
  const { data: turnos, isLoading: loadingTurnos, isError, error, refetch, isRefetching } = useMisTurnos();
  const { data: periodosResp, isLoading: loadingPeriodos, refetch: refetchPeriodos } = usePeriodos();
  const periodos = periodosResp?.data ?? [];
  const isLoading = loadingTurnos || loadingPeriodos;
  // Sin esto, pull-to-refresh nunca trae el período actualizado tras un
  // cambio de tipo_liquidacion — solo refrescaba los turnos.
  const onRefresh = useCallback(() => { refetch(); refetchPeriodos(); }, [refetch, refetchPeriodos]);
  const irATurno = useCallback((id: number) => router.push(`/turno/${id}`), [router]);

  // Período expandido — tap en una fila muestra el detalle turno por turno.
  const [expandidoId, setExpandidoId] = useState<number | null>(null);

  // Filtro por rango de fechas — alternativa a navegar por período de nómina.
  const today = useMemo(() => new Date(), []);
  const [rangoActivo, setRangoActivo] = useState(false);
  const [customDesde, setCustomDesde] = useState(today);
  const [customHasta, setCustomHasta] = useState(today);
  const [pickerAbierto, setPickerAbierto] = useState<'desde' | 'hasta' | null>(null);

  function onChangeFecha(campo: 'desde' | 'hasta', _: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setPickerAbierto(null);
    if (!selected) return;
    setRangoActivo(true);
    if (campo === 'desde') setCustomDesde(selected);
    else setCustomHasta(selected);
  }

  const desdeISO = toISODate(customDesde);
  const hastaISO = toISODate(customHasta);

  const turnosEnRango = useMemo(() => {
    if (!rangoActivo) return [];
    return (turnos ?? []).filter(
      (a) => a.estado === 'completado' && a.oferta_fecha >= desdeISO && a.oferta_fecha <= hastaISO,
    );
  }, [turnos, rangoActivo, desdeISO, hastaISO]);

  const filas = useMemo(() => {
    const completados = (turnos ?? []).filter((a) => a.estado === 'completado');
    if (completados.length === 0) return [];
    const fechaMin = completados.reduce(
      (min, a) => (a.oferta_fecha < min ? a.oferta_fecha : min),
      completados[0].oferta_fecha,
    );

    const out: { periodo: PeriodoNomina; turnos: Asignacion[]; totales: TotalesPeriodo }[] = [];
    for (const periodo of periodos) {
      if (periodo.fecha_fin < fechaMin) break; // periodos vienen fecha_inicio DESC
      const turnosPeriodo = turnosDePeriodo(completados, periodo);
      if (turnosPeriodo.length > 0) out.push({ periodo, turnos: turnosPeriodo, totales: sumarPeriodo(turnosPeriodo) });
    }
    return out;
  }, [turnos, periodos]);

  const totalHistorico = filas.reduce((s, f) => s + f.totales.pago, 0);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['top']}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center gap-3 px-6" edges={['top']}>
        <Ionicons name="warning-outline" size={48} color="#94A3B8" />
        <Text className="text-base font-semibold text-foreground">
          {apiErrorMessage(error, 'Error al cargar el historial')}
        </Text>
        <Button label="Reintentar" onPress={() => refetch()} variant="secondary" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <FlatList
        data={rangoActivo ? [] : filas}
        keyExtractor={(item) => String(item.periodo.id)}
        contentContainerClassName="gap-2 pb-8"
        contentContainerStyle={{ paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} />}
        ListHeaderComponent={
          <View className="pt-2 pb-4 gap-4">
            <View className="gap-1">
              <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total histórico</Text>
              <Text className="text-3xl font-extrabold" style={{ color: theme.primary }}>
                {formatCOP(totalHistorico)}
              </Text>
              <Text className="text-xs text-muted-foreground">
                {filas.length} {filas.length === 1 ? 'período' : 'períodos'} con turnos completados
              </Text>
            </View>

            {/* Filtro por rango de fechas — alternativa a navegar por período */}
            <View className="gap-2">
              <View className="flex-row items-center gap-2">
                <Pressable
                  onPress={() => setPickerAbierto('desde')}
                  className="flex-1 h-10 rounded-xl bg-muted items-center justify-center flex-row gap-1.5"
                >
                  <Ionicons name="calendar-outline" size={14} color="#64748B" />
                  <Text className="text-xs text-foreground">Desde {formatDate(desdeISO)}</Text>
                </Pressable>
                <Pressable
                  onPress={() => setPickerAbierto('hasta')}
                  className="flex-1 h-10 rounded-xl bg-muted items-center justify-center flex-row gap-1.5"
                >
                  <Ionicons name="calendar-outline" size={14} color="#64748B" />
                  <Text className="text-xs text-foreground">Hasta {formatDate(hastaISO)}</Text>
                </Pressable>
                {rangoActivo && (
                  <TouchableOpacity onPress={() => setRangoActivo(false)} hitSlop={8} accessibilityLabel="Limpiar filtro de fecha">
                    <Ionicons name="close-circle" size={20} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>

              {pickerAbierto && (
                <DateTimePicker
                  value={pickerAbierto === 'desde' ? customDesde : customHasta}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  minimumDate={pickerAbierto === 'hasta' ? customDesde : undefined}
                  maximumDate={pickerAbierto === 'desde' ? customHasta : today}
                  onChange={(e, d) => onChangeFecha(pickerAbierto, e, d)}
                />
              )}
            </View>

            {rangoActivo ? (
              <TablaTurnosPorEmpresa turnos={turnosEnRango} primaryColor={theme.primary} onPressTurno={irATurno} />
            ) : filas.length > 0 ? (
              <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Por período de nómina</Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const expandido = expandidoId === item.periodo.id;
          return (
            <View className="gap-2">
              <TouchableOpacity
                onPress={() => setExpandidoId(expandido ? null : item.periodo.id)}
                activeOpacity={0.7}
                className="bg-card border border-border rounded-2xl px-4 py-3 flex-row items-center justify-between"
              >
                <View className="flex-1 gap-0.5">
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-sm font-semibold text-foreground">{fmtPeriodo(item.periodo)}</Text>
                    <TipoPeriodoBadge tipo={item.periodo.tipo} />
                  </View>
                  <Text className="text-xs text-muted-foreground">
                    {item.totales.count} {item.totales.count === 1 ? 'turno' : 'turnos'} · {item.totales.horas.toFixed(1)}h
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Text className="text-base font-bold text-foreground">
                    {formatCOP(item.totales.pago)}
                  </Text>
                  <Ionicons name={expandido ? 'chevron-up' : 'chevron-down'} size={16} color="#94A3B8" />
                </View>
              </TouchableOpacity>

              {expandido && (
                <View className="pl-3">
                  <TablaTurnosPorEmpresa turnos={item.turnos} primaryColor={theme.primary} onPressTurno={irATurno} />
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          rangoActivo ? null : (
            <View className="py-16 items-center gap-3 px-8">
              <Ionicons name="bar-chart-outline" size={48} color="#94A3B8" />
              <Text className="text-base font-semibold text-foreground text-center">Sin historial aún</Text>
              <Text className="text-sm text-muted-foreground text-center">
                Cuando completes turnos, aparecerán aquí agrupados por período.
              </Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// trabajador_nomina — historial por período de nómina
// ══════════════════════════════════════════════════════════════════════════

function HistorialNomina() {
  const theme = useTheme();
  const { data: perfil } = useNominaPerfil();
  const valorHora = getValorHora(perfil?.salario_base ?? null);

  const { data: periodosResp, isLoading: loadingPeriodos } = usePeriodos();
  const periodos = periodosResp?.data ?? [];

  const {
    data: registrosResp,
    isLoading: loadingRegistros,
    isError, error, refetch, isRefetching,
  } = useRegistrosHistorial();
  const registros = registrosResp?.data ?? [];

  const filas = useMemo(() => {
    const porPeriodo = new Map<number, RegistroDiario[]>();
    for (const r of registros) {
      const arr = porPeriodo.get(r.periodo_id) ?? [];
      arr.push(r);
      porPeriodo.set(r.periodo_id, arr);
    }
    const out: { periodo: PeriodoNomina; resumen: ResumenPeriodoNomina }[] = [];
    for (const p of periodos) {
      const regs = porPeriodo.get(p.id);
      if (!regs) continue;
      out.push({ periodo: p, resumen: calcularResumenPeriodo(regs, valorHora) });
    }
    return out.sort((a, b) => b.periodo.fecha_inicio.localeCompare(a.periodo.fecha_inicio));
  }, [periodos, registros, valorHora]);

  const totalExtraHistorico = filas.reduce((s, f) => s + f.resumen.valorExtraCOP, 0);
  const isLoading = loadingPeriodos || loadingRegistros;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['top']}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center gap-3 px-6" edges={['top']}>
        <Ionicons name="warning-outline" size={48} color="#94A3B8" />
        <Text className="text-base font-semibold text-foreground">
          {apiErrorMessage(error, 'Error al cargar el historial')}
        </Text>
        <Button label="Reintentar" onPress={() => refetch()} variant="secondary" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <FlatList
        data={filas}
        keyExtractor={(item) => String(item.periodo.id)}
        contentContainerClassName="gap-2 pb-8"
        contentContainerStyle={{ paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} colors={[theme.primary]} />}
        ListHeaderComponent={
          <View className="pt-2 pb-4 gap-3">
            <View className="gap-1">
              <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {filas.length > 0 ? TIPO_PERIODO_LABEL_SALARIO[filas[0].periodo.tipo] : TIPO_PERIODO_LABEL_SALARIO.mensual}
              </Text>
              <Text className="text-2xl font-extrabold text-foreground">
                {perfil?.salario_base != null ? formatCOP(perfil.salario_base) : '—'}
              </Text>
            </View>
            <View className="gap-1">
              <Text className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Extras acumulados</Text>
              <Text className="text-2xl font-extrabold" style={{ color: theme.primary }}>
                +{formatCOP(totalExtraHistorico)}
              </Text>
              <Text className="text-xs text-muted-foreground">
                {filas.length} {filas.length === 1 ? 'período con registros' : 'períodos con registros'}
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View className="bg-card border border-border rounded-2xl px-4 py-3 gap-1.5">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-foreground">{fmtPeriodo(item.periodo)}</Text>
              <View className="flex-row items-center gap-1.5">
                <PeriodoBadge estado={item.periodo.estado} />
                <TipoPeriodoBadge tipo={item.periodo.tipo} />
              </View>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-muted-foreground">
                {item.resumen.diasRegistrados} días · {item.resumen.totalHoras.toFixed(1)}h
              </Text>
              <Text className={`text-sm font-bold ${item.resumen.valorExtraCOP > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                {item.resumen.valorExtraCOP > 0 ? `+${formatCOP(item.resumen.valorExtraCOP)}` : '$0 extra'}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View className="py-16 items-center gap-3 px-8">
            <Ionicons name="bar-chart-outline" size={48} color="#94A3B8" />
            <Text className="text-base font-semibold text-foreground text-center">Sin historial aún</Text>
            <Text className="text-sm text-muted-foreground text-center">
              Cuando se cierren períodos con registros tuyos, aparecerán aquí.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
