import { ArrowDown, ArrowUp, Minus, Star } from 'lucide-react';
import type { CalificacionesTurnos, PersonaCalificada } from '../types';
import { nombreDe } from './ReportesUI';

/** 4.13 → "4,1" */
export const calificacionTxt = (n: number) => n.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Estrella + promedio, en pequeño (para filas de personas). */
export function PromedioEstrella({ promedio }: { promedio: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-foreground" aria-label={`Calificación ${calificacionTxt(promedio)} de 5`}>
      <Star size={12} className="fill-warning text-warning" aria-hidden="true" />{calificacionTxt(promedio)}
    </span>
  );
}

/** Para una calificación, subir es bueno (al revés que el costo). */
function Cambio({ delta }: { delta: number | null }) {
  if (delta == null) return null;
  const plano = Math.abs(delta) < 0.05;
  const sube = delta > 0;
  const estilo = plano ? 'bg-info-light text-info-text' : sube ? 'bg-success-light text-success-text' : 'bg-warning-light text-warning-text';
  const Icono = plano ? Minus : sube ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${estilo}`}
      aria-label={plano ? 'Sin cambio frente al período anterior' : `${sube ? 'Subió' : 'Bajó'} ${calificacionTxt(Math.abs(delta))} frente al período anterior`}>
      <Icono size={12} aria-hidden="true" />{plano ? 'Sin cambio' : calificacionTxt(Math.abs(delta))}
    </span>
  );
}

/** Calificación promedio del período, su distribución por estrellas y lo que falta calificar. */
export function TarjetaCalificaciones({ cal }: { cal: CalificacionesTurnos }) {
  const max = Math.max(...Object.values(cal.distribucion), 1);
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Calificación de los turnos</p>
      {cal.promedio == null ? (
        <p className="mt-2 text-sm text-muted-foreground">Todavía no hay turnos calificados en este período.</p>
      ) : (
        <div className="mt-1 grid gap-6 sm:grid-cols-2">
          <div>
            <div className="flex items-end gap-2">
              <Star size={30} className="mb-1.5 fill-warning text-warning" aria-hidden="true" />
              <span className="text-4xl font-extrabold text-foreground">{calificacionTxt(cal.promedio)}</span>
              <span className="mb-1.5 text-base text-muted-foreground">de 5</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Cambio delta={cal.delta} />
              {cal.previo != null && <span className="text-xs text-muted-foreground">vs {calificacionTxt(cal.previo)} en el período anterior</span>}
            </div>
          </div>
          <div className="space-y-2">
            {([5, 4, 3, 2, 1] as const).map((e) => (
              <div key={e} className="flex items-center gap-2 text-xs">
                <span className="w-7 text-muted-foreground">{e} ★</span>
                <div className="h-2 flex-1 rounded-full bg-warning/15">
                  <div className="h-2 rounded-full bg-warning" style={{ width: `${(cal.distribucion[e] / max) * 100}%` }} />
                </div>
                <span className="w-8 text-right font-semibold text-foreground">{cal.distribucion[e]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        {cal.calificadas} {cal.calificadas === 1 ? 'turno calificado' : 'turnos calificados'}
        {cal.sin_calificar > 0 ? ` · ${cal.sin_calificar} completado${cal.sin_calificar === 1 ? '' : 's'} sin calificar` : ''}
      </p>
    </div>
  );
}

function ListaCalificados({ titulo, lista }: { titulo: string; lista: PersonaCalificada[] }) {
  if (!lista.length) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-foreground">{titulo}</p>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {lista.map((p) => (
          <div key={p.trabajador_id} className="flex items-center gap-3 border-b border-border px-5 py-3 text-sm last:border-b-0">
            <span className="flex-1 truncate font-medium text-foreground">{nombreDe(p)}</span>
            <span className="text-xs text-muted-foreground">{p.n} calificaciones</span>
            <PromedioEstrella promedio={p.promedio} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Mejor y menor calificados del período (solo con 3 o más calificaciones). */
export function ListasCalificados({ mejores, peores }: { mejores: PersonaCalificada[]; peores: PersonaCalificada[] }) {
  if (!mejores.length && !peores.length) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ListaCalificados titulo="Mejor calificados" lista={mejores} />
      <ListaCalificados titulo="Menor calificación" lista={peores} />
    </div>
  );
}
