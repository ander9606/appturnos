import { agruparPorEmpleado } from '../agruparPorEmpleado';

const c = (id: number, trabajador_id: number, nombre: string, origen_fecha: string, estado: string) =>
  ({ id, trabajador_id, trabajador_nombre: nombre, trabajador_apellido: 'X', origen_fecha, estado }) as never;

describe('agruparPorEmpleado', () => {
  const lista = [
    c(1, 2, 'Carlos', '2026-11-08', 'asignado'),
    c(2, 1, 'Laura', '2026-11-15', 'pendiente'),
    c(3, 1, 'Laura', '2026-10-18', 'tomado'),
    c(4, 1, 'Laura', '2026-11-01', 'pendiente'),
    c(5, 3, 'Ana', '2026-11-15', 'pendiente'),
  ];

  it('una tabla por empleado, con quien tiene más pendientes arriba y luego por nombre', () => {
    const g = agruparPorEmpleado(lista);
    expect(g.map((x) => [x.nombre, x.pendientes])).toEqual([['Laura X', 2], ['Ana X', 1], ['Carlos X', 0]]);
  });

  it('dentro de cada empleado, el compensatorio más antiguo primero', () => {
    const laura = agruparPorEmpleado(lista)[0];
    expect(laura.filas.map((f) => f.id)).toEqual([3, 4, 2]);
  });

  it('venceMin: cuándo vence el pendiente más antiguo (28 días tras el festivo); null sin pendientes', () => {
    const g = agruparPorEmpleado(lista);
    expect(g.map((x) => [x.nombre, x.venceMin])).toEqual([['Laura X', '2026-11-29'], ['Ana X', '2026-12-13'], ['Carlos X', null]]);
  });

  it('lista vacía → sin grupos', () => {
    expect(agruparPorEmpleado([])).toEqual([]);
  });
});
