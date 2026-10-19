import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { reportesApi } from '@api-client';
import type { NivelInsight, ResumenPeriodoResponse } from '@api-client';
import { Text } from '@/components/ui/Text';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonStats } from '@/components/ui/Skeleton';
import { COLORS } from '@/lib/designTokens';
import { formatCOP, formatDate } from '@/lib/formatters';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Cada nivel lleva icono + texto además del color (el color solo no basta para ser accesible). */
const NIVEL: Record<NivelInsight, { icon: IconName; fondo: string; texto: string; icono: string }> = {
  alerta: { icon: 'alert-circle',     fondo: COLORS.dangerLight,  texto: COLORS.dangerText,  icono: COLORS.danger },
  aviso:  { icon: 'warning',          fondo: COLORS.warningLight, texto: COLORS.warningText, icono: COLORS.warning },
  info:   { icon: 'information-circle', fondo: COLORS.infoLight,  texto: COLORS.infoText,    icono: COLORS.info },
  ok:     { icon: 'checkmark-circle', fondo: COLORS.successLight, texto: COLORS.successText, icono: COLORS.success },
};

/** Conceptos del desglose, en el orden en que se muestran; los que no vienen o valen 0 se omiten. */
const CONCEPTOS = [
  { key: 'ordinario', label: 'Salario ordinario', color: COLORS.primary },
  { key: 'extras',    label: 'Horas extra',       color: COLORS.warning },
  { key: 'nocturno',  label: 'Recargo nocturno',  color: COLORS.info },
  { key: 'festivo',   label: 'Dominicales y festivos', color: COLORS.success },
  { key: 'turnos',    label: 'Turnos',            color: COLORS.slate600 },
  { key: 'bonos',     label: 'Bonos',             color: COLORS.primary400 },
] as const;

export function useResumen(desde: string, hasta: string) {
  return useQuery({
    queryKey: ['reportes', 'resumen', desde, hasta],
    queryFn: () => reportesApi.resumen({ desde, hasta }),
    staleTime: 120_000,
  });
}

/** Sube = malo (cuesta más), baja = bueno. */
function Delta({ pct }: { pct: number | null }) {
  if (pct == null) return <Text className="text-xs text-muted-foreground">Sin período anterior para comparar</Text>;
  const sube = pct > 0;
  const plano = Math.abs(pct) < 0.5;
  const n = plano ? NIVEL.info : sube ? NIVEL.aviso : NIVEL.ok;
  return (
    <View
      accessibilityLabel={`${plano ? 'Sin cambio' : `${sube ? 'Subió' : 'Bajó'} ${Math.abs(Math.round(pct))} por ciento`} frente al período anterior`}
      className="flex-row items-center gap-1 self-start rounded-full px-2.5 py-1"
      style={{ backgroundColor: n.fondo }}
    >
      <Ionicons name={plano ? 'remove' : sube ? 'arrow-up' : 'arrow-down'} size={12} color={n.texto} />
      <Text className="text-xs font-semibold" style={{ color: n.texto }}>
        {plano ? 'Sin cambio' : `${Math.abs(Math.round(pct))}%`}
      </Text>
    </View>
  );
}

function Desglose({ d }: { d: ResumenPeriodoResponse['desglose'] }) {
  const items = CONCEPTOS.map((c) => ({ ...c, valor: d[c.key] ?? 0 })).filter((c) => c.valor > 0);
  const total = items.reduce((s, c) => s + c.valor, 0);
  if (!total) return null;
  return (
    <View className="mt-4 gap-3">
      {/* Barra apilada: cada tramo proporcional a su concepto */}
      <View className="flex-row h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: COLORS.muted }}>
        {items.map((c) => (
          <View key={c.key} style={{ flex: c.valor, backgroundColor: c.color }} />
        ))}
      </View>
      {items.map((c) => (
        <View key={c.key} className="flex-row items-center gap-2">
          <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
          <Text className="flex-1 text-sm text-foreground">{c.label}</Text>
          <Text className="text-sm font-semibold text-foreground">{formatCOP(c.valor)}</Text>
          <Text className="w-10 text-right text-xs text-muted-foreground">{Math.round((c.valor / total) * 100)}%</Text>
        </View>
      ))}
    </View>
  );
}

function Insight({ nivel, texto }: { nivel: NivelInsight; texto: string }) {
  const n = NIVEL[nivel];
  return (
    <View className="flex-row items-start gap-3 rounded-2xl p-3.5" style={{ backgroundColor: n.fondo }}>
      <Ionicons name={n.icon} size={20} color={n.icono} style={{ marginTop: 1 }} />
      <Text className="flex-1 text-sm" style={{ color: n.texto }}>{texto}</Text>
    </View>
  );
}

function Mini({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View className="flex-1 bg-card border border-border rounded-2xl p-4 gap-1">
      <Text className="text-xs text-muted-foreground" numberOfLines={1}>{label}</Text>
      <Text className="text-xl font-bold text-foreground">{value}</Text>
      <Text className="text-xs text-muted-foreground">{sub}</Text>
    </View>
  );
}

export function ResumenPeriodo({ desde, hasta }: { desde: string; hasta: string }) {
  const q = useResumen(desde, hasta);

  if (q.isLoading) return <SkeletonStats style={{ paddingTop: 12 }} />;
  if (q.isError || !q.data) return <ErrorState compact error={q.error} onRetry={q.refetch} fallback="No se pudo cargar el resumen" />;

  const r = q.data;
  const { costo, turnos, cobertura } = r;
  return (
    <View className="gap-3">
      <View className="bg-card border border-border rounded-2xl p-5">
        <Text className="text-xs text-muted-foreground">Costo de mano de obra</Text>
        <Text className="text-3xl font-bold text-foreground mt-1">{formatCOP(costo.total)}</Text>
        <View className="flex-row items-center gap-2 mt-2">
          <Delta pct={costo.delta_pct} />
          {costo.delta_pct != null && (
            <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
              vs {formatCOP(costo.previo)} ({formatDate(r.previo.desde)} – {formatDate(r.previo.hasta)})
            </Text>
          )}
        </View>
        <Desglose d={r.desglose} />
      </View>

      <View className="flex-row gap-3">
        <Mini
          label="Cobertura de plazas"
          value={cobertura.pct == null ? '—' : `${Math.round(cobertura.pct)}%`}
          sub={cobertura.plazas ? `${cobertura.cubiertas} de ${cobertura.plazas} plazas` : 'Sin turnos publicados'}
        />
        <Mini
          label="No se presentaron"
          value={String(turnos.no_presentados)}
          sub={turnos.convocados ? `de ${turnos.convocados} convocados` : 'Sin convocados'}
        />
      </View>

      <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1 mt-3">Para mirar</Text>
      {r.insights.map((i) => <Insight key={i.id} nivel={i.nivel} texto={i.texto} />)}
    </View>
  );
}
