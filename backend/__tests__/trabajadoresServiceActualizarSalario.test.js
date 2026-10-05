'use strict';

// Cambiar el sueldo notifica a los admins (si lo hizo un jefe_nomina) y al
// trabajador afectado; si el valor no cambia, no se notifica a nadie.
jest.mock('../config/database', () => ({
  pool: { query: jest.fn() },
}));
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificar: jest.fn().mockResolvedValue(undefined),
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const { pool } = require('../config/database');
const { ROLES } = require('../config/constants');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const NotificacionesService = require('../modules/notificaciones/notificaciones.service');
const TrabajadoresService = require('../modules/trabajadores/trabajadores.service');

const EMPRESA_ID = 1;
const TRABAJADOR_ID = 7;
const base = { id: TRABAJADOR_ID, nombre: 'Ana', apellido: 'Pérez', usuario_id: 99, tarifa_hora: null, salario_base: '1500000.00' };
const auditoriaJefe = { usuario_id: 5, usuario_nombre: 'Luis', usuario_rol: ROLES.JEFE_NOMINA, ip: '10.0.0.1' };
const auditoriaAdmin = { usuario_id: 2, usuario_nombre: 'Marta', usuario_rol: ROLES.ADMIN_EMPRESA, ip: '10.0.0.2' };

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockReset().mockResolvedValue([[{ id: 1 }, { id: 2 }]]);
  TrabajadoresModel.obtenerPorId.mockResolvedValue({ ...base, salario_base: '1800000' });
});

test('jefe_nomina cambia el sueldo → avisa a admins y al trabajador', async () => {
  TrabajadoresModel.actualizarSalarioConAuditoria.mockResolvedValue({
    cambio: true, trabajadorId: TRABAJADOR_ID, usuarioId: 99, nombre: 'Ana Pérez',
  });

  await TrabajadoresService.actualizarSalario(EMPRESA_ID, TRABAJADOR_ID, { tarifa_hora: null, salario_base: 1800000 }, auditoriaJefe);

  expect(TrabajadoresModel.actualizarSalarioConAuditoria).toHaveBeenCalledWith(
    EMPRESA_ID, TRABAJADOR_ID, { tarifa_hora: null, salario_base: 1800000 }, auditoriaJefe
  );
  expect(NotificacionesService.notificarVarios).toHaveBeenCalledWith([1, 2], expect.objectContaining({
    empresaId: EMPRESA_ID, tipo: 'nomina.salario_modificado', mensaje: 'Luis modificó el sueldo de Ana Pérez.',
  }));
  expect(NotificacionesService.notificar).toHaveBeenCalledWith(expect.objectContaining({
    empresaId: EMPRESA_ID, usuarioId: 99, tipo: 'nomina.salario_modificado',
  }));
});

test('admin_empresa cambia el sueldo → no se avisa a admins (lo hizo uno), sí al trabajador', async () => {
  TrabajadoresModel.actualizarSalarioConAuditoria.mockResolvedValue({
    cambio: true, trabajadorId: TRABAJADOR_ID, usuarioId: 99, nombre: 'Ana Pérez',
  });

  await TrabajadoresService.actualizarSalario(EMPRESA_ID, TRABAJADOR_ID, { tarifa_hora: null, salario_base: 1800000 }, auditoriaAdmin);

  expect(NotificacionesService.notificarVarios).not.toHaveBeenCalled();
  expect(NotificacionesService.notificar).toHaveBeenCalledTimes(1);
});

test('sin cambio de valor → no notifica a nadie', async () => {
  TrabajadoresModel.actualizarSalarioConAuditoria.mockResolvedValue({ cambio: false });
  TrabajadoresModel.obtenerPorId.mockResolvedValue(base);

  await TrabajadoresService.actualizarSalario(EMPRESA_ID, TRABAJADOR_ID, { tarifa_hora: null, salario_base: 1500000 }, auditoriaJefe);

  expect(NotificacionesService.notificarVarios).not.toHaveBeenCalled();
  expect(NotificacionesService.notificar).not.toHaveBeenCalled();
});
