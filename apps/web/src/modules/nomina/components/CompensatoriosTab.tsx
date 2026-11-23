import { SkeletonList } from '@/shared/components/Skeleton';
import { useState } from 'react';
import { useCompensatorios } from '../hooks/useNomina';
import type { DescansoCompensatorio } from '../types';
import { ErrorState } from '@/shared/components/ErrorState';
import { AsignarCompensatorioModal, ReasignarCompensatorioModal } from './CompensatorioAsignarModals';
import { EmptyState } from '@/shared/components/EmptyState';
import { puedeGestionarNomina } from '../permisos';
import { fmtDiaSemana, bogotaToday } from '@/shared/lib/format';
import { CLASIFICACION_BADGE, CLASIFICACION_LABEL } from '../constants';

type Filtro = 'pendiente' | 'todos';

interface GrupoEmpleado {
  trabajadorId: number;
  nombre: string;
  filas: DescansoCompensatorio[]; // el más antiguo primero: es el que se descuenta primero
  pendientes: number;
}

/** Un grupo por empleado: primero quienes tienen pendientes (más pendientes arriba), luego por nombre. */
function agruparPorEmpleado(lista: DescansoCompensatorio[]): GrupoEmpleado[] {
  const grupos = new Map<number, GrupoEmpleado>();
  for (const c of lista) {
    let g = grupos.get(c.trabajador_id);
    if (!g) {
      g = { trabajadorId: c.trabajador_id, nombre: `${c.trabajador_nombre} ${c.trabajador_apellido}`, filas: [], pendientes: 0 };
      grupos.set(c.trabajador_id, g);
    }
    g.filas.push(c);
    if (c.estado === 'pendiente') g.pendientes++;
  }
  for (const g of grupos.values()) g.filas.sort((a, b) => a.origen_fecha.localeCompare(b.origen_fecha) || a.id - b.id);
  return [...grupos.values()].sort((a, b) => b.pendientes - a.pendientes || a.nombre.localeCompare(b.nombre));
}

export function CompensatoriosTab() {
  const { data, isLoading, isError, error, refetch } = useCompensatorios();
  const [filtro, setFiltro] = useState<Filtro>('pendiente');
  const [asignando, setAsignando] = useState<DescansoCompensatorio | null>(null);
  const [reasignando, setReasignando] = useState<DescansoCompensatorio | null>(null);

  if (isLoading) return <SkeletonList count={3} />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  const todos: DescansoCompensatorio[] = data?.data ?? [];
  const totalPendientes = todos.filter(c => c.estado === 'pendiente').length;
  const hoy = bogotaToday();
  const grupos = agruparPorEmpleado(filtro === 'pendiente' ? todos.filter(c => c.estado === 'pendiente') : todos);
  const puedeGestionar = puedeGestionarNomina();

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
              onClick={() => setFiltro(valor)}
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
        <div className="flex flex-col gap-4">
          {grupos.map(g => (
            <section key={g.trabajadorId} className="bg-card border border-border rounded-xl overflow-hidden">
              <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
                <h3 className="font-medium text-foreground">{g.nombre}</h3>
                <div className="flex items-center gap-2 text-xs">
                  {g.pendientes > 0 && (
                    <span className="px-2 py-0.5 rounded-full font-medium bg-warning-light text-warning">
                      {g.pendientes} {g.pendientes === 1 ? 'pendiente' : 'pendientes'}
                    </span>
                  )}
                  <span className="text-muted-foreground">{g.filas.length} {g.filas.length === 1 ? 'descanso' : 'descansos'}</span>
                </div>
              </header>
              <div className="overflow-x-auto">
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
                    {g.filas.map(c => {
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
                              pendiente ? 'bg-warning-light text-warning' : vencido ? 'bg-muted text-muted-foreground' : 'bg-success-light text-success'
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
                                className="bg-success hover:bg-success-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
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
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
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
