import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { reportesApi } from '@api-client';
import type { CargoTurnos, HorasPersona, PersonasResponse } from '@api-client';
import { Text } from '@/components/ui/Text';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonStats } from '@/components/ui/Skeleton';
import { COLORS, alpha } from '@/lib/designTokens';
import { formatCOP } from '@/lib/formatters';
import { Insight } from './ResumenPeriodo';

const MAX_FILAS_CARGO = 6;

export function usePersonas(desde: string, hasta: string) {
  return useQuery({
    queryKey: ['reportes', 'personas', desde, hasta],
    queryFn: () => reportesApi.personas({ desde, hasta }),
    staleTime: 120_000,
  });
}

const nombreDe = (p: { nombre: string; apellido: string | null }) => `${p.nombre}${p.apellido ? ` ${p.apellido}` : ''}`;

function Titulo({ children }: { children: string }) {
  return <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1 mb-3 mt-5">{children}</Text>;
}

function FilaHoras({ p, max }: { p: HorasPersona; max: number }) {
  return (
    <View className="px-4 py-3 border-b border-border">
      <View className="flex-row items-center">
        <Text className="flex-1 text-sm font-medium text-foreground" numberOfLines={1}>{nombreDe(p)}</Text>
        <Text className="text-sm font-semibold text-foreground">{p.prom_semana.toLocaleString('es-CO')} h/sem</Text>
      </View>
      <View className="h-1.5 rounded-full mt-2" style={{ backgroundColor: COLORS.muted }}>
        <View className="h-1.5 rounded-full" style={{ width: `${Math.min(100, (p.prom_semana / max) * 100)}%`, backgroundColor: COLORS.primary }} />
      </View>
      <Text className="text-xs text-muted-foreground mt-1">{p.prom_dia.toLocaleString('es-CO')} h por día trabajado · {p.dias} días</Text>
    </View>
  );
}

function Horas({ horas }: { horas: NonNullable<PersonasResponse['horas']> }) {
  if (!horas.ranking.length) return null;
  const max = horas.ranking[0].prom_semana || 1;
  return (
    <>
      <Titulo>Horas por persona (promedio semanal)</Titulo>
      <Text className="text-xs text-muted-foreground px-1 -mt-2 mb-3">
        Promedio del equipo: {horas.prom_semana_equipo?.toLocaleString('es-CO')} h por semana
      </Text>
      <Text className="text-xs font-semibold text-foreground px-1 mb-2">Más horas</Text>
      <View className="bg-card border border-border rounded-2xl overflow-hidden">
        {horas.mas.map((p) => <FilaHoras key={p.trabajador_id} p={p} max={max} />)}
      </View>
      {horas.menos.length > 0 && (
        <>
          <Text className="text-xs font-semibold text-foreground px-1 mb-2 mt-4">Menos horas</Text>
          <View className="bg-card border border-border rounded-2xl overflow-hidden">
            {horas.menos.map((p) => <FilaHoras key={p.trabajador_id} p={p} max={max} />)}
          </View>
        </>
      )}
    </>
  );
}

function Cargo({ c }: { c: CargoTurnos }) {
  const maxPago = Math.max(...c.personas.map((p) => p.pago), 1);
  const activos = c.personas.filter((p) => p.turnos > 0);
  const banca = c.personas.filter((p) => p.turnos === 0);
  const visibles = activos.slice(0, MAX_FILAS_CARGO);
  return (
    <View className="bg-card border border-border rounded-2xl overflow-hidden mb-3">
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row items-center gap-2">
          <Text className="flex-1 text-base font-bold text-foreground">{c.cargo}</Text>
          <Text className="text-sm font-semibold text-foreground">{formatCOP(c.total_pago)}</Text>
        </View>
        <Text className="text-xs text-muted-foreground mt-0.5">
          {c.total_turnos} {c.total_turnos === 1 ? 'turno' : 'turnos'} · {c.personas.length} {c.personas.length === 1 ? 'persona' : 'personas'}
        </Text>
        {!c.rotable && (
          <View className="flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-1 mt-2" style={{ backgroundColor: COLORS.muted }}>
            <Ionicons name="lock-closed-outline" size={12} color={COLORS.slate600} />
            <Text className="text-xs font-medium" style={{ color: COLORS.slate600 }}>Pocas personas: no se rota</Text>
          </View>
        )}
      </View>
      {visibles.map((p) => (
        <View key={p.trabajador_id} className="px-4 py-2.5 border-t border-border">
          <View className="flex-row items-center">
            <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>{nombreDe(p)}</Text>
            <Text className="text-xs text-muted-foreground mr-3">{p.turnos} {p.turnos === 1 ? 'turno' : 'turnos'}</Text>
            <Text className="text-sm font-semibold text-foreground">{formatCOP(p.pago)}</Text>
          </View>
          <View className="h-1.5 rounded-full mt-1.5" style={{ backgroundColor: alpha(COLORS.primary, 0.12) }}>
            <View className="h-1.5 rounded-full" style={{ width: `${(p.pago / maxPago) * 100}%`, backgroundColor: COLORS.primary }} />
          </View>
        </View>
      ))}
      {activos.length > visibles.length && (
        <Text className="px-4 py-2.5 border-t border-border text-xs text-muted-foreground">+{activos.length - visibles.length} más</Text>
      )}
      {banca.length > 0 && (
        <View className="px-4 py-3 border-t border-border" style={{ backgroundColor: COLORS.infoLight }}>
          <Text className="text-xs" style={{ color: COLORS.infoText }}>
            Sin turnos este período: {banca.map(nombreDe).join(', ')}
          </Text>
        </View>
      )}
    </View>
  );
}

export function PersonasPeriodo({ desde, hasta }: { desde: string; hasta: string }) {
  const q = usePersonas(desde, hasta);
  if (q.isLoading) return <SkeletonStats style={{ paddingTop: 12 }} />;
  if (q.isError || !q.data) return <ErrorState compact error={q.error} onRetry={q.refetch} fallback="No se pudo cargar el análisis de personas" />;

  const { horas, cargos, insights } = q.data;
  if (!horas?.ranking.length && !cargos.length) return null;
  return (
    <View>
      {insights.length > 0 && (
        <>
          <Titulo>Personas: para mirar</Titulo>
          <View className="gap-3">{insights.map((i) => <Insight key={i.id} nivel={i.nivel} texto={i.texto} />)}</View>
        </>
      )}
      {horas && <Horas horas={horas} />}
      {cargos.length > 0 && (
        <>
          <Titulo>Turnos y pago por cargo</Titulo>
          {cargos.map((c) => <Cargo key={c.cargo_id} c={c} />)}
        </>
      )}
    </View>
  );
}
