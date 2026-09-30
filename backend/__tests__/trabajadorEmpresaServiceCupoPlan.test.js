'use strict';

// El cupo de trabajadores del plan (max_trabajadores) solo se validaba en
// TrabajadoresService.crear() — invitar por cédula (y aceptar/aprobar, que
// terminan en el mismo vincularTrabajador()) sumaban un trabajador activo
// sin pasar por ese chequeo. Estos tests verifican que las tres puertas
// ahora llaman a verificarCupoPlan() antes de sumar una ficha nueva, y que
// NO se dispara cuando la ficha ya existe (evita falsos bloqueos en
// re-invitaciones o conversión a nómina de alguien ya activo).
jest.mock('../config/database', () => ({
  pool: { query: jest.fn() },
}));
jest.mock('../modules/trabajador-empresa/trabajador-empresa.model');
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/trabajadores/trabajadores.service');
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificar: jest.fn().mockResolvedValue(undefined),
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const AppError = require('../utils/AppError');
const { pool } = require('../config/database');
const { ROLES, ESTADOS_TRABAJADOR_EMPRESA: E } = require('../config/constants');
const TrabajadorEmpresaModel = require('../modules/trabajador-empresa/trabajador-empresa.model');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const TrabajadoresService = require('../modules/trabajadores/trabajadores.service');
const TrabajadorEmpresaService = require('../modules/trabajador-empresa/trabajador-empresa.service');

const EMPRESA_ID = 1;
const USUARIO_ID = 42;
const RELACION_ID = 99;

function cupoLleno() {
  return new AppError('Tu plan básico permite máximo 10 trabajadores activos. Amplía tu plan en Mi plan para agregar más.', 402);
}

beforeEach(() => {
  pool.query.mockReset();
  TrabajadorEmpresaModel.obtenerPorUsuarioEmpresa.mockReset();
  TrabajadorEmpresaModel.obtenerPorId.mockReset();
  TrabajadorEmpresaModel.cambiarEstado.mockReset().mockResolvedValue(1);
  TrabajadoresModel.crear.mockReset();
  TrabajadoresModel.obtenerPersonalPorUsuarioId.mockReset().mockResolvedValue(null);
  TrabajadoresService.verificarCupoPlan.mockReset().mockResolvedValue(undefined);
});

describe('invitar() — cupo de plan al crear ficha nueva', () => {
  test('empresa al tope + cédula sin ficha propia → 402, nunca crea la ficha', async () => {
    pool.query
      .mockResolvedValueOnce([[]]) // sin ficha en esta empresa
      .mockResolvedValueOnce([[]]); // sin cuenta asociada a la cédula
    TrabajadoresService.verificarCupoPlan.mockRejectedValue(cupoLleno());

    await expect(
      TrabajadorEmpresaService.invitar(EMPRESA_ID, '999', 'turnos')
    ).rejects.toMatchObject({ statusCode: 402 });

    expect(TrabajadoresService.verificarCupoPlan).toHaveBeenCalledWith(EMPRESA_ID);
    expect(TrabajadoresModel.crear).not.toHaveBeenCalled();
  });

  test('ficha ya existe en esta empresa (re-invitación / conversión) → no valida cupo', async () => {
    pool.query
      .mockResolvedValueOnce([[{ id: 5, usuario_id: USUARIO_ID, empresa_id: EMPRESA_ID }]]) // ficha propia
      .mockResolvedValueOnce([[{ usuario_id: USUARIO_ID, rol: ROLES.TRABAJADOR_TURNOS }]])
      .mockResolvedValueOnce([{ affectedRows: 0 }]);
    TrabajadorEmpresaModel.obtenerPorUsuarioEmpresa.mockResolvedValue(null);
    TrabajadorEmpresaModel.crear = jest.fn().mockResolvedValue(RELACION_ID);
    TrabajadorEmpresaModel.obtenerPorId.mockResolvedValue({ id: RELACION_ID });

    await TrabajadorEmpresaService.invitar(EMPRESA_ID, '999', 'turnos');

    expect(TrabajadoresService.verificarCupoPlan).not.toHaveBeenCalled();
    expect(TrabajadoresModel.crear).not.toHaveBeenCalled();
  });
});

describe('aprobar() — cupo de plan al vincular una solicitud del trabajador', () => {
  test('empresa al tope + trabajador sin ficha en la empresa → 402, no crea ni reclama ficha', async () => {
    TrabajadorEmpresaModel.obtenerPorId.mockResolvedValue({
      id: RELACION_ID, empresa_id: EMPRESA_ID, usuario_id: USUARIO_ID, estado: E.SOLICITADO_POR_TRABAJADOR,
    });
    pool.query
      .mockResolvedValueOnce([[{ rol: ROLES.TRABAJADOR_TURNOS }]]) // rol del usuario
      .mockResolvedValueOnce([[]]); // vincularTrabajador: sin ficha existente en esta empresa
    TrabajadoresService.verificarCupoPlan.mockRejectedValue(cupoLleno());

    await expect(
      TrabajadorEmpresaService.aprobar(EMPRESA_ID, RELACION_ID)
    ).rejects.toMatchObject({ statusCode: 402 });

    expect(TrabajadoresService.verificarCupoPlan).toHaveBeenCalledWith(EMPRESA_ID);
    expect(TrabajadoresModel.obtenerPersonalPorUsuarioId).not.toHaveBeenCalled();
    expect(TrabajadoresModel.crear).not.toHaveBeenCalled();
    expect(TrabajadorEmpresaModel.cambiarEstado).not.toHaveBeenCalled();
  });

  test('el trabajador ya tiene ficha activa en esta empresa → no valida cupo', async () => {
    TrabajadorEmpresaModel.obtenerPorId.mockResolvedValue({
      id: RELACION_ID, empresa_id: EMPRESA_ID, usuario_id: USUARIO_ID, estado: E.SOLICITADO_POR_TRABAJADOR,
    });
    pool.query
      .mockResolvedValueOnce([[{ rol: ROLES.TRABAJADOR_TURNOS }]])
      .mockResolvedValueOnce([[{ id: 7 }]]) // vincularTrabajador: ya existe
      .mockResolvedValueOnce([[{ id: EMPRESA_ID, nombre: 'Acme' }]]); // EmpresasModel.obtenerDetalle para la notificación
    TrabajadorEmpresaModel.obtenerPorId
      .mockResolvedValueOnce({ id: RELACION_ID, empresa_id: EMPRESA_ID, usuario_id: USUARIO_ID, estado: E.SOLICITADO_POR_TRABAJADOR })
      .mockResolvedValueOnce({ id: RELACION_ID, estado: E.ACTIVO });

    await TrabajadorEmpresaService.aprobar(EMPRESA_ID, RELACION_ID);

    expect(TrabajadoresService.verificarCupoPlan).not.toHaveBeenCalled();
    expect(TrabajadorEmpresaModel.cambiarEstado).toHaveBeenCalledWith(RELACION_ID, E.ACTIVO, { trabajadorId: 7 });
  });
});
