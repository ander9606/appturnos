import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Download, Plus, Pencil, ChevronDown, X, Trash2, Users, Wallet, DollarSign, Landmark } from 'lucide-react';
import { toast } from 'sonner';
import {
  usePeriodos, useRegistros, useLiquidacion, useTrabajadoresNomina,
  useCorregirRegistro, useCrearRegistro,
  useDescuentosPeriodo, useCrearDescuento, useEliminarDescuento,
} from '../hooks/useNomina';
import type { EstadoPeriodo, TipoDia, Registro, Trabajador, LiquidacionLinea, TipoDescuento, DescuentoNomina } from '../types';
import { ErrorState } from '@/shared/components/ErrorState';
import { Modal } from '@/shared/components/Modal';
import { ConfirmModal } from '@/shared/components/ConfirmModal';
import { StatCard } from '@/shared/components/StatCard';
import { UbicacionLink } from '@/shared/components/UbicacionLink';
import { useConfirm } from '@/shared/hooks/useConfirm';
import { fmtPeriodo, fmtCOP, fmtHrs, fmtDiaSemana, fmtHora } from '@/shared/lib/format';

const TIPO_DIA_LABELS: Record<TipoDia, string> = {
  ordinario: 'Ordinario',
  descanso: 'Descanso',
  compensatorio: 'Compensatorio',
  incapacidad: 'Incapacidad',
  vacacion: 'Vacación',
  licencia: 'Licencia',
};

const TIPO_DESCUENTO_LABELS: Record<TipoDescuento, string> = {
  prestamo: 'Préstamo',
  inasistencia: 'Inasistencia',
  dano_equipo: 'Daño a equipo',
  anticipo: 'Anticipo',
  otro: 'Otro',
};

const ESTADO_DESCUENTO_BADGE: Record<string, string> = {
  pendiente: 'bg-warning-light text-warning',
  aceptado: 'bg-success-light text-success',
  rechazado: 'bg-muted text-muted-foreground',
};

const ESTADO_BADGE: Record<EstadoPeriodo, string> = {
  abierto: 'bg-success-light text-success',
  cerrado: 'bg-warning-light text-warning',
  liquidado: 'bg-muted text-muted-foreground',
};

const TIPO_DIA_OPTIONS: TipoDia[] = ['ordinario','descanso','compensatorio','incapacidad','vacacion','licencia'];

