'use strict';

// Destinatarios de avisos a gestores: congela el SQL y los parámetros. Sustituye a 12 copias de
// estas consultas que estaban repartidas por los services de nómina y turnos.
jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));

const { pool } = require('../config/database');
const NotificacionesModel = require('../modules/notificaciones/notificaciones.model');

const sql = () => pool.query.mock.calls[0][0].replace(/\s+/g, ' ').trim();
const params = () => pool.query.mock.calls[0][1];

beforeEach(() => pool.query.mockReset().mockResolvedValue([[{ id: 3 }, { id: 8 }]]));

test('idsGestoresNomina: jefe_nomina, admin_empresa y nomina activos de la empresa', async () => {
  await expect(NotificacionesModel.idsGestoresNomina(7)).resolves.toEqual([3, 8]);
  expect(sql()).toBe("SELECT id FROM usuarios WHERE empresa_id = ? AND rol IN ('jefe_nomina','admin_empresa','nomina') AND activo = 1");
  expect(params()).toEqual([7]);
});

test('idsTrabajadoresNomina: usuario_id de los trabajador_nomina activos con ficha activa', async () => {
  pool.query.mockResolvedValue([[{ usuario_id: 101 }, { usuario_id: 102 }]]);
  await expect(NotificacionesModel.idsTrabajadoresNomina(7)).resolves.toEqual([101, 102]);
  expect(sql()).toBe("SELECT u.id AS usuario_id FROM trabajadores t JOIN usuarios u ON u.id = t.usuario_id WHERE t.empresa_id = ? AND t.activo = 1 AND u.rol = 'trabajador_nomina' AND u.activo = 1");
  expect(params()).toEqual([7]);
});

test('idsGestoresTurnos: jefe_turnos y admin_empresa activos de la empresa', async () => {
  await expect(NotificacionesModel.idsGestoresTurnos(7)).resolves.toEqual([3, 8]);
  expect(sql()).toBe("SELECT id FROM usuarios WHERE empresa_id = ? AND rol IN ('jefe_turnos','admin_empresa') AND activo = 1");
  expect(params()).toEqual([7]);
});

test('idsCoGestoresTurnos: excluye a quien creó el turno', async () => {
  await expect(NotificacionesModel.idsCoGestoresTurnos(7, 3)).resolves.toEqual([3, 8]);
  expect(sql()).toBe("SELECT id FROM usuarios WHERE empresa_id = ? AND rol IN ('jefe_turnos','admin_empresa') AND activo = 1 AND id != ?");
  expect(params()).toEqual([7, 3]);
});

test('sin gestores devuelve lista vacía', async () => {
  pool.query.mockResolvedValue([[]]);
  await expect(NotificacionesModel.idsGestoresNomina(7)).resolves.toEqual([]);
});
