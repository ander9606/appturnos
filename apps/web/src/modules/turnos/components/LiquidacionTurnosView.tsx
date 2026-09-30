import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DollarSign, Calendar, Clock, ChevronDown, Download, Loader2, AlertTriangle } from 'lucide-react';
import { useLiquidacionTurnos, usePeriodoActivoTurnos } from '../hooks/useTurnos';
import { turnosApi } from '../api/turnosApi';
import { ErrorState } from '@/shared/components/ErrorState';
import { StatCard } from '@/shared/components/StatCard';
import { fmtCOP, fmtHrs, fmtDate, bogotaToday, inicioMesActual } from '@/shared/lib/format';
import { descargarBlob } from '@/shared/lib/download';
import type { LiquidacionTurnosTrabajador, LiquidacionTurno } from '../types';

async function descargarContrato(asignacionId: number) {
  const blob = await turnosApi.descargarContratoPorAsignacion(asignacionId);
  descargarBlob(blob, `contrato-turno-${asignacionId}.pdf`);
}

function fmtHora(dt: string | null): string {
  return dt ? dt.slice(11, 16) : '—';
}

type Vista = 'trabajador' | 'turno';

interface TurnoGrupo {
  oferta_id: number;
  oferta_titulo: string;
  oferta_fecha: string;
  hora_inicio: string;
  hora_fin_estimada: string | null;
  lugar: string | null;
  total_horas: number;
  total_pago: number;
  pendientes_firma: number;
  lineas: (LiquidacionTurno & { trabajador_id: number; nombre: string; apellido: string })[];
}

/** Misma liquidación, reagrupada por turno en vez de por trabajador — útil
 *  para ver de un vistazo cuánta gente cubrió un turno puntual y su costo total. */
function agruparPorTurno(trabajadores: LiquidacionTurnosTrabajador[]): TurnoGrupo[] {
  const grupos = new Map<number, TurnoGrupo>();
  for (const w of trabajadores) {
    for (const t of w.turnos) {
      let g = grupos.get(t.oferta_id);
      if (!g) {
        g = {
          oferta_id: t.oferta_id,
          oferta_titulo: t.oferta_titulo,
          oferta_fecha: t.oferta_fecha,
          hora_inicio: t.hora_inicio,
          hora_fin_estimada: t.hora_fin_estimada,
          lugar: t.lugar,
          total_horas: 0,
          total_pago: 0,
          pendientes_firma: 0,
          lineas: [],
        };
        grupos.set(t.oferta_id, g);
      }
      g.lineas.push({ ...t, trabajador_id: w.trabajador_id, nombre: w.nombre, apellido: w.apellido });
      // Mismo criterio que el total por trabajador: un turno sin firmar no
      // cuenta en el total a pagar todavía (ver asignaciones.liquidacion.model.js).
      if (t.firmado_trabajador) {
        g.total_horas += t.horas_trabajadas;
        g.total_pago += t.pago_total;
      } else {
        g.pendientes_firma++;
      }
    }
  }
  return Array.from(grupos.values()).sort((a, b) => (a.oferta_fecha < b.oferta_fecha ? 1 : -1));
}

