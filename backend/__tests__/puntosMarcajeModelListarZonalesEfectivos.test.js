'use strict';

// listarZonalesEfectivos decide si un turno acotó sus puntos zonales
// (oferta_puntos_marcaje, migración 099) o si debe caer al comportamiento de
// siempre (cualquier punto zonal de la empresa) — ver asignaciones.marcaje.service.js.
jest.mock('../config/database', () => ({
  pool: { query: jest.fn() },
}));

const { pool } = require('../config/database');
const PuntosMarcajeModel = require('../modules/puntos-marcaje/puntos-marcaje.model');

afterEach(() => jest.clearAllMocks());

const PUNTO = { id: 5, nombre: 'Bodega Norte', latitud: '4.71100000', longitud: '-74.07210000', radio_metros: 100 };

describe('PuntosMarcajeModel.listarZonalesEfectivos', () => {
  test('con ofertaId y puntos acotados: devuelve solo esos, una sola query', async () => {
    pool.query.mockResolvedValueOnce([[PUNTO]]);
    const puntos = await PuntosMarcajeModel.listarZonalesEfectivos(7, 42);
    expect(puntos).toHaveLength(1);
    expect(puntos[0].id).toBe(5);
    expect(typeof puntos[0].latitud).toBe('number');
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test('con ofertaId sin puntos acotados: cae a listarZonales (todos los de la empresa)', async () => {
    pool.query
      .mockResolvedValueOnce([[]])       // sin filas en oferta_puntos_marcaje
      .mockResolvedValueOnce([[PUNTO]]); // fallback: listarZonales(empresaId)
    const puntos = await PuntosMarcajeModel.listarZonalesEfectivos(7, 42);
    expect(puntos).toHaveLength(1);
    expect(pool.query).toHaveBeenCalledTimes(2);
  });

  test('sin ofertaId: va directo a listarZonales', async () => {
    pool.query.mockResolvedValueOnce([[PUNTO]]);
    const puntos = await PuntosMarcajeModel.listarZonalesEfectivos(7, undefined);
    expect(puntos).toHaveLength(1);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });
});
