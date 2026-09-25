'use strict';

// Al aceptar una conversión a nómina, las demás relaciones del trabajador se
// archivan (ver trabajadorEmpresaServiceInvitarNomina.test.js para el paso
// previo de invitar). Esto además debe suspender su ficha (activo=0) en cada
// una de esas otras empresas para que su Equipo deje de mostrarlo como
// disponible — antes solo se archivaba la relación, la ficha seguía "activa".
jest.mock('../config/database', () => ({
  pool: { query: jest.fn() },
}));
jest.mock('../modules/trabajador-empresa/trabajador-empresa.model');
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/empresas/empresas.model');
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificar: jest.fn().mockResolvedValue(undefined),
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const { pool } = require('../config/database');
const { ROLES, ESTADOS_TRABAJADOR_EMPRESA: E } = require('../config/constants');
const TrabajadorEmpresaModel = require('../modules/trabajador-empresa/trabajador-empresa.model');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const EmpresasModel = require('../modules/empresas/empresas.model');
const TrabajadorEmpresaService = require('../modules/trabajador-empresa/trabajador-empresa.service');

const USUARIO_ID = 42;
const RELACION_ID = 10;
const EMPRESA_NUEVA = 1;

beforeEach(() => {
  pool.query.mockReset();
  TrabajadoresModel.desactivar.mockReset().mockResolvedValue(1);
  EmpresasModel.obtenerDetalle.mockReset().mockResolvedValue({ id: EMPRESA_NUEVA, nombre: 'Empresa Nómina' });
  TrabajadorEmpresaModel.obtenerPorId.mockReset().mockResolvedValue({
    id: RELACION_ID,
    usuario_id: USUARIO_ID,
    empresa_id: EMPRESA_NUEVA,
    estado: E.SOLICITADO_POR_EMPRESA,
    tipo_ofrecido: 'nomina',
    trabajador_id: 5,
  });
  TrabajadorEmpresaModel.cambiarEstado.mockReset().mockResolvedValue(1);
  TrabajadorEmpresaModel.archivarOtrasRelacionesDeUsuario.mockReset().mockResolvedValue([
    { id: 20, empresa_id: 2, trabajador_id: 77 }, // ficha existente en la otra empresa
    { id: 21, empresa_id: 3, trabajador_id: null }, // invitación pendiente, nunca llegó a crear ficha
  ]);

  // pool.query, en orden: SELECT usuarios (rol) → UPDATE tipo → UPDATE rol/empresa
  // → notificarGestores(empresa 2) → notificarGestores(empresa 3) → notificarGestores(empresa nueva, 'aceptada')
  pool.query
    .mockResolvedValueOnce([[{ nombre: 'Ana', apellido: 'Pérez', rol: ROLES.TRABAJADOR_TURNOS }]])
    .mockResolvedValueOnce([{ affectedRows: 1 }])
    .mockResolvedValueOnce([{ affectedRows: 1 }])
    .mockResolvedValueOnce([[{ id: 501 }]])
    .mockResolvedValueOnce([[{ id: 502 }]])
    .mockResolvedValueOnce([[{ id: 503 }]]);
});

describe('TrabajadorEmpresaService.aceptar — conversión a nómina suspende otras empresas', () => {
  test('desactiva la ficha solo donde ya existía (trabajador_id no nulo)', async () => {
    await TrabajadorEmpresaService.aceptar(USUARIO_ID, RELACION_ID);

    expect(TrabajadoresModel.desactivar).toHaveBeenCalledTimes(1);
    expect(TrabajadoresModel.desactivar).toHaveBeenCalledWith(2, 77);
  });
});
