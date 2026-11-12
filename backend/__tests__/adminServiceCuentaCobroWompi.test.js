'use strict';

jest.mock('../modules/admin/admin.model');
jest.mock('../utils/facturaPdf', () => ({
  generarFacturaPdf: jest.fn().mockResolvedValue(Buffer.from('pdf')),
  emisorDesdeEnv: jest.fn().mockReturnValue({ nombre: 'Operador', documento: 'CC 1', email: 'op@ejemplo.co', firmaB64: null }),
}));

const AdminModel = require('../modules/admin/admin.model');
const AdminService = require('../modules/admin/admin.service');
const { generarFacturaPdf } = require('../utils/facturaPdf');

const evento = (overrides) => ({
  id: 7, plan: 'profesional', meses: 1, estado: 'procesado',
  procesado_at: '2026-11-01T12:00:00Z', created_at: '2026-10-30T12:00:00Z',
  empresa_id: 3, empresa_nombre: 'Carpas Vento SAS', empresa_nit: '900123456', empresa_email: 'admin@carpasvento.co',
  monto_cop: 169000,
  ...overrides,
});

beforeEach(() => jest.clearAllMocks());

describe('AdminService.generarCuentaCobroWompi', () => {
  test('evento inexistente → AppError 404, no genera PDF', async () => {
    AdminModel.obtenerWompiEvento.mockResolvedValue(null);

    await expect(AdminService.generarCuentaCobroWompi(999)).rejects.toMatchObject({ statusCode: 404 });
    expect(generarFacturaPdf).not.toHaveBeenCalled();
  });

  test('evento sin pago procesado → AppError 409, no genera PDF', async () => {
    AdminModel.obtenerWompiEvento.mockResolvedValue(evento({ estado: 'error' }));

    await expect(AdminService.generarCuentaCobroWompi(7)).rejects.toMatchObject({ statusCode: 409 });
    expect(generarFacturaPdf).not.toHaveBeenCalled();
  });

  test('evento procesado → genera la cuenta de cobro con el concepto y el monto del evento', async () => {
    AdminModel.obtenerWompiEvento.mockResolvedValue(evento());

    const { pdf, numero } = await AdminService.generarCuentaCobroWompi(7);

    expect(numero).toBe('ZT-000007');
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(generarFacturaPdf).toHaveBeenCalledWith(expect.objectContaining({
      numero: 'ZT-000007',
      cliente: { nombre: 'Carpas Vento SAS', nit: '900123456', email: 'admin@carpasvento.co' },
      concepto: 'Suscripción Zaturno plan profesional — 1 mes',
      montoCop: 169000,
    }));
  });

  test('cambio de plan a mitad de vigencia (meses=0) → el concepto dice "diferencia por el resto de la vigencia"', async () => {
    AdminModel.obtenerWompiEvento.mockResolvedValue(evento({ meses: 0 }));

    await AdminService.generarCuentaCobroWompi(7);

    expect(generarFacturaPdf).toHaveBeenCalledWith(expect.objectContaining({
      concepto: 'Cambio a plan profesional — diferencia por el resto de la vigencia',
    }));
  });
});
