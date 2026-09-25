'use strict';

// Regresión del bug de emparejamiento: emparejar() guardaba appTurnosApiKey
// (la key que le entrega a logiq360 para el X-API-Key de las consultas pull)
// en incoming_secret — la columna que verifica la firma HMAC de los webhooks
// entrantes. Eso rompía la firma de TODO webhook que logiq360 mandara.
jest.mock('../modules/integracion/integracion.model');
jest.mock('../modules/integracion/services/conciliacion.service', () => ({
  autovincular: jest.fn().mockResolvedValue({ auto_vinculados: 0 }),
}));

const IntegracionModel = require('../modules/integracion/integracion.model');
const ConfiguracionService = require('../modules/integracion/services/configuracion.service');

const codigoValido = Buffer.from(JSON.stringify({
  url: 'https://logiq360.test', nonce: 'abc123', webhook_url: 'https://zaturno.test/eventos',
}), 'utf8').toString('base64url');

afterEach(() => jest.clearAllMocks());

describe('ConfiguracionService.emparejar', () => {
  beforeEach(() => {
    process.env.PUBLIC_API_URL = 'https://zaturno.test';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          tenant_id: 42,
          logiq360_base_url: 'https://logiq360.test',
          webhook_url: 'https://logiq360.test/api/integracion/eventos',
          incoming_secret: 'S_A_firma_de_logiq360',   // logiq360 firma sus webhooks con esto
          webhook_secret: 'S_B_para_firmar_nuestros',  // Zaturno firma sus webhooks con esto
          api_key: 'K_zaturno_llama_a_logiq360',
        },
      }),
    });
  });

  test('guarda incoming_secret = b.incoming_secret (S_A), NUNCA la api_key que generamos', async () => {
    await ConfiguracionService.emparejar(7, codigoValido);

    expect(IntegracionModel.guardarConfig).toHaveBeenCalledWith(7, expect.objectContaining({
      incoming_secret: 'S_A_firma_de_logiq360',
      webhook_secret: 'S_B_para_firmar_nuestros',
      api_key: 'K_zaturno_llama_a_logiq360',
    }));

    const guardado = IntegracionModel.guardarConfig.mock.calls[0][1];
    expect(guardado.incoming_secret).not.toBe(guardado.logiq360_api_key);
  });

  test('guarda la api_key generada localmente en logiq360_api_key (no en incoming_secret)', async () => {
    await ConfiguracionService.emparejar(7, codigoValido);

    const guardado = IntegracionModel.guardarConfig.mock.calls[0][1];
    expect(guardado.logiq360_api_key).toMatch(/^at_[0-9a-f]{64}$/);

    // La misma key es la que se le mandó a logiq360 en la confirmación.
    const bodyEnviado = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(bodyEnviado.app_turnos_api_key).toBe(guardado.logiq360_api_key);
  });
});
