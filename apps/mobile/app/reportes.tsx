/**
 * Reportes — resumen de asistencia y costos para admin_empresa, jefe_turnos, jefe_nomina y nomina.
 * Permite seleccionar un rango de fechas y consultar:
 *   - Turnos y Nómina, en páginas que se deslizan de lado (pestañas arriba): costo vs período anterior, desglose, personas y avisos
 *     (la sección de nómina solo la ven admin y jefe de nómina)
 */
import { Text } from '@/components/ui/Text';
import { COLORS, alpha } from '@/lib/designTokens';
import React, { useState, useMemo } from 'react';
import {
  View, Pressable, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { reportesApi } from '@api-client';
import type { AsistenciaTurno, AsistenciaNomina, CostoNominaDetalle } from '@api-client';
import { formatDate, formatCOP, toISODate } from '@/lib/formatters';
import { useRoleGuard } from '@/components/RoleGuard';
import { NominaSeccion, TurnosSeccion } from '@/features/reportes/SeccionesReporte';
import { HeroMarca } from '@/features/reportes/marca';
import { ReportePager } from '@/features/reportes/ReportePager';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { ErrorState } from '@/components/ui/ErrorState';

// ── Rango presets ─────────────────────────────────────────────────────────

interface Preset { label: string; desde: string; hasta: string }

function buildPresets(): Preset[] {
  const now   = new Date();
  const y     = now.getFullYear();
  const m     = now.getMonth();

  const primeroMesActual = new Date(y, m, 1);
  const ultimoMesActual  = new Date(y, m + 1, 0);
  const primeroMesAnt    = new Date(y, m - 1, 1);
  const ultimoMesAnt     = new Date(y, m, 0);
  const hace90           = new Date(now);
  hace90.setDate(now.getDate() - 90);

  return [
    { label: 'Este mes',      desde: toISODate(primeroMesActual), hasta: toISODate(now) },
    { label: 'Mes pasado',  desde: toISODate(primeroMesAnt),    hasta: toISODate(ultimoMesAnt) },
    { label: '3 meses',   desde: toISODate(hace90),            hasta: toISODate(now) },
  ];
}

// ── Hooks ─────────────────────────────────────────────────────────────────

function useAsistencia(desde: string, hasta: string) {
  return useQuery({
    queryKey: ['reportes', 'asistencia', desde, hasta],
    queryFn:  () => reportesApi.asistencia({ desde, hasta }),
    staleTime: 120_000,
  });
}

function useCostos(desde: string, hasta: string) {
  return useQuery({
    queryKey: ['reportes', 'costos', desde, hasta],
    queryFn:  () => reportesApi.costos({ desde, hasta }),
    staleTime: 120_000,
  });
}

// ── Subcomponents ─────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View className="flex-1 bg-card border border-border rounded-2xl p-4 gap-1">
      <Text className="text-xs text-muted-foreground" numberOfLines={1}>{label}</Text>
      <Text className="text-xl font-bold text-foreground">{value}</Text>
      {sub ? <Text className="text-xs text-muted-foreground">{sub}</Text> : null}
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1 mb-3 mt-5">
      {title}
    </Text>
  );
}

function TurnoRow({ t }: { t: AsistenciaTurno }) {
  return (
    <View className="flex-row items-center px-4 py-3 border-b border-border last:border-b-0">
      <View className="flex-1">
        <Text className="text-sm font-medium text-foreground">
          {t.nombre}{t.apellido ? ` ${t.apellido}` : ''}
        </Text>
        <Text className="text-xs text-muted-foreground mt-0.5">
          {t.completados} completados · {t.no_presentados} ausencias
        </Text>
      </View>
      <View className="items-end">
        <Text className="text-sm font-semibold text-foreground">{t.total_turnos}</Text>
        <Text className="text-xs text-muted-foreground">turnos</Text>
      </View>
    </View>
  );
}

function NominaRow({ n }: { n: AsistenciaNomina }) {
  return (
    <View className="flex-row items-center px-4 py-3 border-b border-border last:border-b-0">
      <Text className="flex-1 text-sm font-medium text-foreground">
        {n.nombre}{n.apellido ? ` ${n.apellido}` : ''}
      </Text>
      <View className="items-end">
        <Text className="text-sm font-semibold text-foreground">{n.dias_registrados}</Text>
        <Text className="text-xs text-muted-foreground">días</Text>
      </View>
    </View>
  );
}

