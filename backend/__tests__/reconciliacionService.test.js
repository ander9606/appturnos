'use strict';

jest.mock('../modules/integracion/integracion.model');
jest.mock('../modules/integracion/entrantes.handlers', () => ({ procesar: jest.fn() }));

const IntegracionModel = require('../modules/integracion/integracion.model');
const entrantesHandlers = require('../modules/integracion/entrantes.handlers');
const ReconciliacionService = require('../modules/integracion/services/reconciliacion.service');

afterEach(() => jest.clearAllMocks());

const cfg = (overrides = {}) => ({
  empresa_id: 1, activo: 1, api_key: 'at_x', logiq360_base_url: 'https://logiq360.test',
  ...overrides,
});

describe('ReconciliacionService.reconciliarTodas', () => {
  test('logiq360 responde 200 y ya estaba activo=1 → no hace nada', async () => {
    IntegracionModel.listarConfiguradas.mockResolvedValue([cfg({ activo: 1 })]);
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });

    const corregidas = await ReconciliacionService.reconciliarTodas();

    expect(corregidas).toBe(0);
    expect(entrantesHandlers.procesar).not.toHaveBeenCalled();
  });

  test('logiq360 responde 401 (key ya no autentica) pero local sigue activo=1 → se corrige a desactivada', async () => {
    IntegracionModel.listarConfiguradas.mockResolvedValue([cfg({ activo: 1 })]);
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });

    const corregidas = await ReconciliacionService.reconciliarTodas();

    expect(corregidas).toBe(1);
    expect(entrantesHandlers.procesar).toHaveBeenCalledWith('integracion.desactivada', 1, {});
  });

  test('logiq360 responde 200 pero local está activo=0 (webhook de reactivación perdido) → se corrige a activada', async () => {
    IntegracionModel.listarConfiguradas.mockResolvedValue([cfg({ activo: 0 })]);
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });

    const corregidas = await ReconciliacionService.reconciliarTodas();

    expect(corregidas).toBe(1);
    expect(entrantesHandlers.procesar).toHaveBeenCalledWith('integracion.activada', 1, {});
  });

  test('error de red (no HTTP status) no toca el estado local', async () => {
    IntegracionModel.listarConfiguradas.mockResolvedValue([cfg({ activo: 1 })]);
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const corregidas = await ReconciliacionService.reconciliarTodas();

    expect(corregidas).toBe(0);
    expect(entrantesHandlers.procesar).not.toHaveBeenCalled();
  });

  test('5xx transitorio no toca el estado local', async () => {
    IntegracionModel.listarConfiguradas.mockResolvedValue([cfg({ activo: 1 })]);
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });

    const corregidas = await ReconciliacionService.reconciliarTodas();

    expect(corregidas).toBe(0);
    expect(entrantesHandlers.procesar).not.toHaveBeenCalled();
  });

  test('sigue con las demás empresas si una falla inesperadamente', async () => {
    IntegracionModel.listarConfiguradas.mockResolvedValue([
      cfg({ empresa_id: 1, activo: 1 }),
      cfg({ empresa_id: 2, activo: 1 }),
    ]);
    global.fetch = jest.fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ ok: false, status: 401 });

    const corregidas = await ReconciliacionService.reconciliarTodas();

    expect(corregidas).toBe(1);
    expect(entrantesHandlers.procesar).toHaveBeenCalledWith('integracion.desactivada', 2, {});
  });
});
