import { createStaleGuard } from '../staleGuard';

describe('createStaleGuard', () => {
  it('considera vigente la operación recién iniciada', () => {
    const guard = createStaleGuard();
    const token = guard.start();
    expect(guard.isCurrent(token)).toBe(true);
  });

  it('invalida la operación anterior cuando empieza una más nueva', () => {
    const guard = createStaleGuard();
    const first = guard.start();
    const second = guard.start();
    expect(guard.isCurrent(first)).toBe(false);
    expect(guard.isCurrent(second)).toBe(true);
  });

  it('invalida la operación en vuelo aunque no arranque una nueva (texto borrado)', () => {
    // Caso real: búsqueda larga lenta en vuelo, el usuario borra el texto
    // antes de que resuelva — su respuesta tardía no debe aplicarse.
    const guard = createStaleGuard();
    const slow = guard.start();
    guard.invalidate();
    expect(guard.isCurrent(slow)).toBe(false);
  });
});
