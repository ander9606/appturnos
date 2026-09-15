'use strict';

// puntos_marcaje.latitud/longitud son DECIMAL — mysql2 los devuelve como string sin
// decimalNumbers. El cliente mobile (LugarInput "biblioteca de ubicaciones") llama
// latitud.toFixed(5) directo, y truena con "TypeError: undefined is not a function"
// (visto en Sentry) porque los strings no tienen .toFixed. El modelo debe castear
// a Number antes de responder, mismo criterio que turnos-eventual.model.js.
jest.mock('../config/database', () => ({
  pool: { query: jest.fn() },
}));

const { pool } = require('../config/database');
const PuntosMarcajeModel = require('../modules/puntos-marcaje/puntos-marcaje.model');

afterEach(() => jest.clearAllMocks());

const filaComoMysql2 = { id: 1, nombre: 'Bodega Norte', latitud: '4.71100000', longitud: '-74.07210000', radio_metros: 100 };

describe('PuntosMarcajeModel — cast de latitud/longitud', () => {
  test('listarParaTurnos castea a Number', async () => {
    pool.query.mockResolvedValue([[filaComoMysql2]]);
    const [punto] = await PuntosMarcajeModel.listarParaTurnos(7);
    expect(punto.latitud).toBe(4.711);
    expect(punto.longitud).toBe(-74.0721);
  });

  test('listar castea a Number', async () => {
    pool.query.mockResolvedValue([[filaComoMysql2]]);
    const [punto] = await PuntosMarcajeModel.listar(7);
    expect(typeof punto.latitud).toBe('number');
    expect(typeof punto.longitud).toBe('number');
  });

  test('listarZonales castea a Number', async () => {
    pool.query.mockResolvedValue([[filaComoMysql2]]);
    const [punto] = await PuntosMarcajeModel.listarZonales(7);
    expect(typeof punto.latitud).toBe('number');
  });

  test('obtenerPorId castea a Number (o null si no existe)', async () => {
    pool.query.mockResolvedValue([[filaComoMysql2]]);
    const punto = await PuntosMarcajeModel.obtenerPorId(7, 1);
    expect(punto.latitud).toBe(4.711);

    pool.query.mockResolvedValue([[]]);
    expect(await PuntosMarcajeModel.obtenerPorId(7, 999)).toBeNull();
  });
});
