'use strict';

jest.mock('../modules/trabajador-empresa/trabajador-empresa.model');
jest.mock('../modules/trabajadores/trabajadores.service');

const TrabajadorEmpresaModel = require('../modules/trabajador-empresa/trabajador-empresa.model');
const TrabajadoresService = require('../modules/trabajadores/trabajadores.service');
const TrabajadorEmpresaService = require('../modules/trabajador-empresa/trabajador-empresa.service');

const RELACION_ACTIVA = { id: 618, estado: 'activo', usuario_id: 628, empresa_id: 4 };

beforeEach(() => {
  jest.clearAllMocks();
  TrabajadoresService.obtener.mockResolvedValue({ id: 622, usuario_id: 628, empresa_id: 4 });
  TrabajadorEmpresaModel.obtenerPorUsuarioEmpresa.mockResolvedValue(RELACION_ACTIVA);
  TrabajadorEmpresaModel.cambiarEstado.mockResolvedValue(undefined);
  TrabajadorEmpresaModel.obtenerPorId.mockResolvedValue({ ...RELACION_ACTIVA, estado: 'archivado' });
});

describe('TrabajadorEmpresaService.bloquearOfertas', () => {
  test('trabajador de otra empresa → propaga el 404 de TrabajadoresService.obtener', async () => {
    TrabajadoresService.obtener.mockRejectedValue(Object.assign(new Error('Trabajador no encontrado'), { statusCode: 404 }));

    await expect(TrabajadorEmpresaService.bloquearOfertas(4, 999)).rejects.toMatchObject({ statusCode: 404 });
    expect(TrabajadorEmpresaModel.cambiarEstado).not.toHaveBeenCalled();
  });

  test('ficha sin usuario_id (placeholder, cuenta no activada) → AppError 409', async () => {
    TrabajadoresService.obtener.mockResolvedValue({ id: 622, usuario_id: null, empresa_id: 4 });

    await expect(TrabajadorEmpresaService.bloquearOfertas(4, 622)).rejects.toMatchObject({ statusCode: 409 });
    expect(TrabajadorEmpresaModel.cambiarEstado).not.toHaveBeenCalled();
  });

  test('sin vínculo activo con esta empresa → AppError 409', async () => {
    TrabajadorEmpresaModel.obtenerPorUsuarioEmpresa.mockResolvedValue(null);

    await expect(TrabajadorEmpresaService.bloquearOfertas(4, 622)).rejects.toMatchObject({ statusCode: 409 });
    expect(TrabajadorEmpresaModel.cambiarEstado).not.toHaveBeenCalled();
  });

  test('vínculo activo → lo archiva', async () => {
    await TrabajadorEmpresaService.bloquearOfertas(4, 622);

    expect(TrabajadorEmpresaModel.cambiarEstado).toHaveBeenCalledWith(618, 'archivado');
  });
});
