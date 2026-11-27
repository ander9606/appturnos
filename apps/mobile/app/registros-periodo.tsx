/**
 * Registros del período — vista del jefe_nomina / admin_empresa.
 *
 * Muestra todos los registros diarios del período agrupados por trabajador.
 * Permite editar tipo_dia y novedad de registros existentes, y crear
 * registros nuevos para días sin marcaje.
 */
import { Text } from '@/components/ui/Text';
import { SkeletonList } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChipsIconoNumero } from '@/features/nomina/ChipsIconoNumero';
import { COLORS } from '@/lib/designTokens';
import React, { useState } from 'react';
import { View, SectionList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRegistros } from '@/features/nomina/useNomina';
import { useCompensatoriosTodos } from '@/features/nomina/compensatorios/useCompensatorios';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { useRoleGuard } from '@/components/RoleGuard';
import {
  calcularResumenPeriodo,
  aplicarHorasPrevias,
  aplicarCompensatorios,
  creditosDeCompensatorios,
  etiquetaPeriodo,
  novedadesDeRegistros,
  fmtFechaCorta,
} from '@/features/nomina/trabajador/nominaTrabajadorUtils';
import { SemanaRow } from '@/features/nomina/trabajador/components/ResumenCards';
import { useHorasPreviasSemana } from '@/features/nomina/useHorasPreviasSemana';
import { bogotaToday } from '@/lib/formatters';
import type { ResumenPeriodoNomina } from '@/features/nomina/trabajador/nominaTrabajadorUtils';
import type { RegistroDiario, DescansoCompensatorio } from '@api-client';
import { ErrorState } from '@/components/ui/ErrorState';
import { CrearRegistroModal } from '@/features/nomina/registros/CrearRegistroModal';
import type { CreandoState } from '@/features/nomina/registros/CrearRegistroModal';
import { EditarRegistroModal } from '@/features/nomina/registros/EditarRegistroModal';
import { ReasignarCompensatorioModal } from '@/features/nomina/registros/ReasignarCompensatorioModal';
import { UbicacionMarcajeModal } from '@/features/nomina/registros/UbicacionMarcajeModal';
import { RegistroRow } from '@/features/nomina/registros/RegistroRow';

/** Copia del Set con `id` agregado o quitado. */
function conAlternado(prev: Set<number>, id: number): Set<number> {
  const next = new Set(prev);
  if (!next.delete(id)) next.add(id);
  return next;
}

// ── Pantalla principal ────────────────────────────────────────────────────

type Seccion = {
  title:        string;
  trabajadorId: number;
  /** Total de días del trabajador; `data` queda vacío si la sección está replegada. */
  totalDias:    number;
  resumen:      ResumenPeriodoNomina;
  /** Lo que el gestor debe mirar de este trabajador. */
  novedades:    Novedades;
  data:         RegistroDiario[];
};

interface Novedades { sinSalida: number; sospechosos: number; compPendientes: number }

