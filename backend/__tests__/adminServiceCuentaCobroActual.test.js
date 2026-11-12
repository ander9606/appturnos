'use strict';

jest.mock('../modules/admin/admin.model');
jest.mock('../modules/empresas/empresas.model');
jest.mock('../modules/suscripciones/planes.model');
jest.mock('../utils/facturaPdf', () => ({ generarFacturaPdf: jest.fn().mockResolvedValue(Buffer.from('pdf')) }));

const AdminModel = require('../modules/admin/admin.model');
const EmpresasModel = require('../modules/empresas/empresas.model');
const { PlanesModel, montoSuscripcionCop } = require('../modules/suscripciones/planes.model');
const AdminService = require('../modules/admin/admin.service');
const { generarFacturaPdf } = require('../utils/facturaPdf');

const empresa = (overrides) => ({
  id: 8, nombre: 'Logística Demo S.A.S', nit: '900111222', email: 'admin@logistica.co',
  plan: 'profesional', suscripcion_vigente_hasta: '2026-12-15',
  suscripcion_valor_mes_cop: null, suscripcion_meses: null,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  AdminModel.obtenerUltimoMesesPagado.mockResolvedValue(null);
});

describe('AdminService.generarCuentaCobroActual', () => {
  test('empresa inexistente → AppError 404', async () => {
    AdminModel.obtenerEmpresaParaCuentaCobro.mockResolvedValue(null);

    await expect(AdminService.generarCuentaCobroActual(999)).rejects.toMatchObject({ statusCode: 404 });
    expect(generarFacturaPdf).not.toHaveBeenCalled();
  });

  test('sin fecha de fin de plan → AppError 409', async () => {
    AdminModel.obtenerEmpresaParaCuentaCobro.mockResolvedValue(empresa({ suscripcion_vigente_hasta: null }));

    await expect(AdminService.generarCuentaCobroActual(8)).rejects.toMatchObject({ statusCode: 409 });
    expect(generarFacturaPdf).not.toHaveBeenCalled();
  });

  test('con suscripcion_valor_mes_cop conocido: usa ese valor × meses, sin consultar planes', async () => {
    AdminModel.obtenerEmpresaParaCuentaCobro.mockResolvedValue(
      empresa({ suscripcion_valor_mes_cop: 169000, suscripcion_meses: 1 })
    );

    const { pdf } = await AdminService.generarCuentaCobroActual(8);

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(PlanesModel.listar).not.toHaveBeenCalled();
    expect(generarFacturaPdf).toHaveBeenCalledWith(expect.objectContaining({
      cliente: { nombre: 'Logística Demo S.A.S', nit: '900111222', email: 'admin@logistica.co' },
      concepto: 'Suscripción Zaturno plan profesional — del 15/11/2026 al 15/12/2026',
      montoCop: 169000,
    }));
  });

  test('sin suscripcion_valor_mes_cop: recalcula con el precio vigente para sus trabajadores activos', async () => {
    AdminModel.obtenerEmpresaParaCuentaCobro.mockResolvedValue(empresa());
    EmpresasModel.contarTrabajadoresActivos.mockResolvedValue(12);
    PlanesModel.listar.mockResolvedValue([{ codigo: 'profesional', max_trabajadores: 30 }]);
    montoSuscripcionCop.mockReturnValue(169000);

    const { pdf } = await AdminService.generarCuentaCobroActual(8);

    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(montoSuscripcionCop).toHaveBeenCalledWith({ codigo: 'profesional', max_trabajadores: 30 }, 12, 1);
    expect(generarFacturaPdf).toHaveBeenCalledWith(expect.objectContaining({ montoCop: 169000 }));
  });

  test('suscripcion_meses NULL pero el último pago Wompi fue anual: autodetecta 12 meses (no asume mensual)', async () => {
    AdminModel.obtenerEmpresaParaCuentaCobro.mockResolvedValue(empresa());
    AdminModel.obtenerUltimoMesesPagado.mockResolvedValue(12);
    EmpresasModel.contarTrabajadoresActivos.mockResolvedValue(12);
    PlanesModel.listar.mockResolvedValue([{ codigo: 'profesional', max_trabajadores: 30 }]);
    montoSuscripcionCop.mockReturnValue(1700000);

    await AdminService.generarCuentaCobroActual(8);

    expect(montoSuscripcionCop).toHaveBeenCalledWith({ codigo: 'profesional', max_trabajadores: 30 }, 12, 12);
    expect(generarFacturaPdf).toHaveBeenCalledWith(expect.objectContaining({
      concepto: 'Suscripción Zaturno plan profesional — del 15/12/2025 al 15/12/2026',
      montoCop: 1700000,
    }));
  });

  test('meses forzado a mano (12): ignora suscripcion_valor_mes_cop (quedó calculado para otra modalidad) y recalcula', async () => {
    AdminModel.obtenerEmpresaParaCuentaCobro.mockResolvedValue(
      empresa({ suscripcion_valor_mes_cop: 169000, suscripcion_meses: 1 })
    );
    EmpresasModel.contarTrabajadoresActivos.mockResolvedValue(12);
    PlanesModel.listar.mockResolvedValue([{ codigo: 'profesional', max_trabajadores: 30 }]);
    montoSuscripcionCop.mockReturnValue(1700000);

    await AdminService.generarCuentaCobroActual(8, { meses: 12 });

    expect(AdminModel.obtenerUltimoMesesPagado).not.toHaveBeenCalled();
    expect(montoSuscripcionCop).toHaveBeenCalledWith({ codigo: 'profesional', max_trabajadores: 30 }, 12, 12);
    expect(generarFacturaPdf).toHaveBeenCalledWith(expect.objectContaining({ montoCop: 1700000 }));
  });
});
