'use strict';

// rechazar()/archivar() solo dejaban actuar como "empresa" a jefe_turnos —
// admin_empresa (que sí puede invitar/aprobar/ver solicitudes, ver SOLO_JEFE
// en las rutas) se quedaba sin poder rechazar ni archivar, con un 403 confuso.
jest.mock('../config/database', () => ({
  pool: { query: jest.fn() },
}));
jest.mock('../modules/trabajador-empresa/trabajador-empresa.model');

const { ROLES, ESTADOS_TRABAJADOR_EMPRESA: E } = require('../config/constants');
const TrabajadorEmpresaModel = require('../modules/trabajador-empresa/trabajador-empresa.model');
const TrabajadorEmpresaService = require('../modules/trabajador-empresa/trabajador-empresa.service');

const EMPRESA_ID = 1;
const RELACION_ID = 10;

beforeEach(() => {
  TrabajadorEmpresaModel.cambiarEstado.mockReset().mockResolvedValue(1);
  TrabajadorEmpresaModel.obtenerPorId.mockReset();
});

describe('TrabajadorEmpresaService.rechazar — admin_empresa puede actuar como empresa', () => {
  test('admin_empresa rechaza una solicitud de su empresa', async () => {
    TrabajadorEmpresaModel.obtenerPorId
      .mockResolvedValueOnce({ id: RELACION_ID, empresa_id: EMPRESA_ID, usuario_id: 99, estado: E.SOLICITADO_POR_TRABAJADOR })
      .mockResolvedValueOnce({ id: RELACION_ID, empresa_id: EMPRESA_ID, estado: E.RECHAZADO });

    await TrabajadorEmpresaService.rechazar(555, ROLES.ADMIN_EMPRESA, EMPRESA_ID, RELACION_ID, null);

    expect(TrabajadorEmpresaModel.cambiarEstado).toHaveBeenCalledWith(RELACION_ID, E.RECHAZADO, { motivo: null });
  });

  test('admin_empresa de OTRA empresa sigue sin permisos', async () => {
    TrabajadorEmpresaModel.obtenerPorId.mockResolvedValue({
      id: RELACION_ID, empresa_id: EMPRESA_ID, usuario_id: 99, estado: E.SOLICITADO_POR_TRABAJADOR,
    });

    await expect(
      TrabajadorEmpresaService.rechazar(555, ROLES.ADMIN_EMPRESA, 2, RELACION_ID, null)
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe('TrabajadorEmpresaService.rechazar — oferta sobre un vínculo ya activo (ej. nómina)', () => {
  test('activo_antes_de_oferta=true → restaura activo en vez de cerrar el vínculo', async () => {
    TrabajadorEmpresaModel.obtenerPorId
      .mockResolvedValueOnce({
        id: RELACION_ID, empresa_id: EMPRESA_ID, usuario_id: 99,
        estado: E.SOLICITADO_POR_EMPRESA, activo_antes_de_oferta: 1,
      })
      .mockResolvedValueOnce({ id: RELACION_ID, empresa_id: EMPRESA_ID, estado: E.ACTIVO });

    const resultado = await TrabajadorEmpresaService.rechazar(99, ROLES.TRABAJADOR_TURNOS, null, RELACION_ID, null);

    expect(TrabajadorEmpresaModel.cambiarEstado).toHaveBeenCalledWith(RELACION_ID, E.ACTIVO, {
      tipoOfrecido: 'turnos',
      activoAntesDeOferta: false,
    });
    expect(resultado.estado).toBe(E.ACTIVO);
  });

  test('activo_antes_de_oferta=false (invitación nueva) → sigue cerrando el vínculo', async () => {
    TrabajadorEmpresaModel.obtenerPorId
      .mockResolvedValueOnce({
        id: RELACION_ID, empresa_id: EMPRESA_ID, usuario_id: 99,
        estado: E.SOLICITADO_POR_EMPRESA, activo_antes_de_oferta: 0,
      })
      .mockResolvedValueOnce({ id: RELACION_ID, empresa_id: EMPRESA_ID, estado: E.RECHAZADO });

    await TrabajadorEmpresaService.rechazar(99, ROLES.TRABAJADOR_TURNOS, null, RELACION_ID, null);

    expect(TrabajadorEmpresaModel.cambiarEstado).toHaveBeenCalledWith(RELACION_ID, E.RECHAZADO, { motivo: null });
  });
});

describe('TrabajadorEmpresaService.archivar — admin_empresa puede actuar como empresa', () => {
  test('admin_empresa archiva una relación activa de su empresa', async () => {
    TrabajadorEmpresaModel.obtenerPorId
      .mockResolvedValueOnce({ id: RELACION_ID, empresa_id: EMPRESA_ID, usuario_id: 99, estado: E.ACTIVO })
      .mockResolvedValueOnce({ id: RELACION_ID, empresa_id: EMPRESA_ID, estado: E.ARCHIVADO });

    await TrabajadorEmpresaService.archivar(555, ROLES.ADMIN_EMPRESA, EMPRESA_ID, RELACION_ID);

    expect(TrabajadorEmpresaModel.cambiarEstado).toHaveBeenCalledWith(RELACION_ID, E.ARCHIVADO);
  });
});
