'use strict';

// Seguridad: logiq360_base_url/logiq360_tenant_id son datos de sistema que
// solo emparejar() escribe (desde la respuesta de logiq360) — si el PUT
// genérico los aceptara del body, un admin_empresa podría apuntar el host al
// que el worker de reconciliación le manda el api_key real por X-API-Key
// (SSRF + robo de ese secreto). Ver ssrfGuard.test.js para el guard de fetch.
jest.mock('../modules/integracion/integracion.model');

const IntegracionModel = require('../modules/integracion/integracion.model');
const ConfiguracionService = require('../modules/integracion/services/configuracion.service');

describe('ConfiguracionService.actualizarConfig', () => {
  afterEach(() => jest.clearAllMocks());

  test('ignora logiq360_base_url/logiq360_tenant_id enviados en el body', async () => {
    IntegracionModel.obtenerConfig.mockResolvedValue({
      empresa_id: 1,
      activo: 1,
      logiq360_base_url: 'https://logiq360.real/',
      logiq360_tenant_id: 42,
      api_key: 'secreto-real',
    });

    await ConfiguracionService.actualizarConfig(1, {
      logiq360_base_url: 'https://atacante.com',
      logiq360_tenant_id: 999,
      webhook_url: 'https://cliente.com/webhook',
    });

    expect(IntegracionModel.guardarConfig).toHaveBeenCalledWith(1, expect.objectContaining({
      logiq360_base_url: 'https://logiq360.real/',
      logiq360_tenant_id: 42,
      webhook_url: 'https://cliente.com/webhook',
    }));
  });

  test('sin config previa, no hay valor de logiq360_base_url que filtrar del body', async () => {
    IntegracionModel.obtenerConfig.mockResolvedValue(null);

    await ConfiguracionService.actualizarConfig(1, { logiq360_base_url: 'https://atacante.com' });

    expect(IntegracionModel.guardarConfig).toHaveBeenCalledWith(1, expect.objectContaining({
      logiq360_base_url: null,
      logiq360_tenant_id: null,
    }));
  });
});
