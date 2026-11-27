import { SkeletonList } from '@/shared/components/Skeleton';
import { useMemo, useState } from 'react';
import { Bed, ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { useCompensatorios } from '../hooks/useNomina';
import type { DescansoCompensatorio } from '../types';
import { ErrorState } from '@/shared/components/ErrorState';
import { AsignarCompensatorioModal, ReasignarCompensatorioModal } from './CompensatorioAsignarModals';
import { EmptyState } from '@/shared/components/EmptyState';
import { puedeGestionarNomina } from '../permisos';
import { fmtDiaSemana, bogotaToday } from '@/shared/lib/format';
import { CLASIFICACION_BADGE, CLASIFICACION_LABEL } from '../constants';
import { vencimientoCompensatorio, diasHasta, textoVencimiento, claseVencimiento } from '../utils';

type Filtro = 'pendiente' | 'todos';

interface GrupoEmpleado {
  trabajadorId: number;
  nombre: string;
  filas: DescansoCompensatorio[]; // el más antiguo primero: es el que se descuenta primero
  pendientes: number;
  /** Cuándo vence el pendiente más antiguo (el primero en vencer); null sin pendientes. */
  venceMin: string | null;
}

/** Un grupo por empleado: primero quienes tienen pendientes (más pendientes arriba), luego por nombre. */
function agruparPorEmpleado(lista: DescansoCompensatorio[]): GrupoEmpleado[] {
  const grupos = new Map<number, GrupoEmpleado>();
  for (const c of lista) {
    let g = grupos.get(c.trabajador_id);
    if (!g) {
      g = { trabajadorId: c.trabajador_id, nombre: `${c.trabajador_nombre} ${c.trabajador_apellido}`, filas: [], pendientes: 0, venceMin: null };
      grupos.set(c.trabajador_id, g);
    }
    g.filas.push(c);
    if (c.estado === 'pendiente') g.pendientes++;
  }
  for (const g of grupos.values()) {
    g.filas.sort((a, b) => a.origen_fecha.localeCompare(b.origen_fecha) || a.id - b.id);
    const primero = g.filas.find(c => c.estado === 'pendiente');
    g.venceMin = primero ? vencimientoCompensatorio(primero.origen_fecha) : null;
  }
  return [...grupos.values()].sort((a, b) => b.pendientes - a.pendientes || a.nombre.localeCompare(b.nombre));
}

export function CompensatoriosTab() {
  const { data, isLoading, isError, error, refetch } = useCompensatorios();
  const [filtro, setFiltro] = useState<Filtro>('pendiente');
  const [asignando, setAsignando] = useState<DescansoCompensatorio | null>(null);
  const [reasignando, setReasignando] = useState<DescansoCompensatorio | null>(null);
  // Empleados con el subgrupo «Asignados y tomados» desplegado (cuando conviven con pendientes).
  const [asignadosAbiertos, setAsignadosAbiertos] = useState<Set<number>>(new Set());
  // null = «por defecto»: abiertos los empleados con pendientes (hasta 3). En cuanto se toca algo pasa a explícito; cambiar de filtro lo reinicia.
  const [abiertosUsuario, setAbiertosUsuario] = useState<Set<number> | null>(null);
  const todosLista: DescansoCompensatorio[] = data?.data ?? [];
  const grupos = useMemo(
    () => agruparPorEmpleado(filtro === 'pendiente' ? todosLista.filter(c => c.estado === 'pendiente') : todosLista),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, filtro],
  );
  const abiertos = useMemo(
    () => abiertosUsuario ?? new Set(grupos.filter(g => g.pendientes > 0).slice(0, 3).map(g => g.trabajadorId)),
    [abiertosUsuario, grupos],
  );
  const alternar = (id: number) => {
    const nuevo = new Set(abiertos);
    if (!nuevo.delete(id)) nuevo.add(id);
    setAbiertosUsuario(nuevo);
  };
  const todosAbiertos = grupos.length > 0 && grupos.every(g => abiertos.has(g.trabajadorId));

  if (isLoading) return <SkeletonList count={3} />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  const todos = todosLista;
  const totalPendientes = todos.filter(c => c.estado === 'pendiente').length;
  const hoy = bogotaToday();
  const puedeGestionar = puedeGestionarNomina();
  const renderFila = (c: DescansoCompensatorio) => {
                      const pendiente = c.estado === 'pendiente';
                      const vencido = !pendiente && !!c.fecha_asignada && c.fecha_asignada < hoy; // el descanso ya pasó
                      return (
                        <tr key={c.id} className="border-t border-border/60 hover:bg-muted/50">
                          <td className="px-4 py-2.5 text-foreground whitespace-nowrap">{fmtDiaSemana(c.origen_fecha)}</td>
                          <td className="px-3 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${CLASIFICACION_BADGE[c.clasificacion]}`}>
                              {CLASIFICACION_LABEL[c.clasificacion]}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                              pendiente ? 'bg-warning-light text-warning-text' : vencido ? 'bg-muted text-muted-foreground' : 'bg-success-light text-success-text'
                            }`}>
                              {pendiente ? 'Pendiente' : vencido ? 'Tomado' : 'Asignado'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                            {c.fecha_asignada ? fmtDiaSemana(c.fecha_asignada) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">
                            {puedeGestionar && pendiente && (
                              <button
                                onClick={() => setAsignando(c)}
                                className="bg-success-600 hover:bg-success-text text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                              >
                                Asignar fecha
                              </button>
                            )}
                            {puedeGestionar && !pendiente && !vencido && (
                              <button
                                onClick={() => setReasignando(c)}
                                className="border border-border hover:bg-muted text-foreground text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                              >
                                Reasignar
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    };

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{totalPendientes}</span>{' '}
          {totalPendientes === 1 ? 'descanso pendiente de asignar' : 'descansos pendientes de asignar'}
          {' · '}{todos.length} en total
        </p>
        <div className="flex gap-1 bg-muted rounded-lg p-0.5">
          {([['pendiente', `Pendientes · ${totalPendientes}`], ['todos', `Todos · ${todos.length}`]] as const).map(([valor, etiqueta]) => (
            <button
              key={valor}
              onClick={() => { setFiltro(valor); setAbiertosUsuario(null); }}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                filtro === valor ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>
      </div>

      {grupos.length === 0 ? (
        <EmptyState title={filtro === 'pendiente' ? 'No hay compensatorios pendientes de asignar.' : 'Aún no hay descansos compensatorios.'} />
      ) : (
        <div className="flex flex-col gap-3">
          {grupos.length > 1 && (
            <button
              onClick={() => setAbiertosUsuario(todosAbiertos ? new Set() : new Set(grupos.map(g => g.trabajadorId)))}
              className="self-end text-xs font-medium text-success-600 hover:text-success-text px-2 py-1 rounded-lg hover:bg-success-light transition-colors"
            >
              {todosAbiertos ? 'Contraer todo' : 'Expandir todo'}
            </button>
          )}
          {grupos.map(g => {
            const abierto = abiertos.has(g.trabajadorId);
            const dias = g.venceMin ? diasHasta(g.venceMin, hoy) : null;
            return (
            <section key={g.trabajadorId} className="bg-card border border-border rounded-xl overflow-hidden">
              <h3>
                <button
                  onClick={() => alternar(g.trabajadorId)}
                  aria-expanded={abierto}
                  aria-controls={`comp-${g.trabajadorId}`}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                >
                  {abierto ? <ChevronDown size={16} className="text-muted-foreground shrink-0" /> : <ChevronRight size={16} className="text-muted-foreground shrink-0" />}
                  <span className="font-medium text-foreground">{g.nombre}</span>
                  <span className="ml-auto flex items-center gap-3 text-xs flex-wrap justify-end">
                    {g.pendientes > 0 && (
                      <span className="inline-flex items-center gap-1 font-semibold text-warning-text">
                        <Bed size={13} aria-hidden="true" />
                        {g.pendientes} {g.pendientes === 1 ? 'pendiente' : 'pendientes'}
                      </span>
                    )}
                    {dias !== null && (
                      <span className={`inline-flex items-center gap-1 font-medium ${claseVencimiento(dias)}`}>
                        <Clock size={13} aria-hidden="true" />
                        {textoVencimiento(dias)}
                      </span>
                    )}
                    <span className="text-muted-foreground">{g.filas.length} {g.filas.length === 1 ? 'descanso' : 'descansos'}</span>
                  </span>
                </button>
              </h3>
              {abierto && (
              <div id={`comp-${g.trabajadorId}`} className="overflow-x-auto border-t border-border">
                {/* Anchos fijos: las columnas quedan alineadas de un empleado al siguiente. */}
                <table className="w-full min-w-[640px] table-fixed text-sm">
                  <colgroup>
                    <col className="w-[24%]" /><col className="w-[20%]" /><col className="w-[14%]" /><col className="w-[24%]" /><col className="w-[18%]" />
                  </colgroup>
                  <thead>
                    <tr className="bg-muted text-muted-foreground text-xs uppercase">
                      <th className="text-left px-4 py-2 font-medium">Trabajó el</th>
                      <th className="text-left px-3 py-2 font-medium">Clasificación</th>
                      <th className="text-left px-3 py-2 font-medium">Estado</th>
                      <th className="text-left px-3 py-2 font-medium">Descanso el</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const pend = g.filas.filter(c => c.estado === 'pendiente');
                      const resto = g.filas.filter(c => c.estado !== 'pendiente');
                      const subgrupo = pend.length > 0 && resto.length > 0;
                      const mostrarResto = !subgrupo || asignadosAbiertos.has(g.trabajadorId);
                      const proximo = resto.map(c => c.fecha_asignada).filter((f): f is string => !!f && f >= hoy).sort()[0];
                      return (
                        <>
                          {pend.map(renderFila)}
                          {subgrupo && (
                            <tr className="border-t border-border/60 bg-muted/50">
                              <td colSpan={5} className="p-0">
                                <button
                                  onClick={() => setAsignadosAbiertos(prev => {
                                    const n = new Set(prev);
                                    if (!n.delete(g.trabajadorId)) n.add(g.trabajadorId);
                                    return n;
                                  })}
                                  aria-expanded={mostrarResto}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground text-left"
                                >
                                  {mostrarResto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                  Asignados y tomados · {resto.length}{proximo ? ` · próximo ${fmtDiaSemana(proximo)}` : ''}
                                </button>
                              </td>
                            </tr>
                          )}
                          {mostrarResto && resto.map(renderFila)}
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
              )}
            </section>
            );
          })}
        </div>
      )}

      {asignando && (
        <AsignarCompensatorioModal compensatorio={asignando} onClose={() => setAsignando(null)} />
      )}
      {reasignando && (
        <ReasignarCompensatorioModal compensatorio={reasignando} onClose={() => setReasignando(null)} />
      )}
    </>
  );
}
