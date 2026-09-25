'use strict';

// Cédula única por empresa (migración 069): el modelo choca contra el UNIQUE
// de MySQL y el servicio debe traducir ese ER_DUP_ENTRY a un 409 legible,
// en vez de dejar pasar el error crudo de MySQL.
jest.mock('../config/database', () => ({
  pool: { query: jest.fn() },
}));
jest.mock('../modules/trabajadores/trabajadores.model');

const { pool } = require('../config/database');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const TrabajadoresService = require('../modules/trabajadores/trabajadores.service');

function erDupEntry() {
  const err = new Error("Duplicate entry '1-123' for key 'uk_empresa_cedula'");
  err.code = 'ER_DUP_ENTRY';
  return err;
}

beforeEach(() => {
  pool.query.mockReset();
  // Plan sin límite conocido → TrabajadoresService.crear no hace la query de conteo.
  pool.query.mockResolvedValue([[{ plan: 'gratis' }]]);
});

describe('TrabajadoresService.crear — cédula duplicada', () => {
  test('ER_DUP_ENTRY del modelo → AppError 409 con mensaje claro', async () => {
    TrabajadoresModel.crear.mockRejectedValue(erDupEntry());

    await expect(
      TrabajadoresService.crear(1, { nombre: 'Ana', apellido: 'Pérez', cedula: '123' })
    ).rejects.toMatchObject({
      statusCode: 409,
      message: 'Ya existe un trabajador con esa cédula en tu empresa',
    });
  });

  test('creación exitosa no se ve afectada', async () => {
    TrabajadoresModel.crear.mockResolvedValue(10);
    TrabajadoresModel.obtenerPorId.mockResolvedValue({ id: 10, cedula: '123' });

    const result = await TrabajadoresService.crear(1, { nombre: 'Ana', apellido: 'Pérez', cedula: '123' });
    expect(result.id).toBe(10);
  });
});

describe('TrabajadoresService.actualizar — cédula duplicada', () => {
  test('ER_DUP_ENTRY del modelo → AppError 409', async () => {
    TrabajadoresModel.obtenerPorId.mockResolvedValue({ id: 5, empresa_id: 1 });
    TrabajadoresModel.actualizar.mockRejectedValue(erDupEntry());

    await expect(
      TrabajadoresService.actualizar(1, 5, { cedula: '999' })
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
