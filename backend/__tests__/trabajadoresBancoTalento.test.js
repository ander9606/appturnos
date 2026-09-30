'use strict';

// Banco de talento: navegar/buscar trabajadores libres (empresa_id IS NULL)
// sin conocer su cédula de antemano — extiende el mismo criterio de
// elegibilidad que buscarPorCedula. Verifica paginación y el cast de
// ranking DECIMAL → number (mismo bug de rankingNumberCast.test.js).
jest.mock('../config/database', () => ({
  pool: { query: jest.fn() },
}));
jest.mock('../modules/trabajadores/trabajadores.model');

const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const TrabajadoresService = require('../modules/trabajadores/trabajadores.service');

describe('TrabajadoresService.listarBancoTalento', () => {
  beforeEach(() => {
    TrabajadoresModel.listarExperienciasPorTrabajadores.mockResolvedValue(new Map());
  });

  test('pagina y castea ranking DECIMAL a number', async () => {
    TrabajadoresModel.listarBancoTalento.mockResolvedValue({
      data: [{ id: 1, nombre: 'Ana', ranking: '4.50' }, { id: 2, nombre: 'Luis', ranking: null }],
      total: 2,
    });

    const resultado = await TrabajadoresService.listarBancoTalento({ q: 'an', page: 1, limit: 20 });

    expect(TrabajadoresModel.listarBancoTalento).toHaveBeenCalledWith({ q: 'an', limit: 20, offset: 0 });
    expect(resultado.data[0].ranking).toBe(4.5);
    expect(typeof resultado.data[0].ranking).toBe('number');
    expect(resultado.data[1].ranking).toBeNull();
    expect(resultado.pagination).toEqual({ page: 1, limit: 20, total: 2 });
  });

  test('calcula el offset de la página 3', async () => {
    TrabajadoresModel.listarBancoTalento.mockResolvedValue({ data: [], total: 0 });

    await TrabajadoresService.listarBancoTalento({ page: 3, limit: 20 });

    expect(TrabajadoresModel.listarBancoTalento).toHaveBeenCalledWith({ q: undefined, limit: 20, offset: 40 });
  });

  test('adjunta el historial de experiencias de cada trabajador', async () => {
    TrabajadoresModel.listarBancoTalento.mockResolvedValue({
      data: [{ id: 1, nombre: 'Ana', ranking: null }],
      total: 1,
    });
    const experiencias = [{ id: 5, cargo: 'Mesero', empresa_nombre: 'Bar X' }];
    TrabajadoresModel.listarExperienciasPorTrabajadores.mockResolvedValue(new Map([[1, experiencias]]));

    const resultado = await TrabajadoresService.listarBancoTalento({ page: 1, limit: 20 });

    expect(TrabajadoresModel.listarExperienciasPorTrabajadores).toHaveBeenCalledWith([1]);
    expect(resultado.data[0].experiencias).toBe(experiencias);
  });
});
