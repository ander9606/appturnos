'use strict';

// Mock DB before requiring anything that touches the pool.
jest.mock('../config/database', () => ({
  pool: { query: jest.fn() },
}));
jest.mock('../modules/integracion/integracion.model');
jest.mock('../modules/integracion/entrantes.handlers');

const { pool } = require('../config/database');
const IntegracionModel = require('../modules/integracion/integracion.model');
const entrantesHandlers = require('../modules/integracion/entrantes.handlers');
const verificarSuscripcion = require('../middleware/verificarSuscripcion');
const EntrantesService = require('../modules/integracion/services/entrantes.service');

const mockRes = () => ({});
const mockNext = () => jest.fn();

// ── verificarSuscripcion: gratis vía logiq360 en vivo ──────────────────────────

describe('verificarSuscripcion', () => {
  test('empresa conectada a logiq360 (activo+api_key) pasa sin consultar vencimiento', async () => {
    IntegracionModel.estaConectado.mockResolvedValue(true);
    const next = mockNext();

    await verificarSuscripcion({ usuario: { empresa_id: 1 } }, mockRes(), next);

    expect(next).toHaveBeenCalledWith();
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('empresa NO conectada y suscripcion vencida (sin gracia) → 402', async () => {
    IntegracionModel.estaConectado.mockResolvedValue(false);
    pool.query.mockResolvedValueOnce([[{ suscripcion_vigente_hasta: '2020-01-01' }]]);
    const next = mockNext();

    await verificarSuscripcion({ usuario: { empresa_id: 1 } }, mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 402 }));
  });

  test('empresa NO conectada con suscripcion indefinida (manual) pasa', async () => {
    IntegracionModel.estaConectado.mockResolvedValue(false);
    pool.query.mockResolvedValueOnce([[{ suscripcion_vigente_hasta: null }]]);
    const next = mockNext();

    await verificarSuscripcion({ usuario: { empresa_id: 1 } }, mockRes(), next);

    expect(next).toHaveBeenCalledWith();
  });
});

// ── EntrantesService: eventos de sistema atraviesan el gate de `activo` ────────

describe('EntrantesService.recibirEvento — eventos de sistema', () => {
  beforeEach(() => {
    IntegracionModel.registrarEntrante.mockResolvedValue(1);
    IntegracionModel.marcarEntranteProcesado.mockResolvedValue(undefined);
    entrantesHandlers.procesar.mockResolvedValue(true);
  });

  test('integracion.desactivada se procesa aunque cfg.activo sea 1 (anuncia el propio apagado)', async () => {
    IntegracionModel.obtenerConfig.mockResolvedValue({ activo: 1 });

    const resultado = await EntrantesService.recibirEvento({
      empresaId: 1, eventId: 'e1', tipoEvento: 'integracion.desactivada', payload: { data: {} },
    });

    expect(resultado.procesado).toBe(true);
  });

  test('integracion.activada se procesa aunque cfg.activo sea 0 (reactivación)', async () => {
    IntegracionModel.obtenerConfig.mockResolvedValue({ activo: 0 });

    const resultado = await EntrantesService.recibirEvento({
      empresaId: 1, eventId: 'e2', tipoEvento: 'integracion.activada', payload: { data: {} },
    });

    expect(resultado.procesado).toBe(true);
  });

  test('orden.creada con cfg.activo=0 sigue rechazada con 403', async () => {
    IntegracionModel.obtenerConfig.mockResolvedValue({ activo: 0 });

    await expect(
      EntrantesService.recibirEvento({
        empresaId: 1, eventId: 'e3', tipoEvento: 'orden.creada', payload: { data: {} },
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test('sin config previa (nunca emparejado) → 403 aunque sea evento de sistema', async () => {
    IntegracionModel.obtenerConfig.mockResolvedValue(null);

    await expect(
      EntrantesService.recibirEvento({
        empresaId: 1, eventId: 'e4', tipoEvento: 'integracion.activada', payload: { data: {} },
      })
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
