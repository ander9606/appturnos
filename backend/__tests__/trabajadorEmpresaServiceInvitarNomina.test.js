'use strict';

// invitar(empresaId, cedula, 'nomina') debe poder ofrecer nómina a un trabajador
// que YA es 'activo' en la empresa (ese es justo el caso de conversión turnos →
// nómina: el trabajador debe aceptar). Antes del fix, cualquier relación 'activo'
// se rechazaba con "ya es parte de tu empresa" sin mirar el tipo ofrecido, y la
// conversión nunca podía completarse.
jest.mock('../config/database', () => ({
  pool: { query: jest.fn() },
}));
jest.mock('../modules/trabajador-empresa/trabajador-empresa.model');
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificar: jest.fn().mockResolvedValue(undefined),
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const { pool } = require('../config/database');
const { ROLES, ESTADOS_TRABAJADOR_EMPRESA: E } = require('../config/constants');
const TrabajadorEmpresaModel = require('../modules/trabajador-empresa/trabajador-empresa.model');
const NotificacionesService = require('../modules/notificaciones/notificaciones.service');
const TrabajadorEmpresaService = require('../modules/trabajador-empresa/trabajador-empresa.service');

const CEDULA = '123';
const EMPRESA_ID = 1;
const USUARIO_ID = 42;
const TRABAJADOR_ID = 5;

function mockBusquedas() {
  pool.query
    // ficha del trabajador en esta empresa
    .mockResolvedValueOnce([[{ id: TRABAJADOR_ID, usuario_id: USUARIO_ID, empresa_id: EMPRESA_ID }]])
    // cuenta asociada a la cédula
    .mockResolvedValueOnce([[{ usuario_id: USUARIO_ID, rol: ROLES.TRABAJADOR_TURNOS }]])
    // UPDATE trabajadores SET usuario_id ... (no-op, ya estaba seteado)
    .mockResolvedValueOnce([{ affectedRows: 0 }]);
}

beforeEach(() => {
  pool.query.mockReset();
  TrabajadorEmpresaModel.obtenerPorUsuarioEmpresa.mockReset();
  TrabajadorEmpresaModel.cambiarEstado.mockReset().mockResolvedValue(1);
  TrabajadorEmpresaModel.obtenerPorId.mockReset().mockResolvedValue({ id: 99 });
  NotificacionesService.notificar.mockClear();
});

describe('TrabajadorEmpresaService.invitar — conversión turnos → nómina', () => {
  test('trabajador ya activo + tipo nomina → ofrece la conversión (no rechaza)', async () => {
    mockBusquedas();
    TrabajadorEmpresaModel.obtenerPorUsuarioEmpresa.mockResolvedValue({ id: 99, estado: E.ACTIVO });

    const resultado = await TrabajadorEmpresaService.invitar(EMPRESA_ID, CEDULA, 'nomina');

    expect(resultado).toEqual({ id: 99 });
    expect(TrabajadorEmpresaModel.cambiarEstado).toHaveBeenCalledWith(99, E.SOLICITADO_POR_EMPRESA, {
      trabajadorId: TRABAJADOR_ID,
      tipoOfrecido: 'nomina',
      motivo: null,
      activoAntesDeOferta: true,
    });
    expect(NotificacionesService.notificar).toHaveBeenCalled();
  });

  test('trabajador ya activo + tipo turnos → sigue rechazando (invitación redundante)', async () => {
    mockBusquedas();
    TrabajadorEmpresaModel.obtenerPorUsuarioEmpresa.mockResolvedValue({ id: 99, estado: E.ACTIVO });

    await expect(
      TrabajadorEmpresaService.invitar(EMPRESA_ID, CEDULA, 'turnos')
    ).rejects.toMatchObject({ statusCode: 409, message: 'Este trabajador ya es parte de tu empresa' });

    expect(TrabajadorEmpresaModel.cambiarEstado).not.toHaveBeenCalled();
  });
});
