'use strict';

jest.mock('../config/database', () => ({
  pool: { query: jest.fn() },
}));

const { pool } = require('../config/database');
const RegistrosModel = require('../modules/nomina/registros/registros.model');

describe('RegistrosModel.contarFestivosTrabajadosEnMes', () => {
  test('cuenta solo días (domingo o festivo) ANTERIORES a la fecha, no los posteriores del mismo mes', async () => {
    pool.query.mockResolvedValue([[{ total: 2 }]]);

    const total = await RegistrosModel.contarFestivosTrabajadosEnMes(1, 5, '2031-03-16');

    expect(total).toBe(2);
    const [sql, params] = pool.query.mock.calls[0];
    // Bug real en producción: "fecha != ?" también contaba los días
    // POSTERIORES del mes que ya tuvieran salida registrada (p. ej. al
    // reprocesar un mes completo), inflando el conteo y marcando el 1er/2º
    // día como habitual solo porque el 3º/4º ya estaban cerrados.
    expect(sql).not.toMatch(/fecha\s*!=\s*\?/);
    expect(sql).toMatch(/fecha\s*<\s*\?/);
    // Domingo Y festivo de calendario cuentan juntos (decisión de producto) —
    // por `es_festivo` (ya marca ambos por fila), no por DAYOFWEEK (solo domingo).
    expect(sql).not.toMatch(/DAYOFWEEK/);
    expect(sql).toMatch(/es_festivo\s*=\s*1/);
    expect(params).toEqual([1, 5, '2031-03-16', '2031-03-16']);
  });
});