export function PeriodoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const periodoId = Number(id);
  const navigate = useNavigate();
  const [tab, setTab] = useState<'liquidacion' | 'registros'>('liquidacion');
  const [filtroTrabajador, setFiltroTrabajador] = useState<number | undefined>(undefined);
  const [corrigiendoId, setCorrigiendoId] = useState<number | null>(null);
  const [showCrear, setShowCrear] = useState(false);
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());
  const [expandidosLiq, setExpandidosLiq] = useState<Set<number>>(new Set());
  const [descuentoTrabajador, setDescuentoTrabajador] = useState<{ id: number; nombre: string } | null>(null);

  const { data: periodosData, isLoading: loadingPeriodos, isError: errorPeriodos, error: errPeriodos, refetch: refetchPeriodos } = usePeriodos();
  const periodo = (periodosData?.data?.data ?? []).find((p: { id: number }) => p.id === periodoId);

  const { data: descuentosData } = useDescuentosPeriodo(periodoId);
  const descuentos: DescuentoNomina[] = descuentosData?.data ?? [];

  const { data: registrosData, isLoading: loadingReg, isError: errorReg, error: errReg, refetch: refetchReg } = useRegistros({ periodo_id: periodoId });
  const registros: Registro[] = registrosData?.data?.data ?? [];

  const { data: liqData, isLoading: loadingLiq, isError: errorLiq, error: errLiq, refetch: refetchLiq } = useLiquidacion(
    tab === 'liquidacion' ? periodoId : null
  );

  const registrosFiltrados = filtroTrabajador
    ? registros.filter(r => r.trabajador_id === filtroTrabajador)
    : registros;

  const trabajadoresEnPeriodo = Array.from(
    new Map(registros.map(r => [r.trabajador_id, { nombre: r.trabajador_nombre, apellido: r.trabajador_apellido }])).entries()
  ).map(([tid, t]) => ({ id: tid, nombre: t.nombre, apellido: t.apellido }));

  const gruposPorTrabajador = Array.from(
    registrosFiltrados.reduce((m, r) => {
      if (!m.has(r.trabajador_id)) {
        m.set(r.trabajador_id, { nombre: r.trabajador_nombre, apellido: r.trabajador_apellido, registros: [] as Registro[] });
      }
      m.get(r.trabajador_id)!.registros.push(r);
      return m;
    }, new Map<number, { nombre: string; apellido: string; registros: Registro[] }>())
  )
    .map(([trabajadorId, g]) => ({ trabajadorId, ...g }))
    .sort((a, b) => `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`));

  function toggleExpandido(trabajadorId: number) {
    setExpandidos(prev => {
      const next = new Set(prev);
      next.has(trabajadorId) ? next.delete(trabajadorId) : next.add(trabajadorId);
      return next;
    });
  }

  function toggleExpandidoLiq(trabajadorId: number) {
    setExpandidosLiq(prev => {
      const next = new Set(prev);
      next.has(trabajadorId) ? next.delete(trabajadorId) : next.add(trabajadorId);
      return next;
    });
  }

  const handleExport = async () => {
    const res = await import('../api/nominaApi').then(m => m.nominaApi.exportarLiquidacion(periodoId));
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `liquidacion-${periodoId}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const corrigiendo = corrigiendoId !== null ? registros.find(r => r.id === corrigiendoId) : null;

  const volverBtn = (
    <button
      onClick={() => navigate('/nomina')}
      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
    >
      <ArrowLeft size={16} /> Volver a Nómina
    </button>
  );

  if (errorPeriodos) {
    return (
      <div>
        {volverBtn}
        <ErrorState error={errPeriodos} onRetry={refetchPeriodos} />
      </div>
    );
  }

  if (!loadingPeriodos && !periodo) {
    return (
      <div>
        {volverBtn}
        <p className="text-muted-foreground text-sm py-8 text-center">
          Este período no existe o fue eliminado.
        </p>
      </div>
    );
  }

  return (
    <div>
      {volverBtn}

      {periodo && (
        <div className="bg-card border border-border rounded-xl p-4 mb-6 flex items-center gap-4">
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-0.5">Período</p>
            <p className="font-semibold text-foreground">{fmtPeriodo(periodo.fecha_inicio, periodo.fecha_fin)}</p>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_BADGE[periodo.estado as EstadoPeriodo]}`}>
            {periodo.estado.charAt(0).toUpperCase() + periodo.estado.slice(1)}
          </span>
        </div>
      )}

      <div className="flex gap-1 mb-6 border-b border-border">
        {(['liquidacion', 'registros'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              tab === t ? 'border-success text-success' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'registros' ? 'Registros' : 'Liquidación'}
          </button>
        ))}
      </div>

      {tab === 'registros' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <select
              value={filtroTrabajador ?? ''}
              onChange={e => setFiltroTrabajador(e.target.value ? Number(e.target.value) : undefined)}
              className="border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
            >
              <option value="">Todos los trabajadores</option>
              {trabajadoresEnPeriodo.map(t => (
                <option key={t.id} value={t.id}>{t.nombre} {t.apellido}</option>
              ))}
            </select>
            <button
              onClick={() => setShowCrear(true)}
              className="flex items-center gap-1.5 bg-success hover:bg-success-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus size={14} /> Agregar registro
            </button>
          </div>

          {loadingReg ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Cargando...</p>
          ) : errorReg ? (
            <ErrorState error={errReg} onRetry={refetchReg} />
          ) : gruposPorTrabajador.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Sin registros</p>
          ) : (
            <div className="flex flex-col gap-2">
              {gruposPorTrabajador.map(g => {
                const abierto = expandidos.has(g.trabajadorId) || gruposPorTrabajador.length === 1;
                const totalOrd = g.registros.reduce((s, r) => s + Number(r.horas_ordinarias), 0);
                const totalExtra = g.registros.reduce((s, r) => s + Number(r.horas_extra_diurnas) + Number(r.horas_extra_nocturnas), 0);
                return (
                  <div key={g.trabajadorId} className="bg-card border border-border rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleExpandido(g.trabajadorId)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted transition-colors"
                    >
                      <span className="font-medium text-foreground">{g.nombre} {g.apellido}</span>
                      <span className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{g.registros.length} día{g.registros.length !== 1 ? 's' : ''}</span>
                        <span>{fmtHrs(totalOrd)} hrs ord · {fmtHrs(totalExtra)} hrs extra</span>
                        <ChevronDown size={16} className={`transition-transform ${abierto ? 'rotate-180' : ''}`} />
                      </span>
                    </button>
                    {abierto && (
                      <table className="w-full text-sm border-t border-border">
                        <thead>
                          <tr className="bg-muted text-muted-foreground text-xs uppercase">
                            <th className="text-left px-3 py-2.5 font-medium">Fecha</th>
                            <th className="text-left px-3 py-2.5 font-medium">Entrada</th>
                            <th className="text-left px-3 py-2.5 font-medium">Salida</th>
                            <th className="text-right px-3 py-2.5 font-medium">Hrs Ord</th>
                            <th className="text-right px-3 py-2.5 font-medium">Hrs Extra</th>
                            <th className="text-left px-3 py-2.5 font-medium">Tipo día</th>
                            <th className="text-left px-3 py-2.5 font-medium">Novedad</th>
                            <th className="px-3 py-2.5" />
                          </tr>
                        </thead>
                        <tbody>
                          {g.registros.map(r => (
                            <tr key={r.id} className="border-t border-border/60 hover:bg-muted">
                              <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{fmtDiaSemana(r.fecha)}</td>
                              <td className="px-3 py-2.5 text-muted-foreground">{fmtHora(r.hora_entrada_inicial ?? r.hora_entrada)}</td>
                              <td className="px-3 py-2.5 text-muted-foreground">{fmtHora(r.hora_salida)}</td>
                              <td className="px-3 py-2.5 text-right text-muted-foreground">{fmtHrs(r.horas_ordinarias)}</td>
                              <td className="px-3 py-2.5 text-right text-muted-foreground">
                                {fmtHrs(Number(r.horas_extra_diurnas) + Number(r.horas_extra_nocturnas))}
                              </td>
                              <td className="px-3 py-2.5 text-muted-foreground">{TIPO_DIA_LABELS[r.tipo_dia]}</td>
                              <td className="px-3 py-2.5 text-muted-foreground max-w-32 truncate">{r.novedad ?? ''}</td>
                              <td className="px-3 py-2.5">
                                <button
                                  onClick={() => setCorrigiendoId(r.id)}
                                  className="text-muted-foreground/60 hover:text-success transition-colors"
                                >
                                  <Pencil size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'liquidacion' && (
        <div>
          {periodo?.estado === 'abierto' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-warning text-sm mb-4">
              Estimado — el período sigue abierto, estos montos pueden cambiar hasta que se cierre.
            </div>
          )}
          {loadingLiq ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Cargando...</p>
          ) : errorLiq ? (
            <ErrorState error={errLiq} onRetry={refetchLiq} />
          ) : liqData?.data ? (
            <div>
              {(() => {
                const esLaboral = liqData.data.tipo_contrato === 'laboral';
                const { trabajadores, total_general, total_neto_general } = liqData.data.totales;
                return (
                  <div className={`grid gap-4 mb-6 ${esLaboral ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    <StatCard label="Trabajadores" value={trabajadores} icon={Users} />
                    <StatCard
                      label={esLaboral ? 'Total bruto' : 'Total a pagar'}
                      value={fmtCOP(total_general)}
                      icon={Wallet}
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
                  onClick={handleExport}
                  className="flex items-center gap-1.5 border border-border hover:bg-muted text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Download size={14} /> Exportar XLSX
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {(liqData.data.lineas as LiquidacionLinea[]).map(l => {
                  const abierto = expandidosLiq.has(l.trabajador_id) || liqData.data.lineas.length === 1;
                  const otrosDelTrabajador = descuentos.filter(d => d.trabajador_id === l.trabajador_id);
                  const diasTrabajador = registros
                    .filter(r => r.trabajador_id === l.trabajador_id)
                    .sort((a, b) => a.fecha.localeCompare(b.fecha));
                  const horasExtra = Number(l.horas_extra_diurnas) + Number(l.horas_extra_nocturnas);
                  const esLaboral = liqData.data.tipo_contrato === 'laboral';

                  return (
                    <div key={l.trabajador_id} className="bg-card border border-border rounded-xl overflow-hidden">
                      <button
                        onClick={() => toggleExpandidoLiq(l.trabajador_id)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted transition-colors"
                      >
                        <div>
                          <p className="font-medium text-foreground">{l.nombre} {l.apellido}</p>
                          <p className="text-xs text-muted-foreground">{l.dias_registrados} día{l.dias_registrados !== 1 ? 's' : ''} trabajado{l.dias_registrados !== 1 ? 's' : ''}</p>
                        </div>
                        <span className="flex items-center gap-3">
                          <span className="font-semibold text-success">{fmtCOP(l.neto)}</span>
                          <ChevronDown size={16} className={`text-muted-foreground transition-transform ${abierto ? 'rotate-180' : ''}`} />
                        </span>
                      </button>

                      {abierto && (
                        <div className="border-t border-border">
                          {/* Recibo — de horas a neto, un renglón por concepto */}
                          <div className="px-4 py-3 flex flex-col gap-1.5 text-sm">
                            <Renglon label="Horas ordinarias" valor={`${fmtHrs(l.horas_ordinarias)} h`} />
                            {horasExtra > 0 && <Renglon label="Horas extra" valor={`${fmtHrs(horasExtra)} h`} />}
                            <Renglon label="Valor hora" valor={fmtCOP(l.valor_hora)} />
                            <div className="border-t border-border my-1" />
                            <Renglon label="Total bruto" valor={fmtCOP(l.total)} fuerte />
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
                              onClick={() => setDescuentoTrabajador({ id: l.trabajador_id, nombre: `${l.nombre} ${l.apellido}` })}
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
                                    {fmtHora(r.hora_entrada_inicial ?? r.hora_entrada)} – {fmtHora(r.hora_salida)}
                                    <br />
                                    {fmtHrs(r.horas_ordinarias)} h{Number(r.horas_extra_diurnas) + Number(r.horas_extra_nocturnas) > 0 && ` + ${fmtHrs(Number(r.horas_extra_diurnas) + Number(r.horas_extra_nocturnas))} h extra`}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground/60 flex-shrink-0">Sin marcaje</span>
                                )}
                                <button
                                  onClick={() => setCorrigiendoId(r.id)}
                                  className="text-muted-foreground/60 hover:text-success transition-colors flex-shrink-0"
                                  aria-label="Corregir registro"
                                >
                                  <Pencil size={14} />
                                </button>
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
      )}

      {corrigiendo && (
        <CorregirModal
          registro={corrigiendo}
          onClose={() => setCorrigiendoId(null)}
        />
      )}

      {showCrear && (
        <CrearRegistroModal
          periodoId={periodoId}
          onClose={() => setShowCrear(false)}
        />
      )}

      {descuentoTrabajador && (
        <DescuentoModal
          periodoId={periodoId}
          trabajadorId={descuentoTrabajador.id}
          trabajadorNombre={descuentoTrabajador.nombre}
          descuentos={descuentos.filter(d => d.trabajador_id === descuentoTrabajador.id)}
          onClose={() => setDescuentoTrabajador(null)}
        />
      )}
    </div>
  );
}

/** Un renglón del recibo: etiqueta a la izquierda, monto/valor a la derecha. */
function Renglon({
  label, valor, fuerte, grande, tono,
}: {
  label: string;
  valor: string;
  fuerte?: boolean;
  grande?: boolean;
  tono?: 'danger' | 'success';
}) {
  const colorValor = tono === 'danger' ? 'text-danger' : tono === 'success' ? 'text-success' : 'text-foreground';
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={fuerte ? 'font-medium text-foreground' : 'text-muted-foreground'}>{label}</span>
      <span className={`tabular-nums ${fuerte ? 'font-semibold' : ''} ${grande ? 'text-base' : ''} ${colorValor}`}>{valor}</span>
    </div>
  );
}

function CorregirModal({ registro, onClose }: { registro: Registro; onClose: () => void }) {
  const corregir = useCorregirRegistro();
  const [form, setForm] = useState({
    hora_entrada: registro.hora_entrada ?? '',
    hora_salida: registro.hora_salida ?? '',
    tipo_dia: registro.tipo_dia,
    novedad: registro.novedad ?? '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.hora_entrada && form.hora_salida && form.hora_entrada === form.hora_salida) {
      toast.error('La hora de salida no puede ser igual a la de entrada');
      return;
    }
    await corregir.mutateAsync({
      id: registro.id,
      hora_entrada: form.hora_entrada || undefined,
      hora_salida: form.hora_salida || undefined,
      tipo_dia: form.tipo_dia,
      novedad: form.novedad || undefined,
    });
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-semibold text-foreground mb-1">Corregir registro</h2>
      <p className="text-sm text-muted-foreground mb-4">{fmtDiaSemana(registro.fecha)}</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Hora entrada</label>
            <input
              type="time"
              value={form.hora_entrada}
              onChange={e => setForm(f => ({ ...f, hora_entrada: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Hora salida</label>
            <input
              type="time"
              value={form.hora_salida}
              onChange={e => setForm(f => ({ ...f, hora_salida: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Tipo día</label>
          <select
            value={form.tipo_dia}
            onChange={e => setForm(f => ({ ...f, tipo_dia: e.target.value as TipoDia }))}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
          >
            {TIPO_DIA_OPTIONS.map(o => (
              <option key={o} value={o} className="capitalize">{o.charAt(0).toUpperCase() + o.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Novedad</label>
          <input
            type="text"
            value={form.novedad}
            onChange={e => setForm(f => ({ ...f, novedad: e.target.value }))}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 border border-border hover:bg-muted text-sm font-medium py-2 rounded-lg transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={corregir.isPending} className="flex-1 bg-success hover:bg-success-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">
            {corregir.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CrearRegistroModal({ periodoId, onClose }: { periodoId: number; onClose: () => void }) {
  const crear = useCrearRegistro();
  const { data: trabData } = useTrabajadoresNomina();
  const trabajadores: Trabajador[] = trabData?.data?.data ?? [];
  const hoy = new Date().toLocaleDateString('en-CA');
  const [form, setForm] = useState({
    trabajador_id: '',
    fecha: '',
    hora_entrada: '',
    hora_salida: '',
    novedad: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.hora_salida && form.hora_salida <= form.hora_entrada) {
      toast.error('La hora de salida debe ser posterior a la de entrada');
      return;
    }
    await crear.mutateAsync({
      periodo_id: periodoId,
      trabajador_id: Number(form.trabajador_id),
      fecha: form.fecha,
      hora_entrada: form.hora_entrada,
      hora_salida: form.hora_salida || undefined,
      novedad: form.novedad || undefined,
    });
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-semibold text-foreground mb-4">Agregar registro</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Trabajador *</label>
          <select
            required
            value={form.trabajador_id}
            onChange={e => setForm(f => ({ ...f, trabajador_id: e.target.value }))}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
          >
            <option value="">Seleccionar...</option>
            {trabajadores.map(t => (
              <option key={t.id} value={t.id}>{t.nombre} {t.apellido}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Fecha *</label>
          <input
            type="date"
            required
            max={hoy}
            value={form.fecha}
            onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Hora entrada *</label>
            <input
              type="time"
              required
              value={form.hora_entrada}
              onChange={e => setForm(f => ({ ...f, hora_entrada: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Hora salida</label>
            <input
              type="time"
              value={form.hora_salida}
              onChange={e => setForm(f => ({ ...f, hora_salida: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Novedad</label>
          <input
            type="text"
            value={form.novedad}
            onChange={e => setForm(f => ({ ...f, novedad: e.target.value }))}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 border border-border hover:bg-muted text-sm font-medium py-2 rounded-lg transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={crear.isPending} className="flex-1 bg-success hover:bg-success-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">
            {crear.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DescuentoModal({
  periodoId, trabajadorId, trabajadorNombre, descuentos, onClose,
}: {
  periodoId: number;
  trabajadorId: number;
  trabajadorNombre: string;
  descuentos: DescuentoNomina[];
  onClose: () => void;
}) {
  const crear = useCrearDescuento();
  const eliminar = useEliminarDescuento();
  const { confirmState, confirm, close: closeConfirm } = useConfirm();
  const [showForm, setShowForm] = useState(descuentos.length === 0);
  const [form, setForm] = useState({ tipo: 'prestamo' as TipoDescuento, motivo: '', monto: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await crear.mutateAsync({
      trabajador_id: trabajadorId,
      periodo_id: periodoId,
      tipo: form.tipo,
      motivo: form.motivo,
      monto: Number(form.monto),
    });
    setForm({ tipo: 'prestamo', motivo: '', monto: '' });
    setShowForm(false);
  };

  return (
    <Modal onClose={onClose} scrollable>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-foreground">Descuentos</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">{trabajadorNombre}</p>

      {descuentos.length > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          {descuentos.map(d => (
            <div key={d.id} className="border border-border rounded-xl p-3 flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${ESTADO_DESCUENTO_BADGE[d.estado]}`}>
                    {d.estado === 'pendiente' ? 'Por aceptar' : d.estado === 'aceptado' ? 'Aceptado' : 'Rechazado'}
                  </span>
                  <span className="text-xs font-medium text-foreground">{TIPO_DESCUENTO_LABELS[d.tipo]}</span>
                </div>
                <p className="text-xs text-muted-foreground">{d.motivo}</p>
                <p className="text-sm font-semibold text-danger mt-1">-{fmtCOP(d.monto)}</p>
              </div>
              <button
                onClick={() => confirm({
                  title: 'Eliminar descuento',
                  detail: `¿Eliminar el descuento de "${d.motivo}" por ${fmtCOP(d.monto)}? Esta acción no se puede deshacer.`,
                  confirmLabel: 'Eliminar',
                  onConfirm: () => { eliminar.mutate(d.id); closeConfirm(); },
                })}
                className="text-muted-foreground/60 hover:text-danger transition-colors flex-shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 border-t border-border pt-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Tipo</label>
            <select
              value={form.tipo}
              onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoDescuento }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
            >
              {Object.entries(TIPO_DESCUENTO_LABELS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Motivo *</label>
            <input
              required
              type="text"
              placeholder="Ej. Préstamo del 12 de marzo"
              value={form.motivo}
              onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Monto (COP) *</label>
            <input
              required
              type="number"
              min="1"
              step="any"
              value={form.monto}
              onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Queda pendiente hasta que el trabajador lo acepte desde su app — no se descuenta de su neto todavía.
          </p>
          <div className="flex gap-2 pt-1">
            {descuentos.length > 0 && (
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-border hover:bg-muted text-sm font-medium py-2 rounded-lg transition-colors">
                Cancelar
              </button>
            )}
            <button type="submit" disabled={crear.isPending} className="flex-1 bg-success hover:bg-success-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">
              {crear.isPending ? 'Guardando...' : 'Registrar descuento'}
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-1.5 border border-dashed border-border hover:bg-muted text-sm font-medium text-muted-foreground py-2.5 rounded-lg transition-colors"
        >
          <Plus size={14} /> Agregar otro descuento
        </button>
      )}

      {confirmState && (
        <ConfirmModal
          title={confirmState.title}
          detail={confirmState.detail}
          confirmLabel={confirmState.confirmLabel ?? 'Confirmar'}
          onConfirm={confirmState.onConfirm}
          onCancel={closeConfirm}
        />
      )}
    </Modal>
  );
}
