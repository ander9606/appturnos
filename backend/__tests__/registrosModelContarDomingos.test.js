'use strict';

jest.mock('../config/database', () => ({
  pool: { query: jest.fn() },
}));

const { pool } = require('../config/database');
const RegistrosModel = require('../modules/nomina/registros/registros.model');

describe('RegistrosModel.contarDomingosTrabajadosEnMes', () => {
  test('cuenta solo domingos ANTERIORES a la fecha, no los posteriores del mismo mes', async () => {
    pool.query.mockResolvedValue([[{ total: 2 }]]);

    const total = await RegistrosModel.contarDomingosTrabajadosEnMes(1, 5, '2031-03-16');

    expect(total).toBe(2);
    const [sql, params] = pool.query.mock.calls[0];
    // Bug real en producción: "fecha != ?" también contaba los domingos
    // POSTERIORES del mes que ya tuvieran salida registrada (p. ej. al
    // reprocesar un mes completo), inflando numeroDomingo y marcando el
    // 1er/2º domingo como habitual solo porque el 3º/4º ya estaban cerrados.
    expect(sql).not.toMatch(/fecha\s*!=\s*\?/);
    expect(sql).toMatch(/fecha\s*<\s*\?/);
    expect(params).toEqual([1, 5, '2031-03-16', '2031-03-16']);
  });
});
