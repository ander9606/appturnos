import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/components/ui/Text';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonStats } from '@/components/ui/Skeleton';
import { COLORS } from '@/lib/designTokens';
import type { ResumenInsight } from '@api-client';
import { COLOR_CONCEPTO, Insight, Mini, TarjetaCosto, useResumen } from './ResumenPeriodo';
import { Cargo, Horas, Jornadas, Titulo, usePersonas } from './PersonasPeriodo';

/**
 * Turnos y nómina son poblaciones distintas (se pagan, se miden y se gestionan distinto):
 * cada una tiene su propia sección, con su costo, sus personas y sus avisos. Nada se suma ni se mezcla.
 */
function Encabezado({ icon, titulo, sub }: { icon: React.ComponentProps<typeof Ionicons>['name']; titulo: string; sub: string }) {
  return (
    <View className="flex-row items-center gap-3 mt-8 mb-4 pb-3 border-b-2" style={{ borderBottomColor: COLORS.primary }}>
      <View className="w-9 h-9 rounded-full items-center justify-center" style={{ backgroundColor: COLORS.primaryLight }}>
        <Ionicons name={icon} size={18} color={COLORS.primary} />
      </View>
      <View className="flex-1">
        <Text className="text-lg font-bold text-foreground">{titulo}</Text>
        <Text className="text-xs text-muted-foreground">{sub}</Text>
      </View>
    </View>
  );
}

/** Los avisos reales van primero; "todo en orden" solo si no hay ninguno. */
function ParaMirar({ insights }: { insights: ResumenInsight[] }) {
  const reales = insights.filter((i) => i.nivel !== 'ok');
  const lista = reales.length ? reales : insights.slice(0, 1);
  if (!lista.length) return null;
  return (
    <>
      <Titulo>Para mirar</Titulo>
      <View className="gap-3">{lista.map((i) => <Insight key={i.id} nivel={i.nivel} texto={i.texto} />)}</View>
    </>
  );
}

interface Props { desde: string; hasta: string; children?: React.ReactNode }

export function TurnosSeccion({ desde, hasta, children }: Props) {
  const r = useResumen(desde, hasta);
  const p = usePersonas(desde, hasta);
  const sub = 'Personal por turnos: se paga por turno completado';

  if (r.isLoading || p.isLoading) return <><Encabezado icon="calendar-outline" titulo="Turnos" sub={sub} /><SkeletonStats /></>;
  if (r.isError || p.isError || !r.data || !p.data) {
    return <><Encabezado icon="calendar-outline" titulo="Turnos" sub={sub} /><ErrorState compact error={r.error ?? p.error} onRetry={() => { r.refetch(); p.refetch(); }} fallback="No se pudo cargar el análisis de turnos" /></>;
  }

  const t = r.data.turnos;
  const pt = p.data.turnos;
  return (
    <View>
      <Encabezado icon="calendar-outline" titulo="Turnos" sub={sub} />
      <TarjetaCosto
        titulo="Costo de turnos"
        costo={t.costo}
        previo={r.data.previo}
        items={[
          { label: 'Tarifas de turnos', valor: t.desglose.tarifas, color: COLOR_CONCEPTO.tarifas },
          { label: 'Bonos', valor: t.desglose.bonos, color: COLOR_CONCEPTO.bonos },
        ]}
      />
      <View className="flex-row gap-3 mt-3">
        <Mini
          label="Cobertura de plazas"
          value={t.cobertura.pct == null ? '—' : `${Math.round(t.cobertura.pct)}%`}
          sub={t.cobertura.plazas ? `${t.cobertura.cubiertas} de ${t.cobertura.plazas} plazas` : 'Sin turnos publicados'}
        />
        <Mini
          label="No se presentaron"
          value={String(t.no_presentados)}
          sub={t.convocados ? `de ${t.convocados} convocados` : 'Sin convocados'}
        />
      </View>
      <ParaMirar insights={[...t.insights, ...pt.insights]} />
      {pt.jornadas && (
        <>
          <Titulo>Duración de los turnos</Titulo>
          <Jornadas titulo="Por turno completado" j={pt.jornadas} />
        </>
      )}
      {pt.cargos.length > 0 && (
        <>
          <Titulo>Turnos y pago por cargo</Titulo>
          {pt.cargos.map((c) => <Cargo key={c.cargo_id} c={c} />)}
        </>
      )}
      {children}
    </View>
  );
}

/** No muestra nada a quien no ve nómina (jefe de turnos). */
export function NominaSeccion({ desde, hasta, children }: Props) {
  const r = useResumen(desde, hasta);
  const p = usePersonas(desde, hasta);
  const sub = 'Personal de planta: salario o tarifa por hora';

  if (r.isLoading || p.isLoading) return <><Encabezado icon="briefcase-outline" titulo="Nómina" sub={sub} /><SkeletonStats /></>;
  if (r.isError || p.isError) {
    return <><Encabezado icon="briefcase-outline" titulo="Nómina" sub={sub} /><ErrorState compact error={r.error ?? p.error} onRetry={() => { r.refetch(); p.refetch(); }} fallback="No se pudo cargar el análisis de nómina" /></>;
  }
  const n = r.data?.nomina;
  const pn = p.data?.nomina;
  if (!n || !pn || !r.data) return null;

  return (
    <View>
      <Encabezado icon="briefcase-outline" titulo="Nómina" sub={sub} />
      <TarjetaCosto
        titulo="Costo de nómina"
        costo={n.costo}
        previo={r.data.previo}
        items={[
          { label: 'Salario ordinario', valor: n.desglose.ordinario, color: COLOR_CONCEPTO.ordinario },
          { label: 'Horas extra', valor: n.desglose.extras, color: COLOR_CONCEPTO.extras },
          { label: 'Recargo nocturno', valor: n.desglose.nocturno, color: COLOR_CONCEPTO.nocturno },
          { label: 'Dominicales y festivos', valor: n.desglose.festivo, color: COLOR_CONCEPTO.festivo },
        ]}
      />
      <ParaMirar insights={[...n.insights, ...pn.insights]} />
      {pn.jornadas && (
        <>
          <Titulo>Duración de la jornada</Titulo>
          <Jornadas titulo="Por día trabajado" j={pn.jornadas} />
        </>
      )}
      {pn.horas.ranking.length > 0 && <Horas horas={pn.horas} />}
      {children}
    </View>
  );
}
