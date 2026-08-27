'use strict';

// Regresión: este middleware debía comparar X-API-Key contra
// integracion_config.logiq360_api_key, pero antes del fix comparaba contra
// incoming_secret — la misma columna que verificarFirmaLogiq360 usa para el
// HMAC de los webhooks entrantes. Un solo valor no puede servir para las dos
// verificaciones (son secretos distintos), así que una de las dos siempre
// fallaba: en la práctica, todo webhook entrante devolvía 401 "Firma inválida".
jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));

const { pool } = require('../config/database');
const { verificarApiKeyLogiq360 } = require('../middleware/verificarApiKeyLogiq360');

const mockReq = (apiKey) => ({ headers: apiKey ? { 'x-api-key': apiKey } : {} });
const mockNext = () => jest.fn();

afterEach(() => jest.clearAllMocks());

describe('verificarApiKeyLogiq360', () => {
  test('consulta logiq360_api_key (no incoming_secret) y aprueba si coincide', async () => {
    pool.query.mockResolvedValue([[{ empresa_id: 7 }]]);
    const req = mockReq('at_abc123');
    const next = mockNext();

    await verificarApiKeyLogiq360(req, {}, next);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringMatching(/logiq360_api_key\s*=\s*\?/),
      ['at_abc123']
    );
    expect(pool.query.mock.calls[0][0]).not.toMatch(/incoming_secret/);
    expect(req.empresa_id).toBe(7);
    expect(next).toHaveBeenCalledWith();
  });

  test('sin X-API-Key → 401 sin consultar la DB', async () => {
    const next = mockNext();
    await verificarApiKeyLogiq360(mockReq(null), {}, next);

    expect(pool.query).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  test('key que no coincide con ninguna empresa activa → 401', async () => {
    pool.query.mockResolvedValue([[]]);
    const next = mockNext();

    await verificarApiKeyLogiq360(mockReq('key-invalida'), {}, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });
});