export function LiquidacionTurnosView() {
  const [fechaInicio, setFechaInicio] = useState(inicioMesActual());
  const [fechaFin, setFechaFin] = useState(bogotaToday());
  const [fechaTocada, setFechaTocada] = useState(false);
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());
  const [turnosExpandidos, setTurnosExpandidos] = useState<Set<number>>(new Set());
  const [gruposExpandidos, setGruposExpandidos] = useState<Set<number>>(new Set());
  const [descargando, setDescargando] = useState<number | null>(null);
  const [vista, setVista] = useState<Vista>('trabajador');

  async function handleDescargarContrato(asignacionId: number) {
    setDescargando(asignacionId);
    try {
      await descargarContrato(asignacionId);
    } catch {
      toast.error('No se pudo descargar el contrato.');
    } finally {
      setDescargando(null);
    }
  }

  // Por defecto, el rango es el período de liquidación activo de la empresa
  // (mensual/quincenal/semanal) — si el usuario edita las fechas a mano, se
  // respeta su elección y se deja de sincronizar con el período.
  const { data: periodoActivoResp } = usePeriodoActivoTurnos();
  const periodoTurnos = periodoActivoResp?.data?.turnos;
  useEffect(() => {
    if (!fechaTocada && periodoTurnos) {
      setFechaInicio(periodoTurnos.fecha_inicio);
      setFechaFin(periodoTurnos.fecha_fin);
    }
  }, [periodoTurnos, fechaTocada]);

  function onFechaInicioChange(v: string) {
    setFechaTocada(true);
    setFechaInicio(v);
  }
  function onFechaFinChange(v: string) {
    setFechaTocada(true);
    setFechaFin(v);
  }

  const { data, isLoading, isError, error, refetch } = useLiquidacionTurnos({ fecha_inicio: fechaInicio, fecha_fin: fechaFin });
  const trabajadores: LiquidacionTurnosTrabajador[] = data?.data ?? [];
  const turnosAgrupados = useMemo(() => agruparPorTurno(trabajadores), [trabajadores]);

  function toggleTrabajador(id: number) {
    setExpandidos(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleGrupo(ofertaId: number) {
    setGruposExpandidos(prev => {
      const next = new Set(prev);
      next.has(ofertaId) ? next.delete(ofertaId) : next.add(ofertaId);
      return next;
    });
  }

  function toggleTurno(asignacionId: number) {
    setTurnosExpandidos(prev => {
      const next = new Set(prev);
      next.has(asignacionId) ? next.delete(asignacionId) : next.add(asignacionId);
      return next;
    });
  }

  const totales = trabajadores.reduce(
    (acc, w) => ({
      turnos: acc.turnos + w.total_turnos,
      horas: acc.horas + Number(w.total_horas),
      pago: acc.pago + Number(w.pago_total),
    }),
    { turnos: 0, horas: 0, pago: 0 }
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <label className="text-sm text-muted-foreground">
          Desde
          <input
            type="date"
            value={fechaInicio}
            max={fechaFin}
            onChange={e => onFechaInicioChange(e.target.value)}
            className="ml-2 border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
        <label className="text-sm text-muted-foreground">
          Hasta
          <input
            type="date"
            value={fechaFin}
            min={fechaInicio}
            onChange={e => onFechaFinChange(e.target.value)}
            className="ml-2 border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>

        <div className="flex gap-1 ml-auto border border-border rounded-lg p-0.5">
          {([{ v: 'trabajador' as const, label: 'Por trabajador' }, { v: 'turno' as const, label: 'Por turno' }]).map(({ v, label }) => (
            <button
              key={v}
              onClick={() => setVista(v)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                vista === v ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm py-8 text-center">Cargando...</p>
      ) : isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <StatCard label="Total a pagar" value={fmtCOP(totales.pago)} icon={DollarSign} color="warning" />
            <StatCard label="Turnos completados" value={totales.turnos} icon={Calendar} />
            <StatCard label="Horas trabajadas" value={fmtHrs(totales.horas)} icon={Clock} />
          </div>

          {vista === 'trabajador' ? (
          trabajadores.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Sin turnos completados en este rango</p>
          ) : (
            <div className="flex flex-col gap-2">
              {trabajadores.map(w => {
                const abierto = expandidos.has(w.trabajador_id);
                return (
                  <div key={w.trabajador_id} className="bg-card border border-border rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleTrabajador(w.trabajador_id)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted transition-colors"
                    >
                      <div>
                        <p className="font-medium text-foreground">{w.nombre} {w.apellido}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          {w.cargo ? `${w.cargo} · ` : ''}{w.total_turnos} turno{w.total_turnos !== 1 ? 's' : ''}
                          {w.turnos_pendientes_firma > 0 && (
                            <span className="flex items-center gap-0.5 text-warning font-medium">
                              <AlertTriangle size={11} />
                              {w.turnos_pendientes_firma} sin firmar
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="flex items-center gap-3">
                        <span className="font-semibold text-foreground">{fmtCOP(w.pago_total)}</span>
                        <ChevronDown size={16} className={`text-muted-foreground transition-transform ${abierto ? 'rotate-180' : ''}`} />
                      </span>
                    </button>
                    {abierto && (
                      <div className="border-t border-border">
                        {w.turnos.length === 0 ? (
                          <p className="text-xs text-muted-foreground px-4 py-3">Sin turnos en este rango</p>
                        ) : (
                          w.turnos.map(t => {
                            const turnoAbierto = turnosExpandidos.has(t.asignacion_id);
                            return (
                              <div key={t.asignacion_id} className="border-t border-border/60 first:border-t-0">
                                <button
                                  onClick={() => toggleTurno(t.asignacion_id)}
                                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-left hover:bg-muted transition-colors"
                                >
                                  <div>
                                    <p className="text-foreground flex items-center gap-1.5">
                                      {t.oferta_titulo}
                                      {!t.firmado_trabajador && (
                                        <span title="Contrato sin firmar — no incluido en el total a pagar">
                                          <AlertTriangle size={12} className="text-warning" />
                                        </span>
                                      )}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {fmtDate(t.oferta_fecha)} · {t.hora_inicio}{t.hora_fin_estimada ? ` – ${t.hora_fin_estimada}` : ''}
                                    </p>
                                  </div>
                                  <span className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
                                    {fmtCOP(t.pago_total)}
                                    <ChevronDown size={14} className={`transition-transform ${turnoAbierto ? 'rotate-180' : ''}`} />
                                  </span>
                                </button>
                                {turnoAbierto && (
                                  <div className="px-4 py-2.5 bg-muted/40 text-xs text-muted-foreground">
                                    {!t.firmado_trabajador && (
                                      <p className="flex items-center gap-1.5 text-warning font-medium mb-2">
                                        <AlertTriangle size={12} />
                                        Contrato sin firmar — este pago no cuenta en el total del período
                                      </p>
                                    )}
                                    <div className="grid grid-cols-2 gap-1.5">
                                      <span>Lugar: {t.lugar ?? '—'}</span>
                                      <span>Cargo: {t.cargo_nombre}</span>
                                      <span>Ingreso real: {fmtHora(t.hora_ingreso_real)}</span>
                                      <span>Egreso real: {fmtHora(t.hora_egreso_real)}</span>
                                      <span>Horas trabajadas: {fmtHrs(t.horas_trabajadas)}</span>
                                      <span>Tarifa día: {fmtCOP(t.tarifa_dia)}</span>
                                      {t.pago_extra > 0 && <span>Pago extra: {fmtCOP(t.pago_extra)}</span>}
                                      {t.bono_monto > 0 && (
                                        <span>Bono: {fmtCOP(t.bono_monto)}{t.bono_motivo ? ` (${t.bono_motivo})` : ''}</span>
                                      )}
                                      {t.calificacion != null && <span>Calificación: {t.calificacion}★</span>}
                                    </div>
                                    <button
                                      onClick={() => handleDescargarContrato(t.asignacion_id)}
                                      disabled={descargando === t.asignacion_id}
                                      className="mt-2 flex items-center gap-1.5 text-primary hover:underline disabled:opacity-60"
                                    >
                                      {descargando === t.asignacion_id
                                        ? <Loader2 size={13} className="animate-spin" />
                                        : <Download size={13} />}
                                      Descargar contrato
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
          ) : turnosAgrupados.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Sin turnos completados en este rango</p>
          ) : (
            <div className="flex flex-col gap-2">
              {turnosAgrupados.map(g => {
                const abierto = gruposExpandidos.has(g.oferta_id);
                return (
                  <div key={g.oferta_id} className="bg-card border border-border rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleGrupo(g.oferta_id)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted transition-colors"
                    >
                      <div>
                        <p className="font-medium text-foreground">{g.oferta_titulo}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          {fmtDate(g.oferta_fecha)}{g.lugar ? ` · ${g.lugar}` : ''} · {g.lineas.length} trabajador{g.lineas.length !== 1 ? 'es' : ''}
                          {g.pendientes_firma > 0 && (
                            <span className="flex items-center gap-0.5 text-warning font-medium">
                              <AlertTriangle size={11} />
                              {g.pendientes_firma} sin firmar
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="flex items-center gap-3">
                        <span className="font-semibold text-foreground">{fmtCOP(g.total_pago)}</span>
                        <ChevronDown size={16} className={`text-muted-foreground transition-transform ${abierto ? 'rotate-180' : ''}`} />
                      </span>
                    </button>
                    {abierto && (
                      <div className="border-t border-border">
                        {g.lineas.map(l => (
                          <div key={l.asignacion_id} className="border-t border-border/60 first:border-t-0 px-4 py-2.5">
                            <div className="flex items-center justify-between text-sm">
                              <div>
                                <p className="text-foreground flex items-center gap-1.5">
                                  {l.nombre} {l.apellido}
                                  {!l.firmado_trabajador && (
                                    <span title="Contrato sin firmar — no incluido en el total a pagar">
                                      <AlertTriangle size={12} className="text-warning" />
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {l.cargo_nombre} · {fmtHrs(l.horas_trabajadas)}
                                </p>
                              </div>
                              <span className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
                                {fmtCOP(l.pago_total)}
                                <button
                                  onClick={() => handleDescargarContrato(l.asignacion_id)}
                                  disabled={descargando === l.asignacion_id}
                                  title="Descargar contrato"
                                  className="text-primary hover:underline disabled:opacity-60"
                                >
                                  {descargando === l.asignacion_id
                                    ? <Loader2 size={13} className="animate-spin" />
                                    : <Download size={13} />}
                                </button>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