export default function RegistrosPeriodoScreen() {
  const { periodoId, trabajadorId, fechaInicio, fechaFin } = useLocalSearchParams<{
    periodoId: string; trabajadorId?: string; fechaInicio?: string; fechaFin?: string;
  }>();
  const numId        = Number(periodoId);
  const numTrabId    = trabajadorId ? Number(trabajadorId) : undefined;
  const rol          = useAuthStore((s) => s.usuario?.rol);
  const canEdit      = rol !== 'nomina';

  const { data, isLoading, isError, error, refetch } = useRegistros({
    periodo_id:    numId,
    trabajador_id: numTrabId,
    limit:         500,
  });
  const [editando, setEditando] = useState<RegistroDiario | null>(null);
  const [creando,  setCreando]  = useState<CreandoState>(null);
  const [semanasAbiertas, setSemanasAbiertas] = useState<Set<number>>(new Set());
  const toggleSemanas = (trabajadorId: number) => setSemanasAbiertas((prev) => conAlternado(prev, trabajadorId));
  // Arrancan replegados (puede haber muchos trabajadores); en la vista de un solo trabajador arranca desplegado.
  const [desplegados, setDesplegados] = useState<Set<number>>(() => new Set(numTrabId ? [numTrabId] : []));
  const toggleDesplegado = (trabajadorId: number) => setDesplegados((prev) => conAlternado(prev, trabajadorId));
  const [reasignando, setReasignando] = useState<DescansoCompensatorio | null>(null);
  const [viendoUbicacion, setViendoUbicacion] = useState<RegistroDiario | null>(null);

  const registros = React.useMemo(() => data?.data ?? [], [data]);
  // La lista llega recortada por `limit`: si hay más, hay que decirlo (si no, parece que faltan días).
  const totalRegistros = data?.pagination?.total ?? registros.length;
  const recortado = totalRegistros > registros.length;
  // Si el período empezó a mitad de semana, las horas de esa semana en el período anterior cuentan para las 42 h.
  const previas = useHorasPreviasSemana(registros);

  const { data: compensatorios = [] } = useCompensatoriosTodos();
  /** El registro del día 'compensatorio' no guarda el id del descanso — se cruza por trabajador_id + fecha, mismo criterio que usa el backend en compensatorios.service.js. */
  const compensatorioPorDia = React.useMemo(() => {
    const m = new Map<string, DescansoCompensatorio>();
    for (const c of compensatorios) {
      if (c.fecha_asignada) m.set(`${c.trabajador_id}|${c.fecha_asignada}`, c);
    }
    return m;
  }, [compensatorios]);
  function compensatorioDe(r: RegistroDiario): DescansoCompensatorio | undefined {
    return r.tipo_dia === 'compensatorio' ? compensatorioPorDia.get(`${r.trabajador_id}|${r.fecha}`) : undefined;
  }

  // Agrupar y resumir solo depende de los registros; replegar/desplegar no lo recalcula.
  const grupos = React.useMemo(() => {
    const map = new Map<number, { trabajadorId: number; nombre: string; registros: RegistroDiario[] }>();
    for (const r of registros) {
      if (!map.has(r.trabajador_id)) {
        map.set(r.trabajador_id, {
          trabajadorId: r.trabajador_id,
          nombre:       `${r.trabajador_nombre} ${r.trabajador_apellido}`,
          registros:    [],
        });
      }
      map.get(r.trabajador_id)!.registros.push(r);
    }
    const hoy = bogotaToday();
    return Array.from(map.values())
      .map((g) => {
        const n = novedadesDeRegistros(g.registros, hoy);
        const novedades: Novedades = {
          ...n, compPendientes: compensatorios.filter((c) => c.trabajador_id === g.trabajadorId && c.estado === 'pendiente').length,
        };
        return { g, novedades, total: n.sinSalida + n.sospechosos + novedades.compPendientes };
      })
      // Quien tiene algo por revisar va primero; dentro de cada grupo, por nombre.
      .sort((a, b) => b.total - a.total || a.g.nombre.localeCompare(b.g.nombre))
      .map(({ g, novedades }) => ({
        ...g,
        novedades,
        resumen: aplicarCompensatorios(
          aplicarHorasPrevias(calcularResumenPeriodo(g.registros, 0), previas.lunes, previas.porTrabajador.get(g.trabajadorId)),
          creditosDeCompensatorios(compensatorios, g.trabajadorId, bogotaToday()),
        ),
      }));
  }, [registros, previas, compensatorios]);

  const sections: Seccion[] = React.useMemo(() => {
    return grupos.map((g) => ({
        title: g.nombre,
        trabajadorId: g.trabajadorId,
        totalDias: g.registros.length,
        resumen: g.resumen,
        novedades: g.novedades,
        data: desplegados.has(g.trabajadorId) ? g.registros : [],
      }));
  }, [grupos, desplegados]);

  const denied = useRoleGuard(['admin_empresa', 'jefe_nomina', 'nomina']);
  if (denied) return denied;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <Stack.Screen options={{ title: numTrabId ? 'Registros del trabajador' : 'Registros del equipo', headerShown: true }} />
        <SkeletonList style={{ paddingHorizontal: 20, paddingTop: 12 }} />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <Stack.Screen options={{ title: numTrabId ? 'Registros del trabajador' : 'Registros del equipo', headerShown: true }} />
        <ErrorState error={error} onRetry={refetch} fallback="No se pudieron cargar los registros" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen options={{ title: numTrabId ? 'Registros del trabajador' : 'Registros del equipo', headerShown: true }} />

      <EditarRegistroModal registro={editando} onClose={() => setEditando(null)} />
      <CrearRegistroModal
        creando={creando}
        periodoId={numId}
        fechaInicio={fechaInicio}
        fechaFin={fechaFin}
        onClose={() => setCreando(null)}
      />
      <ReasignarCompensatorioModal compensatorio={reasignando} onClose={() => setReasignando(null)} />
      <UbicacionMarcajeModal registro={viendoUbicacion} onClose={() => setViendoUbicacion(null)} />

      {sections.length === 0 ? (
        <EmptyState
          title="Sin registros en este período"
          message="Los trabajadores aún no han marcado jornadas en este período."
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={
            <View className="gap-2 pt-3">
              {fechaInicio && fechaFin && (
                <View className="flex-row items-center gap-2">
                  <Ionicons name="calendar-outline" size={14} color={COLORS.mutedForeground} />
                  <Text className="text-xs text-muted-foreground">
                    {etiquetaPeriodo(fechaInicio, fechaFin)} · {fmtFechaCorta(fechaInicio)} – {fmtFechaCorta(fechaFin)}
                  </Text>
                </View>
              )}
              {recortado && (
                <View className="bg-warning-light rounded-xl px-3 py-2 flex-row items-center gap-2">
                  <Ionicons name="alert-circle-outline" size={16} color={COLORS.warning} />
                  <Text className="text-xs text-warning-dark flex-1">
                    Se muestran {registros.length} de {totalRegistros} registros. Abre un trabajador para ver todos sus días.
                  </Text>
                </View>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <RegistroRow
              registro={item}
              onEdit={setEditando}
              canEdit={canEdit}
              compensatorio={compensatorioDe(item)}
              onReasignar={setReasignando}
              onVerUbicacion={setViendoUbicacion}
            />
          )}
          renderSectionHeader={({ section }) => {
            const { resumen } = section;
            const replegado = !desplegados.has(section.trabajadorId);
            const abiertas = !replegado && semanasAbiertas.has(section.trabajadorId);
            // La semana más reciente con registros = "hasta ahora" en la semana.
            const semanaActual = resumen.semanas[resumen.semanas.length - 1];
            const etiqueta = etiquetaPeriodo(fechaInicio, fechaFin);
            return (
              // Fondo sólido + borde propios (no solo texto sobre la página) para que
              // se note dónde termina un trabajador y empieza el siguiente.
              <View className="bg-success-light border border-success/20 rounded-2xl mt-5 mb-2 overflow-hidden">
                <View className="flex-row items-center gap-2 px-3.5 py-2.5">
                  {/* Toca el nombre para replegar / desplegar los registros del trabajador */}
                  <TouchableOpacity
                    onPress={() => toggleDesplegado(section.trabajadorId)}
                    className="flex-1 flex-row items-center gap-2"
                    accessibilityRole="button"
                    accessibilityState={{ expanded: !replegado }}
                    accessibilityLabel={`${replegado ? 'Desplegar' : 'Replegar'} registros de ${section.title}`}
                  >
                    <View className="w-7 h-7 rounded-full bg-success/20 items-center justify-center">
                      <Ionicons name="person-outline" size={14} color={COLORS.success} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-emerald-800" numberOfLines={1}>{section.title}</Text>
                      <Text className="text-[11px] text-emerald-700">
                        {semanaActual && etiqueta !== 'Semana' ? `Semana: ${semanaActual.horasTotales.toFixed(1)}h · ` : ''}
                        {etiqueta}: {resumen.totalHoras.toFixed(1)}h
                      </Text>
                      <NovedadesChips n={section.novedades} />
                    </View>
                    <Text className="text-xs text-emerald-700">· {section.totalDias} días</Text>
                    <Ionicons name={replegado ? 'chevron-down' : 'chevron-up'} size={16} color={COLORS.success} />
                  </TouchableOpacity>
                  {canEdit && (
                    <TouchableOpacity
                      onPress={() => setCreando({ trabajadorId: section.trabajadorId, nombre: section.title })}
                      hitSlop={12}
                      className="w-9 h-9 rounded-full bg-white items-center justify-center"
                    >
                      <Ionicons name="add" size={16} color={COLORS.success} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Desglose semanal (lo que cuenta para extra) */}
                {!replegado && (
                  <TouchableOpacity
                    onPress={() => toggleSemanas(section.trabajadorId)}
                    className="flex-row items-center justify-end gap-1 px-3.5 py-2 border-t border-success/20"
                  >
                    <Text className="text-[11px] text-emerald-700">Por semana (cuenta para extra)</Text>
                    <Ionicons name={abiertas ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.success} />
                  </TouchableOpacity>
                )}
                {abiertas && (
                  <View className="px-3.5 pb-2.5">
                    {resumen.semanas.map((s) => (
                      <SemanaRow
                        key={s.inicioSemana}
                        semana={s}
                        valorHora={0}
                        periodo={fechaInicio && fechaFin ? { fecha_inicio: fechaInicio, fecha_fin: fechaFin } : undefined}
                      />
                    ))}
                  </View>
                )}
              </View>
            );
          }}
          ItemSeparatorComponent={() => <View className="h-2" />}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
        />
      )}
    </SafeAreaView>
  );
}

// ── Qué debe mirar el gestor de este trabajador: ícono + número, sin frases ─────

function NovedadesChips({ n }: { n: Novedades }) {
  return (
    <ChipsIconoNumero
      fondo="bg-white/70"
      items={[
        { cantidad: n.sinSalida,      icono: 'time-outline',         color: COLORS.warning, etiqueta: `${n.sinSalida} días sin salida` },
        { cantidad: n.sospechosos,    icono: 'alert-circle-outline', color: COLORS.danger,  etiqueta: `${n.sospechosos} marcajes sospechosos` },
        { cantidad: n.compPendientes, icono: 'bed-outline',          color: COLORS.info,    etiqueta: `${n.compPendientes} compensatorios pendientes` },
      ]}
    />
  );
}
