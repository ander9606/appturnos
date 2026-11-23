import { compensatoriosDisponibles, vencimientoCompensatorio } from '../disponibles';

const c = (id: number, trabajador_id: number, origen_fecha: string, estado = 'pendiente') =>
  ({ id, trabajador_id, origen_fecha, estado, clasificacion: 'habitual' }) as never;

describe('compensatoriosDisponibles', () => {
  it('vence 28 días después del día trabajado', () => {
    expect(vencimientoCompensatorio('2026-11-01')).toBe('2026-11-29');
    expect(vencimientoCompensatorio('2026-02-01')).toBe('2026-03-01');
  });

  it('solo los pendientes del trabajador cuya ventana incluye el día, el más antiguo primero', () => {
    const lista = [
      c(1, 7, '2026-11-15'),               // sirve
      c(2, 7, '2026-11-01'),               // sirve (vence 29 nov) y es el más antiguo
      c(3, 7, '2026-10-04'),               // vencido: vence 1 nov
      c(4, 7, '2026-11-20'),               // sirve
      c(5, 9, '2026-11-08'),               // otro trabajador
      c(6, 7, '2026-11-08', 'tomado'),     // ya no está pendiente
      c(7, 7, '2026-11-25'),               // aún no se trabajó ese día: el descanso es posterior
    ];
    expect(compensatoriosDisponibles(lista, 7, '2026-11-24').map((x) => x.id)).toEqual([2, 1, 4]);
  });

  it('el mismo día trabajado no cuenta (el descanso es después), y el último día de la ventana sí', () => {
    const lista = [c(1, 7, '2026-11-01')];
    expect(compensatoriosDisponibles(lista, 7, '2026-11-01')).toEqual([]);
    expect(compensatoriosDisponibles(lista, 7, '2026-11-29').map((x) => x.id)).toEqual([1]);
    expect(compensatoriosDisponibles(lista, 7, '2026-11-30')).toEqual([]);
  });
});
