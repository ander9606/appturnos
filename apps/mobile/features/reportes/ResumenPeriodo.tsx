import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';

import { reportesApi } from '@api-client';
import type { CostoComparado, NivelInsight } from '@api-client';
import { Text } from '@/components/ui/Text';
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

export interface ConceptoCosto { label: string; valor: number; color: string }

/** Conceptos de los desgloses; cada lado (turnos / nómina) usa solo los suyos. */
export const COLOR_CONCEPTO = {
  ordinario: COLORS.primary,
  extras: COLORS.warning,
  nocturno: COLORS.info,
  festivo: COLORS.success,
  tarifas: COLORS.slate600,
  bonos: COLORS.primary400,
};

function Desglose({ items }: { items: ConceptoCosto[] }) {
  const lista = items.filter((c) => c.valor > 0);
  const total = lista.reduce((s, c) => s + c.valor, 0);
  if (!total) return null;
  return (
    <View className="mt-4 gap-3">
      {/* Barra apilada: cada tramo proporcional a su concepto */}
      <View className="flex-row h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: COLORS.muted }}>
        {lista.map((c) => (
          <View key={c.label} style={{ flex: c.valor, backgroundColor: c.color }} />
        ))}
      </View>
      {lista.map((c) => (
        <View key={c.label} className="flex-row items-center gap-2">
          <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
          <Text className="flex-1 text-sm text-foreground">{c.label}</Text>
          <Text className="text-sm font-semibold text-foreground">{formatCOP(c.valor)}</Text>
          <Text className="w-10 text-right text-xs text-muted-foreground">{Math.round((c.valor / total) * 100)}%</Text>
        </View>
      ))}
    </View>
  );
}

/** Costo de UN lado contra su propio período anterior, con su desglose. */
export function TarjetaCosto({ titulo, costo, previo, items }: {
  titulo: string; costo: CostoComparado; previo: { desde: string; hasta: string }; items: ConceptoCosto[];
}) {
  return (
    <View className="bg-card border border-border rounded-2xl p-5">
      <Text className="text-xs text-muted-foreground">{titulo}</Text>
      <Text className="text-3xl font-bold text-foreground mt-1">{formatCOP(costo.total)}</Text>
      <View className="flex-row items-center gap-2 mt-2">
        <Delta pct={costo.delta_pct} />
        {costo.delta_pct != null && (
          <Text className="flex-1 text-xs text-muted-foreground" numberOfLines={1}>
            vs {formatCOP(costo.previo)} ({formatDate(previo.desde)} – {formatDate(previo.hasta)})
          </Text>
        )}
      </View>
      <Desglose items={items} />
    </View>
  );
}

export function Insight({ nivel, texto }: { nivel: NivelInsight; texto: string }) {
  const n = NIVEL[nivel];
  return (
    <View className="flex-row items-start gap-3 rounded-2xl p-3.5" style={{ backgroundColor: n.fondo }}>
      <Ionicons name={n.icon} size={20} color={n.icono} style={{ marginTop: 1 }} />
      <Text className="flex-1 text-sm" style={{ color: n.texto }}>{texto}</Text>
    </View>
  );
}

export function Mini({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View className="flex-1 bg-card border border-border rounded-2xl p-4 gap-1">
      <Text className="text-xs text-muted-foreground" numberOfLines={1}>{label}</Text>
      <Text className="text-xl font-bold text-foreground">{value}</Text>
      <Text className="text-xs text-muted-foreground">{sub}</Text>
    </View>
  );
}