function CostoRow({ d }: { d: CostoNominaDetalle }) {
  return (
    <View className="flex-row items-center px-4 py-3 border-b border-border last:border-b-0">
      <Text className="flex-1 text-sm font-medium text-foreground">
        {d.nombre}{d.apellido ? ` ${d.apellido}` : ''}
      </Text>
      <Text className="text-sm font-semibold text-foreground">{formatCOP(d.total)}</Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────

const CUSTOM = -1;

export default function ReportesScreen() {
  const presets = useMemo(buildPresets, []);
  const [presetIdx, setPresetIdx] = useState(0);

  const today = useMemo(() => new Date(), []);
  const [customDesde, setCustomDesde] = useState(today);
  const [customHasta, setCustomHasta] = useState(today);
  const [pickerAbierto, setPickerAbierto] = useState<'desde' | 'hasta' | null>(null);

  const { desde, hasta } = presetIdx === CUSTOM
    ? { desde: toISODate(customDesde), hasta: toISODate(customHasta) }
    : presets[presetIdx];

  function onChangeFecha(campo: 'desde' | 'hasta', _: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setPickerAbierto(null);
    if (!selected) return;
    if (campo === 'desde') setCustomDesde(selected);
    else setCustomHasta(selected);
  }

  const asistencia = useAsistencia(desde, hasta);
  const costos     = useCostos(desde, hasta);

  // Totales de asistencia
  const totalTurnos = useMemo(
    () => (asistencia.data?.turnos ?? []).reduce((s, t) => s + t.total_turnos, 0),
    [asistencia.data]
  );
  const totalAusencias = useMemo(
    () => (asistencia.data?.turnos ?? []).reduce((s, t) => s + t.no_presentados, 0),
    [asistencia.data]
  );

  // Nómina solo para quien la ve (el servidor igual la entrega vacía al jefe de turnos)
  const rol = useAuthStore((s) => s.usuario?.rol) ?? '';
  const verNomina = ['admin_empresa', 'jefe_nomina', 'nomina'].includes(rol);

  const denied = useRoleGuard(['admin_empresa', 'jefe_turnos', 'jefe_nomina', 'nomina']);
  if (denied) return denied;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <StatusBar style="light" />
      <Stack.Screen
        options={{
          title: 'Reportes',
          headerShown: true,
          headerStyle: { backgroundColor: COLORS.primary },
          headerTintColor: COLORS.white,
          headerShadowVisible: false,
        }}
      />

      {/* ── Encabezado de marca con el selector de período ───── */}
        <HeroMarca>
          <Text className="text-xs font-semibold uppercase tracking-widest" style={{ color: COLORS.white }}>
            Resumen de tu operación
          </Text>
          <Text className="text-2xl font-extrabold mt-1" numberOfLines={1} adjustsFontSizeToFit style={{ color: COLORS.white }}>
            {formatDate(desde)} – {formatDate(hasta)}
          </Text>

          <View className="flex-row gap-2 mt-4">
            {[...presets.map((p) => p.label), 'Otro rango'].map((label, i) => {
              const idx = i === presets.length ? CUSTOM : i;
              const activo = idx === presetIdx;
              return (
                <Pressable
                  key={label}
                  onPress={() => setPresetIdx(idx)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activo }}
                  className="flex-1 h-10 rounded-xl items-center justify-center active:opacity-70 px-1"
                  style={{ backgroundColor: activo ? COLORS.white : alpha(COLORS.white, 0.2) }}
                >
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                    className={`text-xs font-bold ${activo ? 'text-primary-700' : ''}`}
                    style={activo ? undefined : { color: COLORS.white }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {presetIdx === CUSTOM && (
            <View className="flex-row gap-2 mt-2">
              {(['desde', 'hasta'] as const).map((campo) => (
                <Pressable
                  key={campo}
                  onPress={() => setPickerAbierto(campo)}
                  className="flex-1 h-10 rounded-xl items-center justify-center flex-row gap-1.5 active:opacity-70"
                  style={{ backgroundColor: alpha(COLORS.white, 0.2) }}
                >
                  <Ionicons name="calendar-outline" size={14} color={COLORS.white} />
                  <Text className="text-xs font-semibold" style={{ color: COLORS.white }}>
                    {campo === 'desde' ? 'Desde' : 'Hasta'} {formatDate(toISODate(campo === 'desde' ? customDesde : customHasta))}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </HeroMarca>

        {pickerAbierto && (
          <View className="px-5 pt-2">
            <DateTimePicker
              value={pickerAbierto === 'desde' ? customDesde : customHasta}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              minimumDate={pickerAbierto === 'hasta' ? customDesde : undefined}
              maximumDate={pickerAbierto === 'desde' ? customHasta : today}
              onChange={(e, d) => onChangeFecha(pickerAbierto, e, d)}
            />
          </View>
        )}

        {(asistencia.isError || costos.isError) && (
          <ErrorState
            compact
            error={asistencia.error ?? costos.error}
            onRetry={() => Promise.all([asistencia.refetch(), costos.refetch()])}
            fallback="No se pudieron cargar algunos datos. Comprueba tu conexión."
          />
        )}

        {/* ── Turnos y nómina: dos páginas que se deslizan, nunca mezcladas ── */}
        <ReportePager
          turnos={
            <TurnosSeccion desde={desde} hasta={hasta}>
              <SectionTitle title="Asistencia por persona" />
              <View className="flex-row gap-3 mb-3">
                <StatCard label="Total turnos" value={String(totalTurnos)} />
                <StatCard label="Ausencias" value={String(totalAusencias)} />
              </View>

              {(asistencia.data?.turnos ?? []).length > 0 ? (
                <View className="bg-card border border-border rounded-2xl overflow-hidden">
                  {asistencia.data!.turnos.map((t) => (
                    <TurnoRow key={t.trabajador_id} t={t} />
                  ))}
                </View>
              ) : (
                <View className="bg-card border border-border rounded-2xl p-6 items-center">
                  <Text className="text-sm text-muted-foreground">
                    Sin turnos en este período
                  </Text>
                </View>
              )}
            </TurnosSeccion>
          }
          nomina={verNomina ? (
            <NominaSeccion desde={desde} hasta={hasta}>
              {(costos.data?.nomina?.detalle ?? []).length > 0 && (
                <>
                  <SectionTitle title="Costo por trabajador" />
                  <View className="bg-card border border-border rounded-2xl overflow-hidden">
                    {costos.data!.nomina!.detalle.map((d) => (
                      <CostoRow key={d.trabajador_id} d={d} />
                    ))}
                  </View>
                </>
              )}

              {(asistencia.data?.nomina ?? []).length > 0 && (
                <>
                  <SectionTitle title="Días registrados por persona" />
                  <View className="bg-card border border-border rounded-2xl overflow-hidden">
                    {asistencia.data!.nomina.map((n) => (
                      <NominaRow key={n.trabajador_id} n={n} />
                    ))}
                  </View>
                </>
              )}
            </NominaSeccion>
          ) : null}
        />
    </SafeAreaView>
  );
}
