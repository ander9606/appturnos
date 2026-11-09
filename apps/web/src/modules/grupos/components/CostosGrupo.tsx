import { AlertCircle, Clock } from 'lucide-react';
import { Skeleton } from '@/shared/components/Skeleton';
import { fmtCOP } from '@/shared/lib/format';
import { useCostosGrupo } from '../hooks/useGrupos';

const turnos = (n: number) => `${n} turno${n === 1 ? '' : 's'}`;

function Fila({ etiqueta, detalle, valor, aviso = false }: { etiqueta: string; detalle?: string; valor: string; aviso?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div>
        <p className={`text-sm text-foreground flex items-center gap-1.5 ${aviso ? 'font-semibold' : ''}`}>
          {aviso && <AlertCircle size={14} className="text-warning" aria-hidden="true" />} {etiqueta}
        </p>
        {detalle && <p className="text-xs text-muted-foreground">{detalle}</p>}
      </div>
      <p className="text-sm font-semibold text-foreground tabular-nums">{valor}</p>
    </div>
  );
}

/**
 * Cuánto cuesta el evento, con las mismas reglas que la liquidación (para poder compararlo con el «saldo a pagar»):
 * lo listo para pagar, lo terminado sin firmar (frenado), lo que falta por hacer (estimado) y el total proyectado.
 * Los turnos con una compensación sin responder no suman ni restan: solo se avisa de cuántos hay.
 */
export function CostosGrupo({ grupoId }: { grupoId: number }) {
  const { data, isLoading, isError, refetch } = useCostosGrupo(grupoId);
  const c = data?.data;

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-2" role="status" aria-label="Cargando costos">
        <Skeleton className="h-3 w-20" /><Skeleton className="h-7 w-40" /><Skeleton className="h-3 w-2/3" />
      </div>
    );
  }
  if (isError || !c) {
    return (
      <div className="bg-card border border-border rounded-2xl p-5 flex items-center justify-between gap-3" role="alert">
        <p className="text-sm text-muted-foreground">No se pudieron cargar los costos.</p>
        <button type="button" onClick={() => refetch()} className="text-sm font-medium text-primary-600 hover:underline">Reintentar</button>
      </div>
    );
  }
  // Un grupo sin nada terminado ni comprometido no tiene costos que mostrar.
  if (c.proyectado <= 0 && c.en_espera.cantidad === 0) return null;

  const desglose = [
    c.real.bonos > 0 ? `bonos ${fmtCOP(c.real.bonos)}` : null,
    c.real.descuentos > 0 ? `descuentos −${fmtCOP(c.real.descuentos)}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <section className="bg-card border border-border rounded-2xl p-5" aria-label="Costos">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Costos</h2>
      <p className="text-3xl font-bold text-foreground mt-1 tabular-nums">{fmtCOP(c.proyectado)}</p>
      <p className="text-xs text-muted-foreground">Costo proyectado</p>

      <div className="mt-3 border-t border-border divide-y divide-border">
        <Fila etiqueta="Para pagar" detalle={[turnos(c.real.turnos_pagados), desglose].filter(Boolean).join(' · ')} valor={fmtCOP(c.real.total)} />
        {c.sin_firmar.cantidad > 0 && (
          <Fila aviso etiqueta="Sin firmar" detalle={`${turnos(c.sin_firmar.cantidad)} · su pago sigue frenado hasta que firmen`} valor={fmtCOP(c.sin_firmar.monto)} />
        )}
        {c.estimado.turnos > 0 && (
          <Fila etiqueta="Por hacer" detalle={`${turnos(c.estimado.turnos)} · estimado con la tarifa de cada puesto`} valor={fmtCOP(c.estimado.total)} />
        )}
      </div>

      {c.en_espera.cantidad > 0 && (
        <p className="flex items-start gap-2 bg-warning-light text-sm text-foreground rounded-lg px-3 py-2 mt-3">
          <Clock size={15} className="text-warning flex-shrink-0 mt-0.5" aria-hidden="true" />
          {turnos(c.en_espera.cantidad)} con una compensación sin responder: no suma{c.en_espera.cantidad === 1 ? '' : 'n'} hasta que el trabajador decida.
        </p>
      )}

      <p className="text-xs text-muted-foreground mt-3">
        {c.trabajadores} trabajador{c.trabajadores === 1 ? '' : 'es'} · {c.horas.toLocaleString('es-CO', { maximumFractionDigits: 1 })} h trabajadas
      </p>
    </section>
  );
}
