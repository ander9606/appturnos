import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/components/ui/Text';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonStats } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { COLORS, THEME_COLORS, alpha } from '@/lib/designTokens';
import type { ResumenInsight } from '@api-client';
import { COLOR_CONCEPTO, Insight, Mini, TarjetaCosto, useResumen } from './ResumenPeriodo';
import { AnilloProgreso } from './marca';
import { Cargo, Horas, Jornadas, Titulo, usePersonas } from './PersonasPeriodo';

/**
 * Turnos y nómina son poblaciones distintas (se pagan, se miden y se gestionan distinto):
 * cada una tiene su propia sección, con su costo, sus personas y sus avisos. Nada se suma ni se mezcla.
 */
// Acento por módulo (DISENO.md §2.3): Turnos naranja, Nómina verde.
const ACENTO_TURNOS = THEME_COLORS.turnos;
const ACENTO_NOMINA = THEME_COLORS.nomina;

function Encabezado({ icon, titulo, sub, acento }: {
  icon: React.ComponentProps<typeof Ionicons>['name']; titulo: string; sub: string; acento: { primary: string; primaryLight: string };
}) {
  return (
    <View className="flex-row items-center gap-3 mt-8 mb-4 pb-3 border-b" style={{ borderBottomColor: alpha(acento.primary, 0.35) }}>
      <View className="w-10 h-10 rounded-full items-center justify-center" style={{ backgroundColor: acento.primaryLight }}>
        <Ionicons name={icon} size={20} color={acento.primary} />
      </View>
      <View className="flex-1">
        <Text className="text-xl font-extrabold text-foreground">{titulo}</Text>
        <Text className="text-xs text-muted-foreground">{sub}</Text>
      </View>
    </View>
  );
}

/** Cobertura de plazas como anillo: verde desde 90 %, ámbar desde 75 %, rojo debajo. */
function TarjetaCobertura({ pct, cubiertas, plazas }: { pct: number | null; cubiertas: number; plazas: number }) {
  const color = pct == null ? COLORS.placeholder : pct >= 90 ? COLORS.success : pct >= 75 ? COLORS.warning : COLORS.danger;
  return (
    <View className="flex-1 items-center gap-2 bg-card border border-border rounded-2xl p-4">
      {pct == null ? null : <AnilloProgreso pct={pct} color={color} size={64} trazo={7} />}
      <View className="items-center">
        <Text className="text-xs text-muted-foreground">Cobertura de plazas</Text>
        <Text className="text-xs text-muted-foreground">
          {plazas ? `${cubiertas} de ${plazas} plazas` : 'Sin turnos publicados'}
        </Text>
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

  if (r.isLoading || p.isLoading) return <><Encabezado icon="calendar-outline" titulo="Turnos" sub={sub} acento={ACENTO_TURNOS} /><SkeletonStats /></>;
  if (r.isError || p.isError || !r.data || !p.data) {
    return <><Encabezado icon="calendar-outline" titulo="Turnos" sub={sub} acento={ACENTO_TURNOS} /><ErrorState compact error={r.error ?? p.error} onRetry={() => { r.refetch(); p.refetch(); }} fallback="No se pudo cargar el análisis de turnos" /></>;
  }

  const t = r.data.turnos;
  const pt = p.data.turnos;
  if (!t.convocados && !t.costo.total && !t.cobertura.plazas) {
    return (
      <View>
        <Encabezado icon="calendar-outline" titulo="Turnos" sub={sub} acento={ACENTO_TURNOS} />
        <EmptyState compact title="Sin turnos en este período" message="Cuando haya turnos completados, aquí verás su costo, asistencia y reparto." />
      </View>
    );
  }
  return (
    <View>
      <Encabezado icon="calendar-outline" titulo="Turnos" sub={sub} acento={ACENTO_TURNOS} />
      <TarjetaCosto
        titulo="Costo de turnos"
        acento={ACENTO_TURNOS.primary}
        costo={t.costo}
        previo={r.data.previo}
        items={[
          { label: 'Tarifas de turnos', valor: t.desglose.tarifas, color: COLOR_CONCEPTO.tarifas },
          { label: 'Bonos', valor: t.desglose.bonos, color: COLOR_CONCEPTO.bonos },
        ]}
      />
      <View className="flex-row gap-3 mt-3">
        <TarjetaCobertura pct={t.cobertura.pct} cubiertas={t.cobertura.cubiertas} plazas={t.cobertura.plazas} />
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

  if (r.isLoading || p.isLoading) return <><Encabezado icon="briefcase-outline" titulo="Nómina" sub={sub} acento={ACENTO_NOMINA} /><SkeletonStats /></>;
  if (r.isError || p.isError) {
    return <><Encabezado icon="briefcase-outline" titulo="Nómina" sub={sub} acento={ACENTO_NOMINA} /><ErrorState compact error={r.error ?? p.error} onRetry={() => { r.refetch(); p.refetch(); }} fallback="No se pudo cargar el análisis de nómina" /></>;
  }
  const n = r.data?.nomina;
  const pn = p.data?.nomina;
  if (!n || !pn || !r.data) return null;
  if (!n.costo.total && !pn.jornadas && !pn.horas.ranking.length) {
    return (
      <View>
        <Encabezado icon="briefcase-outline" titulo="Nómina" sub={sub} acento={ACENTO_NOMINA} />
        <EmptyState compact title="Sin registros de nómina en este período" message="Cuando haya días registrados, aquí verás el costo, las horas y las jornadas." />
      </View>
    );
  }

  return (
    <View>
      <Encabezado icon="briefcase-outline" titulo="Nómina" sub={sub} acento={ACENTO_NOMINA} />
      <TarjetaCosto
        titulo="Costo de nómina"
        acento={ACENTO_NOMINA.primary}
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
