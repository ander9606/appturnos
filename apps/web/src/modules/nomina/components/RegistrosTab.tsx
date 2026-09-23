import { useState } from 'react';
import { Plus, Pencil, CalendarClock, MapPin, ChevronDown, X, AlertTriangle } from 'lucide-react';
import { useDescartarSospechoso } from '../hooks/useNomina';
import type { Registro, DescansoCompensatorio } from '../types';
import { ErrorState } from '@/shared/components/ErrorState';
import { fmtDiaSemana, fmtHora, fmtHrs } from '@/shared/lib/format';
import { TIPO_DIA_LABELS } from '../constants';
import { AlmuerzoIndicator, ExtraIndicator } from './DiaIndicators';
import { UbicacionMarcajeModal } from './UbicacionMarcajeModal';

export function RegistrosTab({
  registros, loading, error, onRetry, compensatorioDe, onCorregir, onReasignar, onShowCrear,
}: {
  registros: Registro[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  compensatorioDe: (r: Registro) => DescansoCompensatorio | undefined;
  onCorregir: (id: number) => void;
  onReasignar: (c: DescansoCompensatorio) => void;
  onShowCrear: () => void;
}) {
  const [filtroTrabajador, setFiltroTrabajador] = useState<number | undefined>(undefined);
  const [soloSospechosos, setSoloSospechosos] = useState(false);
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());
  const [verUbicacion, setVerUbicacion] = useState<Registro | null>(null);
  const descartarSospechoso = useDescartarSospechoso();

  function toggleExpandido(trabajadorId: number) {
    setExpandidos(prev => {
      const next = new Set(prev);
      next.has(trabajadorId) ? next.delete(trabajadorId) : next.add(trabajadorId);
      return next;
    });
  }

  const registrosFiltrados = registros
    .filter(r => !filtroTrabajador || r.trabajador_id === filtroTrabajador)
    .filter(r => !soloSospechosos || r.sospechoso === 1);

  const totalSospechosos = registros.filter(r => r.sospechoso === 1).length;

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

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2">
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
          {(totalSospechosos > 0 || soloSospechosos) && (
            <button
              onClick={() => setSoloSospechosos(v => !v)}
              className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                soloSospechosos
                  ? 'bg-warning-light text-warning border-warning/40'
                  : 'border-border text-muted-foreground hover:text-warning hover:border-warning/40'
              }`}
            >
              <AlertTriangle size={14} /> Sospechosos ({totalSospechosos})
            </button>
          )}
        </div>
        <button
          onClick={onShowCrear}
          className="flex items-center gap-1.5 bg-success hover:bg-success-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus size={14} /> Agregar registro
        </button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm py-8 text-center">Cargando...</p>
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : gruposPorTrabajador.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">Sin registros</p>
      ) : (
        <div className="flex flex-col gap-2">
          {gruposPorTrabajador.map(g => {
            const abierto = expandidos.has(g.trabajadorId) || gruposPorTrabajador.length === 1;
            const totalOrd = g.registros.reduce((s, r) => s + Number(r.horas_ordinarias), 0);
            const totalExtra = g.registros.reduce((s, r) => s + Number(r.horas_extra_diurnas) + Number(r.horas_extra_nocturnas), 0);
            const totalNoct = g.registros.reduce((s, r) => s + Number(r.horas_nocturnas), 0);
            const totalFestivo = g.registros.reduce((s, r) => s + Number(r.horas_festivo), 0);
            return (
              <div key={g.trabajadorId} className="bg-card border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleExpandido(g.trabajadorId)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted transition-colors"
                >
                  <span className="font-medium text-foreground">{g.nombre} {g.apellido}</span>
                  <span className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{g.registros.length} día{g.registros.length !== 1 ? 's' : ''}</span>
                    <span>
                      {fmtHrs(totalOrd)} hrs ord · {fmtHrs(totalExtra)} hrs extra
                      {totalNoct > 0 && ` · ${fmtHrs(totalNoct)} hrs noct.`}
                      {totalFestivo > 0 && ` · ${fmtHrs(totalFestivo)} hrs festivo`}
                    </span>
                    <ChevronDown size={16} className={`transition-transform ${abierto ? 'rotate-180' : ''}`} />
                  </span>
                </button>
                {abierto && (
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm border-t border-border">
                    <thead>
                      <tr className="bg-muted text-muted-foreground text-xs uppercase">
                        <th className="text-left px-3 py-2.5 font-medium">Fecha</th>
                        <th className="text-left px-3 py-2.5 font-medium">Entrada</th>
                        <th className="text-left px-3 py-2.5 font-medium">Salida</th>
                        <th className="text-right px-3 py-2.5 font-medium">Hrs Ord</th>
                        <th className="text-right px-3 py-2.5 font-medium">Hrs Noct</th>
                        <th className="text-right px-3 py-2.5 font-medium">Hrs Extra</th>
                        <th className="text-right px-3 py-2.5 font-medium">Hrs Festivo</th>
                        <th className="text-left px-3 py-2.5 font-medium">Tipo día</th>
                        <th className="text-left px-3 py-2.5 font-medium">Novedad</th>
                        <th className="px-3 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {g.registros.map(r => (
                        <tr key={r.id} className="border-t border-border/60 hover:bg-muted">
                          <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{fmtDiaSemana(r.fecha)}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              {fmtHora(r.hora_entrada_inicial ?? r.hora_entrada)}
                              {r.sospechoso === 1 && (
                                <AlertTriangle size={13} className="text-warning shrink-0">
                                  <title>Marcaje sospechoso: mismo dispositivo y ubicación que otro trabajador</title>
                                </AlertTriangle>
                              )}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              {fmtHora(r.hora_salida)}
                              <AlmuerzoIndicator r={r} />
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right text-muted-foreground">{fmtHrs(r.horas_ordinarias)}</td>
                          <td className="px-3 py-2.5 text-right text-info">
                            {Number(r.horas_nocturnas) > 0 ? fmtHrs(r.horas_nocturnas) : ''}
                          </td>
                          <td className="px-3 py-2.5 text-right text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              {fmtHrs(Number(r.horas_extra_diurnas) + Number(r.horas_extra_nocturnas))}
                              <ExtraIndicator r={r} />
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right text-danger">
                            {Number(r.horas_festivo) > 0 ? fmtHrs(r.horas_festivo) : ''}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">{TIPO_DIA_LABELS[r.tipo_dia]}</td>
                          <td className="px-3 py-2.5 text-muted-foreground max-w-32 truncate">{r.novedad ?? ''}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => onCorregir(r.id)}
                                className="text-muted-foreground/60 hover:text-success transition-colors"
                              >
                                <Pencil size={14} />
                              </button>
                              {compensatorioDe(r) && (
                                <button
                                  onClick={() => onReasignar(compensatorioDe(r)!)}
                                  className="text-muted-foreground/60 hover:text-info transition-colors"
                                  title="Reasignar descanso compensatorio"
                                >
                                  <CalendarClock size={14} />
                                </button>
                              )}
                              {(r.latitud_entrada != null || r.latitud_salida != null) && (
                                <button
                                  onClick={() => setVerUbicacion(r)}
                                  className="text-muted-foreground/60 hover:text-info transition-colors"
                                  title="Ver ubicación de marcaje"
                                >
                                  <MapPin size={14} />
                                </button>
                              )}
                              {r.sospechoso === 1 && (
                                <button
                                  onClick={() => descartarSospechoso.mutate(r.id)}
                                  disabled={descartarSospechoso.isPending}
                                  className="text-warning/70 hover:text-warning transition-colors disabled:opacity-50"
                                  title="Descartar: ya lo revisé, no es fraude"
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {verUbicacion && (
        <UbicacionMarcajeModal registro={verUbicacion} onClose={() => setVerUbicacion(null)} />
      )}
    </div>
  );
}
