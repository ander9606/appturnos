import { SkeletonStats } from '@/shared/components/Skeleton';
import { ErrorState } from '@/shared/components/ErrorState';
import { EmptyState } from '@/shared/components/EmptyState';
import { fmtCOP } from '@/shared/lib/format';
import { useAsistencia, useCostos, usePersonas, useResumen } from '../hooks/useReportes';
import type { HorasPersona, Rango } from '../types';
import { ParaMirar, TarjetaCosto, TarjetasJornada, Titulo, nombreDe } from './ReportesUI';

function ListaHoras({ titulo, lista, max }: { titulo: string; lista: HorasPersona[]; max: number }) {
  if (!lista.length) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-foreground">{titulo}</p>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {lista.map((p) => (
          <div key={p.trabajador_id} className="border-b border-border px-5 py-3 last:border-b-0">
            <div className="flex items-center text-sm">
              <span className="flex-1 truncate font-medium text-foreground">{nombreDe(p)}</span>
              <span className="font-semibold text-foreground">{p.prom_semana.toLocaleString('es-CO')} h/sem</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-success/10">
              <div className="h-1.5 rounded-full bg-success" style={{ width: `${Math.min(100, (p.prom_semana / max) * 100)}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{p.prom_dia.toLocaleString('es-CO')} h por día trabajado · {p.dias} días</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Nada aquí para quien no ve nómina (jefe de turnos): el servidor ya la entrega en null. */
export function SeccionNomina({ rango }: { rango: Rango }) {
  const r = useResumen(rango);
  const p = usePersonas(rango);
  const a = useAsistencia(rango);
  const c = useCostos(rango);

  if (r.isLoading || p.isLoading) return <SkeletonStats />;
  if (r.isError || p.isError) return <ErrorState error={r.error ?? p.error} onRetry={() => { r.refetch(); p.refetch(); }} />;
  const n = r.data?.nomina;
  const pn = p.data?.nomina;
  if (!n || !pn || !r.data) return null;
  if (!n.costo.total && !pn.jornadas && !pn.horas.ranking.length) {
    return <EmptyState title="Sin registros de nómina en este período" message="Cuando haya días registrados, aquí verás el costo, las horas y las jornadas." />;
  }

  const horas = pn.horas;
  const max = horas.ranking[0]?.prom_semana || 1;
  const detalle = c.data?.nomina?.detalle ?? [];
  const dias = a.data?.nomina ?? [];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TarjetaCosto
            titulo="Costo de nómina" acento="var(--color-success)" costo={n.costo} previo={r.data.previo}
            items={[
              { label: 'Salario ordinario', valor: n.desglose.ordinario, color: 'var(--color-hora-ordinaria)' },
              { label: 'Horas extra', valor: n.desglose.extras, color: 'var(--color-hora-extra)' },
              { label: 'Recargo nocturno', valor: n.desglose.nocturno, color: 'var(--color-hora-nocturna)' },
              { label: 'Dominicales y festivos', valor: n.desglose.festivo, color: 'var(--color-hora-festivo)' },
            ]}
          />
        </div>
        <TarjetasJornada titulo="Duración de la jornada" j={pn.jornadas} apiladas />
      </div>

      <ParaMirar insights={[...n.insights, ...pn.insights]} />

      {horas.ranking.length > 0 && (
        <section>
          <Titulo>Horas por persona (promedio semanal)</Titulo>
          <p className="-mt-1 mb-3 text-xs text-muted-foreground">Promedio del equipo: {horas.prom_semana_equipo?.toLocaleString('es-CO')} h por semana</p>
          <div className="grid gap-4 lg:grid-cols-2">
            <ListaHoras titulo="Más horas" lista={horas.mas} max={max} />
            <ListaHoras titulo="Menos horas" lista={horas.menos} max={max} />
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {detalle.length > 0 && (
          <section>
            <Titulo>Costo por trabajador</Titulo>
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              {detalle.map((d) => (
                <div key={d.trabajador_id} className="flex items-center border-b border-border px-5 py-2.5 text-sm last:border-b-0">
                  <span className="flex-1 text-foreground">{nombreDe(d)}</span>
                  <span className="font-semibold text-foreground">{fmtCOP(d.total)}</span>
                </div>
              ))}
            </div>
          </section>
        )}
        {dias.length > 0 && (
          <section>
            <Titulo>Días registrados por persona</Titulo>
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              {dias.map((d) => (
                <div key={d.trabajador_id} className="flex items-center border-b border-border px-5 py-2.5 text-sm last:border-b-0">
                  <span className="flex-1 text-foreground">{nombreDe(d)}</span>
                  <span className="font-semibold text-foreground">{d.dias_registrados} <span className="text-xs font-normal text-muted-foreground">días</span></span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
