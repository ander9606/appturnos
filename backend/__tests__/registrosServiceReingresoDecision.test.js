'use strict';

// Test de caracterización: cuando un gestor aprueba o rechaza un reingreso, el trabajador recibe el aviso.
// Usa el model REAL de solicitudes y simula solo el borde (pool), así que vale igual si la consulta del
// trabajador de la solicitud vive en el service o en el model.
jest.mock('../config/database', () => {
  const llamadas = [];
  let respuestas = [];
  const ejecutar = async (sql, params) => {
    sql = sql.replace(/\s+/g, ' ').trim();
    llamadas.push([sql, params]);
    for (const [re, valor] of respuestas) if (re.test(sql)) return valor;
    return [[]];
  };
  return { pool: { query: ejecutar, execute: ejecutar }, __llamadas: llamadas, __responder: (r) => { respuestas = r; } };
});
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificar: jest.fn().mockResolvedValue(undefined),
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const { __llamadas: llamadas, __responder: responder } = require('../config/database');
const Notificaciones = require('../modules/notificaciones/notificaciones.service');
const RegistrosService = require('../modules/nomina/registros/registros.service');

const EMPRESA = 1;
const GESTOR = 10;
const SOLICITUD = 55;
const SELECT_SOL = 'SELECT sr.*, t.usuario_id FROM solicitudes_reingreso sr JOIN trabajadores t ON t.id = sr.trabajador_id WHERE sr.id = ?';

const actualiza = (n) => [/^UPDATE solicitudes_reingreso/, [{ affectedRows: n }]];
const solicitudDe = (usuarioId) => [/^SELECT sr\.\*, t\.usuario_id/, [[{ id: SOLICITUD, trabajador_id: 5, usuario_id: usuarioId }]]];

beforeEach(() => {
  llamadas.length = 0;
  jest.clearAllMocks();
});

test('aprobar: marca la solicitud como aprobada (solo si está pendiente y es de la empresa) y avisa al trabajador', async () => {
  responder([actualiza(1), solicitudDe(42)]);

  await RegistrosService.aprobarReingreso(EMPRESA, GESTOR, SOLICITUD);

  expect(llamadas[0][0]).toContain("SET estado = 'aprobado', aprobado_por = ?, aprobado_at = NOW() WHERE id = ? AND empresa_id = ? AND estado = 'pendiente'");
  expect(llamadas[0][1]).toEqual([GESTOR, SOLICITUD, EMPRESA]);
  expect(llamadas[1]).toEqual([SELECT_SOL, [SOLICITUD]]);
  expect(Notificaciones.notificar).toHaveBeenCalledWith({
    empresaId: EMPRESA, usuarioId: 42, tipo: 'reingreso.aprobado', titulo: 'Reingreso aprobado',
    mensaje: 'Tu solicitud de reingreso fue aprobada. Ya puedes marcar tu entrada.',
    data: { solicitud_id: SOLICITUD },
  });
});

test('rechazar: marca la solicitud como rechazada y avisa al trabajador', async () => {
  responder([actualiza(1), solicitudDe(42)]);

  await RegistrosService.rechazarReingreso(EMPRESA, GESTOR, SOLICITUD);

  expect(llamadas[0][0]).toContain("SET estado = 'rechazado', aprobado_por = ?, aprobado_at = NOW() WHERE id = ? AND empresa_id = ? AND estado = 'pendiente'");
  expect(llamadas[0][1]).toEqual([GESTOR, SOLICITUD, EMPRESA]);
  expect(Notificaciones.notificar).toHaveBeenCalledWith(expect.objectContaining({
    usuarioId: 42, tipo: 'reingreso.rechazado', titulo: 'Reingreso no autorizado',
  }));
});

test.each([['aprobarReingreso'], ['rechazarReingreso']])('%s: solicitud inexistente, ya procesada o de otra empresa → 404, sin leer al trabajador ni avisar', async (metodo) => {
  responder([actualiza(0)]);

  await expect(RegistrosService[metodo](EMPRESA, GESTOR, SOLICITUD)).rejects.toMatchObject({ statusCode: 404 });

  expect(llamadas).toHaveLength(1); // solo el UPDATE
  expect(Notificaciones.notificar).not.toHaveBeenCalled();
});

test('trabajador sin cuenta (usuario_id nulo): la decisión se guarda pero no hay a quién avisar', async () => {
  responder([actualiza(1), solicitudDe(null)]);

  await expect(RegistrosService.aprobarReingreso(EMPRESA, GESTOR, SOLICITUD)).resolves.toBeUndefined();
  expect(Notificaciones.notificar).not.toHaveBeenCalled();
});

test('solicitud que ya no se encuentra al leerla: no avisa y no falla', async () => {
  responder([actualiza(1)]); // el SELECT devuelve vacío

  await expect(RegistrosService.rechazarReingreso(EMPRESA, GESTOR, SOLICITUD)).resolves.toBeUndefined();
  expect(Notificaciones.notificar).not.toHaveBeenCalled();
});
