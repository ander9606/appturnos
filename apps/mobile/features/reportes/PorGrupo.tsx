import React from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { reportesApi } from '@api-client';
import type { GrupoReporte } from '@api-client';
import { Text } from '@/components/ui/Text';
import { COLORS, alpha } from '@/lib/designTokens';
import { formatCOP } from '@/lib/formatters';
import { useOpcionesGrupos } from '@/features/empresas/useOpcionesGrupos';
import { Titulo } from './PersonasPeriodo';

const MAX_FILAS = 8;

/** Solo se pide si la empresa usa grupos: para el resto de clientes el servidor respondería 403. */
export function useReporteGrupos(desde: string, hasta: string, enabled: boolean) {
  return useQuery({
    queryKey: ['reportes', 'grupos', desde, hasta],
    queryFn: () => reportesApi.grupos({ desde, hasta }),
    staleTime: 120_000,
    enabled,
  });
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

function FilaGrupo({ g, max }: { g: GrupoReporte; max: number }) {
  const cobertura = g.plazas ? `${g.cubiertas} de ${g.plazas} plazas` : null;
  return (
    <View className="px-4 py-3 border-t border-border">
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 text-sm font-semibold text-foreground" numberOfLines={1}>{g.nombre}</Text>
        <Text className="text-sm font-semibold text-foreground">{formatCOP(g.costo)}</Text>
      </View>
      <Text className="text-xs text-muted-foreground mt-0.5">
        {[
          plural(g.turnos, 'turno', 'turnos'),
          plural(g.completados, 'completado', 'completados'),
          g.no_presentados ? plural(g.no_presentados, 'ausencia', 'ausencias') : null,
          cobertura,
        ].filter(Boolean).join(' · ')}
      </Text>
      <View className="h-1.5 rounded-full mt-2" style={{ backgroundColor: alpha(COLORS.primary, 0.12) }}>
        <View className="h-1.5 rounded-full" style={{ width: `${max ? (g.costo / max) * 100 : 0}%`, backgroundColor: COLORS.primary }} />
      </View>
      {g.pct != null && <Text className="text-xs text-muted-foreground mt-1">{g.pct.toLocaleString('es-CO')} % del costo de turnos</Text>}
    </View>
  );
}

/**
 * Comparación de los grupos (eventos, obras…) con turnos en el período: cuánto cuesta cada uno y cuánto pesa en el
 * costo de turnos. Usa el nombre que la empresa le puso a los grupos; no se muestra si no los usa o no hay ninguno.
 */
export function PorGrupo({ desde, hasta }: { desde: string; hasta: string }) {
  const { usa, etiqueta } = useOpcionesGrupos();
  const q = useReporteGrupos(desde, hasta, usa);
  if (!usa || !q.data || !q.data.grupos.length) return null;

  const { grupos, sin_grupo } = q.data;
  const visibles = grupos.slice(0, MAX_FILAS);
  const max = Math.max(...grupos.map((g) => g.costo), 0);
  return (
    <View>
      <Titulo>{`Costo por ${etiqueta.toLowerCase()}`}</Titulo>
      <View className="bg-card border border-border rounded-2xl overflow-hidden">
        <Text className="px-4 py-3 text-xs text-muted-foreground">
          {plural(grupos.length, 'grupo con turnos', 'grupos con turnos')} en este período. Ordenados del que más costó al que menos.
        </Text>
        {visibles.map((g) => <FilaGrupo key={g.grupo_id} g={g} max={max} />)}
        {grupos.length > visibles.length && (
          <Text className="px-4 py-2.5 border-t border-border text-xs text-muted-foreground">+{grupos.length - visibles.length} más</Text>
        )}
        {sin_grupo.costo > 0 && (
          <View className="flex-row items-center px-4 py-3 border-t border-border" style={{ backgroundColor: COLORS.muted }}>
            <Text className="flex-1 text-xs text-muted-foreground">Turnos sin {etiqueta.toLowerCase()}</Text>
            <Text className="text-xs font-semibold text-foreground">{formatCOP(sin_grupo.costo)}</Text>
          </View>
        )}
      </View>
    </View>
  );
}
