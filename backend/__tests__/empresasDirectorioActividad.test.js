'use strict';

// Directorio de empresas — actividad reciente visible para trabajador_turnos
// antes de solicitar vínculo: turnos/semana, pago promedio y cargos que más
// solicita. Se calcula sobre una ventana fija de 12 semanas (created_at de
// ofertas_turno) para no diluir el promedio con historial viejo.
jest.mock('../config/database', () => ({
  pool: { query: jest.fn() },
}));

const { pool } = require('../config/database');
const EmpresasModel = require('../modules/empresas/empresas.model');

describe('EmpresasModel.listarDirectorio — actividad reciente', () => {
  test('calcula turnos/semana, pago promedio y castea DECIMAL a number', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 1, nombre: 'Acme' }]]) // SELECT empresas
      .mockResolvedValueOnce([[{ total: 1 }]]) // COUNT
      .mockResolvedValueOnce([[]]) // cargos (catálogo)
      .mockResolvedValueOnce([[{ empresa_id: 1, total_turnos: 24, pago_promedio: '85000.50' }]]) // actividad
      .mockResolvedValueOnce([[
        { empresa_id: 1, id: 10, nombre: 'Mesero', veces: 15 },
        { empresa_id: 1, id: 11, nombre: 'Cajero', veces: 9 },
      ]]); // cargos frecuentes

    const { data } = await EmpresasModel.listarDirectorio({ limit: 20, offset: 0 });

    // 24 turnos en 12 semanas = 2/semana
    expect(data[0].turnos_promedio_semana).toBe(2);
    expect(data[0].pago_promedio).toBe(85000.5);
    expect(typeof data[0].pago_promedio).toBe('number');
    expect(data[0].cargos_frecuentes).toEqual([
      { id: 10, nombre: 'Mesero', veces: 15 },
      { id: 11, nombre: 'Cajero', veces: 9 },
    ]);
  });

  test('empresa sin ofertas recientes devuelve stats en null, no cero', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 2, nombre: 'Nueva SAS' }]])
      .mockResolvedValueOnce([[{ total: 1 }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]]) // sin actividad
      .mockResolvedValueOnce([[]]);

    const { data } = await EmpresasModel.listarDirectorio({ limit: 20, offset: 0 });

    expect(data[0].turnos_promedio_semana).toBeNull();
    expect(data[0].pago_promedio).toBeNull();
    expect(data[0].cargos_frecuentes).toEqual([]);
  });
});
