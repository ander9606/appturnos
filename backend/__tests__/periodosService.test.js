'use strict';

// Mock DB and external dependencies before requiring the service.
jest.mock('../config/database', () => ({
  pool: { query: jest.fn().mockResolvedValue([[]]) },
}));
jest.mock('../modules/nomina/periodos/periodos.model');
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const PeriodosModel  = require('../modules/nomina/periodos/periodos.model');
const PeriodosService = require('../modules/nomina/periodos/periodos.service');
const AppError        = require('../utils/AppError');

// ── crear ─────────────────────────────────────────────────────────────────────

describe('PeriodosService.crear', () => {
  test('fecha_fin anterior a fecha_inicio → AppError 422', async () => {
    await expect(
      PeriodosService.crear(1, { fecha_inicio: '2026-06-15', fecha_fin: '2026-06-01' })
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  test('fecha_inicio === fecha_fin → se crea sin error', async () => {
    PeriodosModel.crear.mockResolvedValue(99);
    PeriodosModel.obtenerPorId.mockResolvedValue({
      id: 99,
      fecha_inicio: '2026-06-01',
      fecha_fin: '2026-06-01',
    });

    const result = await PeriodosService.crear(1, {
      fecha_inicio: '2026-06-01',
      fecha_fin: '2026-06-01',
      nombre: 'Período corto',
    });
    expect(result.id).toBe(99);
  });

  test('llamada exitosa invoca PeriodosModel.crear', async () => {
    PeriodosModel.crear.mockResolvedValue(42);
    PeriodosModel.obtenerPorId.mockResolvedValue({
      id: 42,
      fecha_inicio: '2026-06-01',
      fecha_fin: '2026-06-15',
      puestos: [],
    });

    await PeriodosService.crear(1, { fecha_inicio: '2026-06-01', fecha_fin: '2026-06-15' });
    expect(PeriodosModel.crear).toHaveBeenCalledWith(1, expect.objectContaining({
      fecha_inicio: '2026-06-01',
      fecha_fin: '2026-06-15',
    }));
  });
});

// ── cerrar ────────────────────────────────────────────────────────────────────

describe('PeriodosService.cerrar', () => {
  test('período ya cerrado → AppError 409', async () => {
    PeriodosModel.obtenerPorId.mockResolvedValue({ id: 1, estado: 'cerrado' });
    await expect(PeriodosService.cerrar(1, 1, 99)).rejects.toMatchObject({ statusCode: 409 });
  });

  test('período liquidado → AppError 409', async () => {
    PeriodosModel.obtenerPorId.mockResolvedValue({ id: 1, estado: 'liquidado' });
    await expect(PeriodosService.cerrar(1, 1, 99)).rejects.toMatchObject({ statusCode: 409 });
  });

  test('período abierto → llama cerrarConSnapshot y devuelve período', async () => {
    PeriodosModel.obtenerPorId
      .mockResolvedValueOnce({ id: 1, estado: 'abierto' })   // obtener()
      .mockResolvedValueOnce({ id: 1, estado: 'cerrado' });  // resultado final
    PeriodosModel.cerrarConSnapshot.mockResolvedValue(undefined);

    const result = await PeriodosService.cerrar(1, 1, 99);
    expect(PeriodosModel.cerrarConSnapshot).toHaveBeenCalledWith(1, 1, 99);
    expect(result.estado).toBe('cerrado');
  });
});

// ── liquidar ──────────────────────────────────────────────────────────────────

describe('PeriodosService.liquidar', () => {
  test('período abierto → AppError 409', async () => {
    PeriodosModel.obtenerPorId.mockResolvedValue({ id: 1, estado: 'abierto' });
    await expect(PeriodosService.liquidar(1, 1)).rejects.toMatchObject({ statusCode: 409 });
  });

  test('período liquidado → AppError 409', async () => {
    PeriodosModel.obtenerPorId.mockResolvedValue({ id: 1, estado: 'liquidado' });
    await expect(PeriodosService.liquidar(1, 1)).rejects.toMatchObject({ statusCode: 409 });
  });

  test('período cerrado → llama PeriodosModel.liquidar', async () => {
    PeriodosModel.obtenerPorId
      .mockResolvedValueOnce({ id: 1, estado: 'cerrado' })
      .mockResolvedValueOnce({ id: 1, estado: 'liquidado' });
    PeriodosModel.liquidar.mockResolvedValue(undefined);

    const result = await PeriodosService.liquidar(1, 1);
    expect(PeriodosModel.liquidar).toHaveBeenCalledWith(1, 1);
    expect(result.estado).toBe('liquidado');
  });
});

// ── obtener ───────────────────────────────────────────────────────────────────

describe('PeriodosService.obtener', () => {
  test('período no encontrado → AppError 404', async () => {
    PeriodosModel.obtenerPorId.mockResolvedValue(null);
    await expect(PeriodosService.obtener(1, 999)).rejects.toMatchObject({ statusCode: 404 });
  });

  test('período existente → lo retorna', async () => {
    PeriodosModel.obtenerPorId.mockResolvedValue({ id: 5, estado: 'abierto' });
    const result = await PeriodosService.obtener(1, 5);
    expect(result.id).toBe(5);
  });
});
