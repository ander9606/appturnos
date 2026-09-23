import { useState } from 'react';
import { Download, Plus, Pencil, CalendarClock, BedDouble, ChevronDown, X, Users, Wallet, DollarSign, Landmark, AlertTriangle, Zap } from 'lucide-react';
import { useCorregirRegistro, useDescartarSospechoso } from '../hooks/useNomina';
import type { EstadoPeriodo, Registro, DescuentoNomina, DescansoCompensatorio, LiquidacionData, LiquidacionLinea } from '../types';
import { ErrorState } from '@/shared/components/ErrorState';
import { StatCard } from '@/shared/components/StatCard';
import { UbicacionLink } from '@/shared/components/UbicacionLink';
import { fmtCOP, fmtHrs, fmtDiaSemana, fmtHora } from '@/shared/lib/format';
import { TIPO_DIA_LABELS, TIPO_DESCUENTO_LABELS, ESTADO_DESCUENTO_BADGE } from '../constants';
import { AlmuerzoIndicator, ExtraIndicator } from './DiaIndicators';
import { Renglon } from './Renglon';

export function LiquidacionTab({
  periodoEstado, liqData, loading, error, onRetry, registros, descuentos,
  compensatorioDe, onExport, onCorregir, onReasignar, onAbrirDescuentos,
}: {
  periodoEstado: EstadoPeriodo | undefined;
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
}) {
  const [expandidosLiq, setExpandidosLiq] = useState<Set<number>>(new Set());
  const descartarSospechoso = useDescartarSospechoso();
  const corregirTipoDia = useCorregirRegistro();

  function marcarCompensatorio(r: Registro) {
    const ok = window.confirm(
      `¿Marcar el ${fmtDiaSemana(r.fecha)} de ${r.trabajador_nombre} ${r.trabajador_apellido} como su día de descanso compensatorio?`
    );
    if (ok) corregirTipoDia.mutate({ id: r.id, tipo_dia: 'compensatorio' });
  }

  function toggleExpandidoLiq(trabajadorId: number) {
    setExpandidosLiq(prev => {
      const next = new Set(prev);
      next.has(trabajadorId) ? next.delete(trabajadorId) : next.add(trabajadorId);
      return next;
    });
  }

  return (
    <div>
      {periodoEstado === 'abierto' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-warning text-sm mb-4">
          Estimado — el período sigue abierto, estos montos pueden cambiar hasta que se cierre.
        </div>
      )}
      {loading ? (
        <p className="text-muted-foreground text-sm py-8 text-center">Cargando...</p>
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
                <StatCard label="Trabajadores" value={trabajadores} icon={Users} />
                <StatCard
                  label={esLaboral ? 'Total bruto' : 'Total a pagar'}
                  value={fmtCOP(total_general)}
                  icon={Wallet}
                  caption={totalExtraPeriodo > 0 ? `⚡ incluye ${fmtCOP(totalExtraPeriodo)} en horas extra` : undefined}
                />
                {esLaboral && (
                  <StatCard
                    label="Total neto (con descuentos)"
                    value={fmtCOP(total_neto_general)}
                    icon={DollarSign}
                    color="success"
                  />
                )}
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
              const esLaboral = liqData.tipo_contrato === 'laboral';
              const pagoExtra =
                Number(l.pago_nocturno) + Number(l.pago_extra_diurno) +
                Number(l.pago_extra_nocturno) + Number(l.pago_festivo);

              return (
                <div key={l.trabajador_id} className="bg-card border border-border rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleExpandidoLiq(l.trabajador_id)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted transition-colors"
                  >
                    <div>
                      <p className="font-medium text-foreground">{l.nombre} {l.apellido}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                        {l.dias_registrados} día{l.dias_registrados !== 1 ? 's' : ''} trabajado{l.dias_registrados !== 1 ? 's' : ''}
                        {pagoExtra > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-warning font-medium">
                            <Zap size={11} /> +{fmtCOP(pagoExtra)} extra
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="flex items-center gap-3">
                      <span className="font-semibold text-success">{fmtCOP(l.neto)}</span>
                      <ChevronDown size={16} className={`text-muted-foreground transition-transform ${abierto ? 'rotate-180' : ''}`} />
                    </span>
                  </button>

                  {abierto && (
                    <div className="border-t border-border">
                      {/* Recibo — salario base resaltado, luego recargos/extra desglosados, luego neto */}
                      <div className="px-4 py-3 flex flex-col gap-3 text-sm">
                        <div className="bg-muted/60 rounded-lg px-3 py-2.5">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Salario base</p>
                          <Renglon
                            label={`${fmtHrs(l.horas_ordinarias)} h ordinarias × ${fmtCOP(l.valor_hora)}`}
                            valor={fmtCOP(l.pago_ordinario)}
                            fuerte
                            grande
                          />
                        </div>

                        {pagoExtra > 0 && (
                          <div className="bg-warning-light rounded-lg px-3 py-2.5 flex flex-col gap-1.5">
                            <p className="text-xs font-semibold text-warning uppercase tracking-wide mb-0.5 flex items-center gap-1">
                              <Zap size={12} /> Horas extra y recargos
                            </p>
                            {Number(l.horas_nocturnas) > 0 && (
                              <Renglon label={`${fmtHrs(l.horas_nocturnas)} h nocturnas × ${fmtCOP(l.valor_hora)} × ${l.recargo_nocturno}`} valor={fmtCOP(l.pago_nocturno)} />
                            )}
                            {Number(l.horas_extra_diurnas) > 0 && (
                              <Renglon label={`${fmtHrs(l.horas_extra_diurnas)} h extra diurna × ${fmtCOP(l.valor_hora)} × 1.25`} valor={fmtCOP(l.pago_extra_diurno)} />
                            )}
                            {Number(l.horas_extra_nocturnas) > 0 && (
                              <Renglon label={`${fmtHrs(l.horas_extra_nocturnas)} h extra nocturna × ${fmtCOP(l.valor_hora)} × 1.75`} valor={fmtCOP(l.pago_extra_nocturno)} />
                            )}
                            {Number(l.horas_festivo) > 0 && (
                              <Renglon label={`${fmtHrs(l.horas_festivo)} h festivo/dominical × ${fmtCOP(l.valor_hora)} × ${l.recargo_festivo}`} valor={fmtCOP(l.pago_festivo)} />
                            )}
                            <div className="border-t border-warning/30 my-0.5" />
                            <Renglon label="Subtotal extra" valor={fmtCOP(pagoExtra)} fuerte tono="warning" />
                          </div>
                        )}

                        <Renglon label="Total bruto" valor={fmtCOP(l.total)} fuerte grande />
                        {esLaboral && (
                          <>
                            <Renglon label="Salud" valor={`-${fmtCOP(l.descuento_salud)}`} tono="danger" />
                            <Renglon label="Pensión" valor={`-${fmtCOP(l.descuento_pension)}`} tono="danger" />
                          </>
                        )}
                        {l.otros_descuentos.map(d => (
                          <Renglon key={d.id} label={d.motivo || TIPO_DESCUENTO_LABELS[d.tipo]} valor={`-${fmtCOP(d.monto)}`} tono="danger" />
                        ))}
                        {l.subsidio_transporte > 0 && (
                          <Renglon label="Auxilio de transporte" valor={`+${fmtCOP(l.subsidio_transporte)}`} tono="success" />
                        )}
                        <div className="border-t border-border my-1" />
                        <Renglon label="Total neto" valor={fmtCOP(l.neto)} fuerte tono="success" grande />
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
                                {r.sospechoso === 1 && (
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
                                  <> + {fmtHrs(Number(r.horas_extra_diurnas) + Number(r.horas_extra_nocturnas))} h extra <ExtraIndicator r={r} /></>
                                )}
                                {Number(r.horas_festivo) > 0 && ` + ${fmtHrs(r.horas_festivo)} h festivo`}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground/60 flex-shrink-0">Sin marcaje</span>
                            )}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <button
                                onClick={() => onCorregir(r.id)}
                                className="text-muted-foreground/60 hover:text-success transition-colors"
                                aria-label="Corregir registro"
                              >
                                <Pencil size={14} />
                              </button>
                              {compensatorioDe(r) && (
                                <button
                                  onClick={() => onReasignar(compensatorioDe(r)!)}
                                  className="text-muted-foreground/60 hover:text-info transition-colors"
                                  aria-label="Reasignar descanso compensatorio"
                                  title="Reasignar descanso compensatorio"
                                >
                                  <CalendarClock size={14} />
                                </button>
                              )}
                              {r.tipo_dia !== 'compensatorio' && (
                                <button
                                  onClick={() => marcarCompensatorio(r)}
                                  disabled={corregirTipoDia.isPending}
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
    </div>
  );
}
