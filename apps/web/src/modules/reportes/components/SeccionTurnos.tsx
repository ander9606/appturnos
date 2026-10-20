import { Lock } from 'lucide-react';
import { SkeletonStats } from '@/shared/components/Skeleton';
import { ErrorState } from '@/shared/components/ErrorState';
import { EmptyState } from '@/shared/components/EmptyState';
import { fmtCOP } from '@/shared/lib/format';
import { useAsistencia, usePersonas, useResumen } from '../hooks/useReportes';
import type { CargoTurnos, Rango } from '../types';
import { ListasCalificados, PromedioEstrella, TarjetaCalificaciones } from './Calificaciones';
import { Anillo, Mini, ParaMirar, TarjetaCosto, TarjetasJornada, Titulo, nombreDe } from './ReportesUI';

const MAX_FILAS_CARGO = 8;

function TarjetaCargo({ c }: { c: CargoTurnos }) {
  const maxPago = Math.max(...c.personas.map((p) => p.pago), 1);
  const activos = c.personas.filter((p) => p.turnos > 0);
  const banca = c.personas.filter((p) => p.turnos === 0);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="px-5 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <h4 className="flex-1 text-base font-bold text-foreground">{c.cargo}</h4>
          <span className="text-sm font-semibold text-foreground">{fmtCOP(c.total_pago)}</span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {c.total_turnos} {c.total_turnos === 1 ? 'turno' : 'turnos'} · {c.personas.length} {c.personas.length === 1 ? 'persona' : 'personas'}
        </p>
        {!c.rotable && (
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <Lock size={12} aria-hidden="true" /> Pocas personas: no se rota
          </span>
        )}
      </div>
      {activos.slice(0, MAX_FILAS_CARGO).map((p) => (
        <div key={p.trabajador_id} className="border-t border-border px-5 py-2.5">
          <div className="flex items-center gap-3 text-sm">
            <span className="flex-1 truncate text-foreground">{nombreDe(p)}</span>
            {p.calificacion && <PromedioEstrella promedio={p.calificacion.promedio} />}
            <span className="text-xs text-muted-foreground">{p.turnos} {p.turnos === 1 ? 'turno' : 'turnos'}</span>
            <span className="w-28 text-right font-semibold text-foreground">{fmtCOP(p.pago)}</span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-primary/10">
            <div className="h-1.5 rounded-full bg-primary" style={{ width: `${(p.pago / maxPago) * 100}%` }} />
          </div>
        </div>
      ))}
      {activos.length > MAX_FILAS_CARGO && (
        <p className="border-t border-border px-5 py-2.5 text-xs text-muted-foreground">+{activos.length - MAX_FILAS_CARGO} más</p>
      )}
      {banca.length > 0 && (
        <p className="border-t border-border bg-info-light px-5 py-3 text-xs text-info-text">
          Sin turnos este período: {banca.map(nombreDe).join(', ')}
        </p>
      )}
    </div>
  );
}

export function SeccionTurnos({ rango }: { rango: Rango }) {
  const r = useResumen(rango);
  const p = usePersonas(rango);
  const a = useAsistencia(rango);

  if (r.isLoading || p.isLoading) return <SkeletonStats />;
  if (r.isError || p.isError || !r.data || !p.data) {
    return <ErrorState error={r.error ?? p.error} onRetry={() => { r.refetch(); p.refetch(); }} />;
  }
  const t = r.data.turnos;
  const pt = p.data.turnos;
  if (!t.convocados && !t.costo.total && !t.cobertura.plazas) {
    return <EmptyState title="Sin turnos en este período" message="Cuando haya turnos completados, aquí verás su costo, asistencia y reparto." />;
  }

  const pct = t.cobertura.pct;
  const colorCobertura = pct == null ? 'var(--color-hora-ordinaria)' : pct >= 90 ? 'var(--color-success)' : pct >= 75 ? 'var(--color-warning)' : 'var(--color-danger)';
  const asist = a.data?.turnos ?? [];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TarjetaCosto
            titulo="Costo de turnos" acento="var(--color-primary)" costo={t.costo} previo={r.data.previo}
            items={[
              { label: 'Tarifas de turnos', valor: t.desglose.tarifas, color: 'var(--color-primary)' },
              { label: 'Bonos', valor: t.desglose.bonos, color: 'var(--color-bonos)' },
            ]}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
            {pct != null && <Anillo pct={pct} color={colorCobertura} />}
            <div>
              <p className="text-xs text-muted-foreground">Cobertura de plazas</p>
              <p className="text-sm font-semibold text-foreground">
                {t.cobertura.plazas ? `${t.cobertura.cubiertas} de ${t.cobertura.plazas} plazas` : 'Sin turnos publicados'}
              </p>
            </div>
          </div>
          <Mini label="No se presentaron" value={String(t.no_presentados)} sub={t.convocados ? `de ${t.convocados} convocados` : 'Sin convocados'} />
        </div>
      </div>

      <ParaMirar insights={[...t.insights, ...pt.insights]} />

      <section className="space-y-4">
        <Titulo>Calificaciones</Titulo>
        <TarjetaCalificaciones cal={t.calificaciones} />
        <ListasCalificados mejores={pt.calificaciones.mejores} peores={pt.calificaciones.peores} />
      </section>

      <TarjetasJornada titulo="Duración de los turnos" j={pt.jornadas} />

      {pt.cargos.length > 0 && (
        <section>
          <Titulo>Turnos y pago por cargo</Titulo>
          <div className="grid gap-4 lg:grid-cols-2">{pt.cargos.map((c) => <TarjetaCargo key={c.cargo_id} c={c} />)}</div>
        </section>
      )}

      {asist.length > 0 && (
        <section>
          <Titulo>Asistencia por persona</Titulo>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs text-muted-foreground">
                <tr><th className="px-5 py-2.5 font-medium">Persona</th><th className="px-3 py-2.5 text-right font-medium">Turnos</th><th className="px-3 py-2.5 text-right font-medium">Completados</th><th className="px-5 py-2.5 text-right font-medium">Ausencias</th></tr>
              </thead>
              <tbody>
                {asist.map((x) => (
                  <tr key={x.trabajador_id} className="border-t border-border">
                    <td className="px-5 py-2.5 text-foreground">{nombreDe(x)}</td>
                    <td className="px-3 py-2.5 text-right">{x.total_turnos}</td>
                    <td className="px-3 py-2.5 text-right">{x.completados}</td>
                    <td className="px-5 py-2.5 text-right">{x.no_presentados}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
