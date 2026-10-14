'use strict';

jest.mock('../config/database', () => ({
  pool: { query: jest.fn().mockResolvedValue([{ affectedRows: 1 }]) },
}));

const { pool } = require('../config/database');
const RegistrosModel = require('../modules/nomina/registros/registros.model');

const base = {
  hora_entrada: '14:00:00', hora_salida: '18:00:00',
  horas_ordinarias: 4, horas_extra_diurnas: 0, horas_extra_nocturnas: 0, horas_nocturnas: 0, horas_festivo: 0,
  es_festivo: 0, novedad: null, tipo_dia: 'ordinario', aprobado_por: 10, jornada_continua: false, horas_acumuladas_semana: 0,
};

describe('RegistrosModel.actualizar', () => {
  test('corrección normal: no toca sesiones_detalle ni hora_entrada_inicial', async () => {
    await RegistrosModel.actualizar(1, 9, base);

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).not.toContain('sesiones_detalle');
    expect(sql).not.toContain('hora_entrada_inicial');
    expect(params.slice(-2)).toEqual([9, 1]); // id, empresa_id
  });

  test('con sesiones_detalle: las reescribe en el MISMO UPDATE, como JSON, y con la primera entrada', async () => {
    const sesiones = [{ hora_entrada: '08:00:00', hora_salida: '12:00:00' }];
    await RegistrosModel.actualizar(1, 9, { ...base, sesiones_detalle: sesiones, hora_entrada_inicial: '08:00:00' });

    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('sesiones_detalle = ?, hora_entrada_inicial = ?');
    // Los placeholders y los parámetros tienen que coincidir uno a uno (y id/empresa van al final).
    expect(sql.match(/\?/g)).toHaveLength(params.length);
    expect(params.slice(-4)).toEqual([JSON.stringify(sesiones), '08:00:00', 9, 1]);
  });
});
