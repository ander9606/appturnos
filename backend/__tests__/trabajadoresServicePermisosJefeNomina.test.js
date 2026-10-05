'use strict';

// jefe_nomina edita fichas de nómina, sin tocar tipo ni datos de pago; y todo
// cambio de sueldo —venga de quien venga— pasa por la vía auditada.
jest.mock('../config/database', () => ({ pool: { query: jest.fn().mockResolvedValue([[]]) } }));
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificar: jest.fn().mockResolvedValue(undefined),
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const { ROLES } = require('../config/constants');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const TrabajadoresService = require('../modules/trabajadores/trabajadores.service');

const EMPRESA = 1;
const ID = 7;
const ficha = (tipo) => ({ id: ID, nombre: 'Ana', apellido: 'Pérez', usuario_id: 99, email: null, tipo, tarifa_hora: null, salario_base: '1500000' });
const jefe = { usuario_id: 5, usuario_nombre: 'Luis', usuario_rol: ROLES.JEFE_NOMINA, ip: '10.0.0.1' };
const admin = { usuario_id: 2, usuario_nombre: 'Marta', usuario_rol: ROLES.ADMIN_EMPRESA, ip: '10.0.0.2' };

beforeEach(() => {
  jest.clearAllMocks();
  TrabajadoresModel.obtenerPorId.mockResolvedValue(ficha('nomina'));
  TrabajadoresModel.actualizar.mockResolvedValue(1);
  TrabajadoresModel.actualizarSalarioConAuditoria.mockResolvedValue({ cambio: false });
});

test('jefe_nomina edita datos personales de una ficha de nómina', async () => {
  await TrabajadoresService.actualizar(EMPRESA, ID, { telefono: '3001234567', cargo: 'Auxiliar' }, jefe);
  expect(TrabajadoresModel.actualizar).toHaveBeenCalledWith(EMPRESA, ID, { telefono: '3001234567', cargo: 'Auxiliar' });
});

test('jefe_nomina no edita fichas de turnos', async () => {
  TrabajadoresModel.obtenerPorId.mockResolvedValue(ficha('turnos'));
  await expect(TrabajadoresService.actualizar(EMPRESA, ID, { telefono: '3001234567' }, jefe))
    .rejects.toMatchObject({ statusCode: 403 });
  expect(TrabajadoresModel.actualizar).not.toHaveBeenCalled();
});

test('jefe_nomina no puede cambiar tipo ni datos de pago', async () => {
  await expect(TrabajadoresService.actualizar(EMPRESA, ID, { banco: 'Bancolombia', numero_cuenta: '123' }, jefe))
    .rejects.toMatchObject({ statusCode: 403, message: expect.stringContaining('banco') });
  expect(TrabajadoresModel.actualizar).not.toHaveBeenCalled();
});

test('el sueldo en PUT pasa por actualizarSalario (auditoría), no por el UPDATE genérico', async () => {
  await TrabajadoresService.actualizar(EMPRESA, ID, { tarifa_hora: 15000, telefono: '3000000000' }, jefe);
  expect(TrabajadoresModel.actualizar).toHaveBeenCalledWith(EMPRESA, ID, { telefono: '3000000000' });
  expect(TrabajadoresModel.actualizarSalarioConAuditoria).toHaveBeenCalledWith(
    EMPRESA, ID, { tarifa_hora: 15000, salario_base: undefined }, jefe
  );
});

test('admin_empresa también registra en auditoría un cambio de sueldo por PUT', async () => {
  await TrabajadoresService.actualizar(EMPRESA, ID, { salario_base: 1800000 }, admin);
  expect(TrabajadoresModel.actualizarSalarioConAuditoria).toHaveBeenCalledWith(
    EMPRESA, ID, { tarifa_hora: undefined, salario_base: 1800000 }, admin
  );
  const payloadGenerico = TrabajadoresModel.actualizar.mock.calls[0]?.[2] ?? {};
  expect(payloadGenerico).not.toHaveProperty('salario_base');
});
