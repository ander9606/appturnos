import { SkeletonStats } from '@/shared/components/Skeleton';
import { puedeGestionarNomina } from '../permisos';
import { useState } from 'react';
import { Download, Plus, Pencil, CalendarClock, BedDouble, ChevronDown, X, Users, Wallet, DollarSign, Landmark, AlertTriangle, Zap } from 'lucide-react';
import { useDescartarSospechoso } from '../hooks/useNomina';
import type { EstadoPeriodo, Registro, DescuentoNomina, DescansoCompensatorio, LiquidacionData, LiquidacionLinea } from '../types';
import { ErrorState } from '@/shared/components/ErrorState';
import { StatCard } from '@/shared/components/StatCard';
import { UbicacionLink } from '@/shared/components/UbicacionLink';
import { fmtCOP, fmtHrs, fmtDiaSemana, fmtHora } from '@/shared/lib/format';
import { TIPO_DIA_LABELS, ESTADO_DESCUENTO_BADGE } from '../constants';
import { AlmuerzoIndicator, ExtraIndicator } from './DiaIndicators';
import { PagoDesglose } from './PagoDesglose';
import { MarcarCompensatorioModal } from './MarcarCompensatorioModal';

export function LiquidacionTab({
  periodoEstado, liqData, loading, error, onRetry, registros, descuentos,
  compensatorioDe, onExport, onCorregir, onReasignar, onAbrirDescuentos, onShowCrear, periodoInicio,
}: {
  periodoEstado: EstadoPeriodo | undefined;
  periodoInicio?: string;
  liqData: LiquidacionData | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  registros: Registro[];
  descuentos: DescuentoNomina[];
  compensatorioDe: (r: Registro) => DescansoCompensatorio | undefined;
  onExport: () => void;
  onCorregir: (id: number) => void;
  onReasignar: (c: DescansoCompensatorio) => void;
  onAbrirDescuentos: (trabajadorId: number, nombre: string) => void;
  onShowCrear: (trabajador?: { id: number; nombre: string }) => void;
}) {
  const [expandidosLiq, setExpandidosLiq] = useState<Set<number>>(new Set());
  const descartarSospechoso = useDescartarSospechoso();
  const [marcando, setMarcando] = useState<Registro | null>(null);

  function toggleExpandidoLiq(trabajadorId: number) {
    setExpandidosLiq(prev => {
      const next = new Set(prev);
      next.has(trabajadorId) ? next.delete(trabajadorId) : next.add(trabajadorId);
      return next;
    });
  }

  return (
    <div>
      {loading ? (
        <SkeletonStats />
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : liqData ? (
        <div>
          {(() => {
            const esLaboral = liqData.tipo_contrato === 'laboral';
            const { trabajadores, total_general, total_neto_general } = liqData.totales;
            const totalExtraPeriodo = liqData.lineas.reduce(
              (s, l) => s + Number(l.pago_nocturno) + Number(l.pago_extra_diurno) +
                Number(l.pago_extra_nocturno) + Number(l.pago_festivo),
              0
            );
            return (
              <div className={`grid gap-4 mb-6 ${esLaboral ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {/* El neto es la cifra que se paga: va primero. Con el período abierto todavía cambia. */}
                <StatCard
                  label={esLaboral ? 'Total neto a pagar' : 'Total a pagar'}
                  value={fmtCOP(esLaboral ? total_neto_general : total_general)}
                  icon={DollarSign}
                  color="success"
                  badge={periodoEstado === 'abierto' ? 'Estimado' : undefined}
                  caption={totalExtraPeriodo > 0 ? `⚡ incluye ${fmtCOP(totalExtraPeriodo)} en horas extra` : undefined}
                />
                {esLaboral && <StatCard label="Total bruto" value={fmtCOP(total_general)} icon={Wallet} />}
                <StatCard label="Trabajadores" value={trabajadores} icon={Users} />
              </div>
            );
          })()}

          <div className="flex justify-end mb-3">
            <button
              onClick={onExport}
              className="flex items-center gap-1.5 border border-border hover:bg-muted text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              <Download size={14} /> Exportar XLSX
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {(liqData.lineas as LiquidacionLinea[]).map(l => {
              const abierto = expandidosLiq.has(l.trabajador_id) || liqData.lineas.length === 1;
              const otrosDelTrabajador = descuentos.filter(d => d.trabajador_id === l.trabajador_id);
              const diasTrabajador = registros
                .filter(r => r.trabajador_id === l.trabajador_id)
                .sort((a, b) => a.fecha.localeCompare(b.fecha));
              const pagoExtra =
                Number(l.pago_nocturno) + Number(l.pago_extra_diurno) +
                Number(l.pago_extra_nocturno) + Number(l.pago_festivo);

              return (
                <div key={l.trabajador_id} className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted transition-colors">
                    <button
                      onClick={() => toggleExpandidoLiq(l.trabajador_id)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <p className="font-medium text-foreground">{l.nombre} {l.apellido}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                        {l.dias_registrados} día{l.dias_registrados !== 1 ? 's' : ''} trabajado{l.dias_registrados !== 1 ? 's' : ''}
                        {pagoExtra > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-warning font-medium">
                            <Zap size={11} /> +{fmtCOP(pagoExtra)} extra
                          </span>
                        )}
                      </p>
                    </button>
                    {puedeGestionarNomina() && (
                      <button
                        onClick={() => onShowCrear({ id: l.trabajador_id, nombre: `${l.nombre} ${l.apellido}` })}
                        title={`Agregar registro para ${l.nombre} ${l.apellido}`}
                        className="flex items-center gap-1 text-xs font-medium text-success hover:text-success-600 border border-success/30 hover:border-success/50 rounded-lg px-2 py-0.5 transition-colors flex-shrink-0 mx-2"
                      >
                        <Plus size={12} /> Agregar
                      </button>
                    )}
                    <button
                      onClick={() => toggleExpandidoLiq(l.trabajador_id)}
                      className="flex items-center gap-3 flex-shrink-0"
                    >
                      <span className="font-semibold text-success">{fmtCOP(l.neto)}</span>
                      <ChevronDown size={16} className={`text-muted-foreground transition-transform ${abierto ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {abierto && (
                    <div className="border-t border-border">
                      {/* De dónde sale el pago: barra + conceptos + bruto → descuentos → neto */}
                      <div className="px-4 py-3">
                        <PagoDesglose linea={l} />
                      </div>

                      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-t border-border bg-muted/40 text-xs flex-wrap">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Landmark size={13} className="flex-shrink-0" />
                          {l.numero_cuenta
                            ? `${l.banco} · ${l.tipo_cuenta === 'corriente' ? 'Corriente' : 'Ahorros'} · ${l.numero_cuenta}`
                            : 'Sin datos bancarios'}
                        </span>
                        <button
                          onClick={() => onAbrirDescuentos(l.trabajador_id, `${l.nombre} ${l.apellido}`)}
                          className="flex items-center gap-1 font-medium text-success hover:text-success-600 transition-colors flex-shrink-0"
                        >
                          {otrosDelTrabajador.length > 0 ? (
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                              otrosDelTrabajador.some(d => d.estado === 'pendiente') ? ESTADO_DESCUENTO_BADGE.pendiente : 'bg-muted text-muted-foreground'
                            }`}>
                              {otrosDelTrabajador.length}
                            </span>
                          ) : null}
                          <Plus size={12} /> {otrosDelTrabajador.length > 0 ? 'Ver descuentos' : 'Agregar descuento'}
                        </button>
                      </div>

                      <div className="px-4 pt-3 pb-1">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Días trabajados ({diasTrabajador.length})
                        </p>
                      </div>

                      {diasTrabajador.length === 0 ? (
                        <p className="text-xs text-muted-foreground px-4 py-3">Sin registros de días</p>
                      ) : (
                        diasTrabajador.map(r => (
                          <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 border-t border-border/60 text-sm">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-foreground font-medium">{fmtDiaSemana(r.fecha)}</span>
                                {r.tipo_dia !== 'ordinario' && (
                                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-info-light text-info">
                                    {TIPO_DIA_LABELS[r.tipo_dia]}
                                  </span>
                                )}
                                {puedeGestionarNomina() && r.sospechoso === 1 && (
                                  <button
                                    onClick={() => descartarSospechoso.mutate(r.id)}
                                    disabled={descartarSospechoso.isPending}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-warning-light text-warning disabled:opacity-50"
                                    title="Mismo dispositivo y ubicación que otro trabajador — click para descartar (ya lo revisé)"
                                  >
                                    <AlertTriangle size={10} /> Sospechoso <X size={10} />
                                  </button>
                                )}
                              </div>
                              {r.novedad && <p className="text-xs text-muted-foreground mt-0.5">{r.novedad}</p>}
                              {(r.latitud_entrada != null || r.latitud_salida != null) && (
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                                  {r.latitud_entrada != null && (
                                    <UbicacionLink lat={r.latitud_entrada} lng={r.longitud_entrada!} label="Entrada" />
                                  )}
                                  {r.latitud_salida != null && (
                                    <UbicacionLink lat={r.latitud_salida} lng={r.longitud_salida!} label="Salida" />
                                  )}
                                </div>
                              )}
                            </div>
                            {r.hora_entrada ? (
                              <span className="text-xs text-muted-foreground text-right flex-shrink-0">
                                <span className="inline-flex items-center gap-1">
                                  {fmtHora(r.hora_entrada_inicial ?? r.hora_entrada)} – {fmtHora(r.hora_salida)}
                                  <AlmuerzoIndicator r={r} />
                                </span>
                                <br />
                                {fmtHrs(r.horas_ordinarias)} h
                                {Number(r.horas_nocturnas) > 0 && ` + ${fmtHrs(r.horas_nocturnas)} h noct.`}
                                {Number(r.horas_extra_diurnas) + Number(r.horas_extra_nocturnas) > 0 && (
                                  <> + {fmtHrs(Number(r.horas_extra_diurnas) + Number(r.horas_extra_nocturnas))} h extra <ExtraIndicator r={r} periodoInicio={periodoInicio} /></>
                                )}
                                {Number(r.horas_festivo) > 0 && ` + ${fmtHrs(r.horas_festivo)} h festivo`}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground/60 flex-shrink-0">Sin marcaje</span>
                            )}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {puedeGestionarNomina() && (
                              <button
                                onClick={() => onCorregir(r.id)}
                                className="text-muted-foreground/60 hover:text-success transition-colors"
                                aria-label="Corregir registro"
                              >
                                <Pencil size={14} />
                              </button>
                              )}
                              {puedeGestionarNomina() && compensatorioDe(r) && (
                                <button
                                  onClick={() => onReasignar(compensatorioDe(r)!)}
                                  className="text-muted-foreground/60 hover:text-info transition-colors"
                                  aria-label="Reasignar descanso compensatorio"
                                  title="Reasignar descanso compensatorio"
                                >
                                  <CalendarClock size={14} />
                                </button>
                              )}
                              {puedeGestionarNomina() && r.tipo_dia !== 'compensatorio' && (
                                <button
                                  onClick={() => setMarcando(r)}
                                  className="text-muted-foreground/60 hover:text-info transition-colors disabled:opacity-50"
                                  aria-label="Marcar como compensatorio"
                                  title="Marcar como compensatorio"
                                >
                                  <BedDouble size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      {marcando && <MarcarCompensatorioModal registro={marcando} onClose={() => setMarcando(null)} />}
    </div>
  );
}
