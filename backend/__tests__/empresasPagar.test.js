'use strict';

jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../modules/integracion/integracion.model');
jest.mock('../modules/webhooks/wompi.service');

const { pool } = require('../config/database');
const IntegracionModel = require('../modules/integracion/integracion.model');
const WompiService = require('../modules/webhooks/wompi.service');
const { pagar } = require('../modules/empresas/empresas.routes');

const mockReq = (empresaId = 1) => ({ usuario: { empresa_id: empresaId } });
const mockRes = () => ({ json: jest.fn() });
const mockNext = () => jest.fn();

afterEach(() => jest.clearAllMocks());

describe('POST /api/empresas/pagar', () => {
  test('empresa conectada a logiq360 → 400, no genera link', async () => {
    IntegracionModel.estaConectado.mockResolvedValue(true);
    const next = mockNext();

    await pagar(mockReq(), mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(WompiService.generarLinkPago).not.toHaveBeenCalled();
  });

  test('empresa no conectada → genera link con el plan actual y 1 mes', async () => {
    IntegracionModel.estaConectado.mockResolvedValue(false);
    pool.query.mockResolvedValue([[{ nombre: 'Carpas SAS', plan: 'basico' }]]);
    WompiService.generarLinkPago.mockResolvedValue({ url: 'https://wompi.test/x', referencia: 'AT-1-basico-1', monto_cop: 129000, expira_at: '2026-01-01' });
    const res = mockRes();

    await pagar(mockReq(1), res, mockNext());

    expect(WompiService.generarLinkPago).toHaveBeenCalledWith({
      empresaId: 1, nombreEmpresa: 'Carpas SAS', plan: 'basico', meses: 1,
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test('empresa no encontrada → 404', async () => {
    IntegracionModel.estaConectado.mockResolvedValue(false);
    pool.query.mockResolvedValue([[]]);
    const next = mockNext();

    await pagar(mockReq(999), mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    expect(WompiService.generarLinkPago).not.toHaveBeenCalled();
  });
});
