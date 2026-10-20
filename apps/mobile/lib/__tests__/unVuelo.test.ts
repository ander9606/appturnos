import { crearUnVuelo } from '../useSingleFlight';

describe('crearUnVuelo', () => {
  test('ignora el segundo toque mientras la promesa sigue pendiente', async () => {
    const estados: boolean[] = [];
    const run = crearUnVuelo((b) => estados.push(b));
    let resolver!: () => void;
    const fn = jest.fn(() => new Promise<void>((r) => { resolver = r; }));
    run(fn); run(fn);
    expect(fn).toHaveBeenCalledTimes(1);
    resolver();
    await Promise.resolve(); await Promise.resolve();
    expect(estados).toEqual([true, false]);
  });

  test('si la acción falla, vuelve a ser marcable', async () => {
    const run = crearUnVuelo(() => {});
    const fn = jest.fn(() => Promise.reject(new Error('sin red')));
    run(fn);
    await new Promise((r) => setTimeout(r, 0));
    run(fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  test('una acción síncrona no bloquea', () => {
    const run = crearUnVuelo(() => {});
    const fn = jest.fn();
    run(fn); run(fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
