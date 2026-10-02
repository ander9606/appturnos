'use strict';

jest.mock('../modules/admin/admin.model');

const AdminModel = require('../modules/admin/admin.model');
const AdminService = require('../modules/admin/admin.service');

beforeEach(() => {
  jest.clearAllMocks();
  AdminModel.obtenerEmpresa.mockResolvedValue({ id: 4, nombre: 'Carpas Vento SAS' });
  AdminModel.tieneNominaLiquidada.mockResolvedValue(false);
  AdminModel.tieneTrabajadorCompartido.mockResolvedValue(false);
  AdminModel.eliminarEmpresaCompleta.mockResolvedValue(undefined);
});

describe('AdminService.eliminarEmpresa', () => {
  test('empresa inexistente → AppError 404, no borra nada', async () => {
    AdminModel.obtenerEmpresa.mockResolvedValue(null);

    await expect(AdminService.eliminarEmpresa(999, 1)).rejects.toMatchObject({ statusCode: 404 });
    expect(AdminModel.eliminarEmpresaCompleta).not.toHaveBeenCalled();
  });

  test('con nómina cerrada/liquidada → AppError 409, no borra nada (retención legal)', async () => {
    AdminModel.tieneNominaLiquidada.mockResolvedValue(true);

    await expect(AdminService.eliminarEmpresa(4, 1)).rejects.toMatchObject({ statusCode: 409 });
    expect(AdminModel.eliminarEmpresaCompleta).not.toHaveBeenCalled();
  });

  test('con trabajador compartido con otra empresa → AppError 409, no borra nada', async () => {
    AdminModel.tieneTrabajadorCompartido.mockResolvedValue(true);

    await expect(AdminService.eliminarEmpresa(4, 1)).rejects.toMatchObject({ statusCode: 409 });
    expect(AdminModel.eliminarEmpresaCompleta).not.toHaveBeenCalled();
  });

  test('sin nómina liquidada ni trabajadores compartidos → borra', async () => {
    await AdminService.eliminarEmpresa(4, 1);

    expect(AdminModel.eliminarEmpresaCompleta).toHaveBeenCalledWith(4);
  });
});
