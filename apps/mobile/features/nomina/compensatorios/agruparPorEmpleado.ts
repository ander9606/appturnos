import type { DescansoCompensatorio } from '@api-client';

export interface GrupoEmpleado {
  trabajadorId: number;
  nombre: string;
  /** El más antiguo primero: es el que se descuenta primero al marcar un día a mano. */
  filas: DescansoCompensatorio[];
  pendientes: number;
}

/** Un grupo por empleado: primero quienes tienen pendientes (más pendientes arriba), luego por nombre. */
export function agruparPorEmpleado(lista: DescansoCompensatorio[]): GrupoEmpleado[] {
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
