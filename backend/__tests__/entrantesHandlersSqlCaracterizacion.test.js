'use strict';

// Caracterización del SQL de entrantes.handlers.js (eventos entrantes de logiq360) ANTES
// de sacarlo a un model. Simula solo el borde (pool) y deja que el SQL, sus parámetros y
// el ORDEN con el resto de colaboradores se congelen — vale igual si el SQL vive en el
// handler o en un model. Cubre además el cache de cargos de sistema, que es estado del módulo.
jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../modules/turnos/ofertas/ofertas.model');
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/integracion/integracion.model');
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificarVarios: jest.fn(),
  notificarSuperAdmins: jest.fn(),
}));
jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

let log;
let respuestas; // [regex, valor | función]
let pool, OfertasModel, IntegracionModel, Notificaciones, logger, procesar;

const sql = (s) => s.replace(/\s+/g, ' ').trim();

beforeEach(() => {
  jest.resetModules(); // reinicia también el cache de cargos de sistema del handler
  log = [];
  respuestas = [];
  ({ pool } = require('../config/database'));
  OfertasModel = require('../modules/turnos/ofertas/ofertas.model');
  IntegracionModel = require('../modules/integracion/integracion.model');
  Notificaciones = require('../modules/notificaciones/notificaciones.service');
  logger = require('../utils/logger');
  ({ procesar } = require('../modules/integracion/entrantes.handlers'));

  pool.query.mockImplementation(async (texto, params) => {
    log.push(['sql', sql(texto), params]);
    for (const [re, valor] of respuestas) {
      if (re.test(texto)) return typeof valor === 'function' ? valor(texto, params) : valor;
    }
    return [[]];
  });
  OfertasModel.obtenerPorExternalRef.mockImplementation(async (...a) => { log.push(['ofertas.obtenerPorExternalRef', ...a]); return null; });
  OfertasModel.crear.mockImplementation(async (...a) => { log.push(['ofertas.crear', ...a]); });
  IntegracionModel.actualizarActivo.mockImplementation(async (...a) => { log.push(['integracion.actualizarActivo', ...a]); });
  Notificaciones.notificarVarios.mockImplementation(async (...a) => { log.push(['notificarVarios', ...a]); });
  Notificaciones.notificarSuperAdmins.mockImplementation(async (...a) => { log.push(['notificarSuperAdmins', ...a]); });
});

const SQL_CARGO = 'SELECT id FROM cargos WHERE empresa_id IS NULL AND codigo = ? LIMIT 1';
const SQL_EMPRESA_LIMIT = 'SELECT nombre FROM empresas WHERE id = ? LIMIT 1';
const SQL_ADMINS = "SELECT id AS usuario_id FROM usuarios WHERE empresa_id = ? AND rol = 'admin_empresa' AND activo = 1";
const SQL_PUESTO = 'SELECT id FROM oferta_puestos WHERE oferta_id = ? AND cargo_id = ? ORDER BY id LIMIT 1';
const sqlLog = () => log.filter((l) => l[0] === 'sql').map((l) => l.slice(1));

describe('cargo de sistema (orden.creada)', () => {
  const datos = { external_ref: 'lq:1', cupos_gig: 2, cupos_custodio: 1 };

  test('consulta cada cargo una vez, en orden auxiliar → custodio, y los pasa a los puestos', async () => {
    respuestas = [[/FROM cargos/, (_t, p) => [[{ id: p[0] === 'auxiliar' ? 101 : 102 }]]]];
    await procesar('orden.creada', 7, datos);

    expect(sqlLog()).toEqual([[SQL_CARGO, ['auxiliar']], [SQL_CARGO, ['custodio']]]);
    const crear = log.find((l) => l[0] === 'ofertas.crear');
    expect(crear[2].puestos.map((p) => p.cargo_id)).toEqual([101, 102]);
    expect(log.map((l) => l[0])).toEqual(['ofertas.obtenerPorExternalRef', 'sql', 'sql', 'ofertas.crear']);
  });

  test('el id queda en cache: una segunda orden no vuelve a consultar los cargos', async () => {
    respuestas = [[/FROM cargos/, [[{ id: 101 }]]]];
    await procesar('orden.creada', 7, { external_ref: 'a', cupos_gig: 1 });
    await procesar('orden.creada', 7, { external_ref: 'b', cupos_gig: 3 });
    expect(sqlLog()).toEqual([[SQL_CARGO, ['auxiliar']]]);
  });

  test('cargo inexistente → Error con el código, y NO se cachea (el siguiente intento vuelve a consultar)', async () => {
    await expect(procesar('orden.creada', 7, { external_ref: 'a', cupos_gig: 1 }))
      .rejects.toThrow("Cargo de sistema 'auxiliar' no encontrado (¿faltó la migración que lo crea?)");
    expect(OfertasModel.crear).not.toHaveBeenCalled();

    respuestas = [[/FROM cargos/, [[{ id: 101 }]]]];
    await procesar('orden.creada', 7, { external_ref: 'a', cupos_gig: 1 });
    expect(sqlLog().filter(([s]) => s === SQL_CARGO)).toHaveLength(2);
    expect(OfertasModel.crear).toHaveBeenCalledTimes(1);
  });

  test('sin cupos no consulta ningún cargo', async () => {
    await procesar('orden.creada', 7, { external_ref: 'a' });
    expect(sqlLog()).toEqual([]);
    expect(log.find((l) => l[0] === 'ofertas.crear')[2].puestos).toEqual([]);
  });
});

describe('orden.creada — nombre de la empresa en la descripción', () => {
  const datos = { external_ref: 'a', productos_resumen: [{ cantidad: 2, nombre: 'Carpa' }, { cantidad: 1, nombre: 'Silla' }] };

  test('consulta la empresa (antes de los cargos) y la nombra entre paréntesis', async () => {
    respuestas = [[/FROM empresas/, [[{ nombre: 'Eventos SAS' }]]]];
    await procesar('orden.creada', 7, datos);
    expect(sqlLog()).toEqual([[SQL_EMPRESA_LIMIT, [7]]]);
    expect(log.find((l) => l[0] === 'ofertas.crear')[2].descripcion).toBe('2× Carpa, 1× Silla (Eventos SAS)');
  });

  test('empresa sin fila → "logiq360"', async () => {
    await procesar('orden.creada', 7, datos);
    expect(log.find((l) => l[0] === 'ofertas.crear')[2].descripcion).toBe('2× Carpa, 1× Silla (logiq360)');
  });

  test('sin productos no consulta la empresa; descripción null', async () => {
    await procesar('orden.creada', 7, { external_ref: 'a', productos_resumen: [] });
    expect(sqlLog()).toEqual([]);
    expect(log.find((l) => l[0] === 'ofertas.crear')[2].descripcion).toBeNull();
  });

  test('orden ya creada: idempotente, no consulta nada', async () => {
    OfertasModel.obtenerPorExternalRef.mockResolvedValue({ id: 1 });
    await procesar('orden.creada', 7, datos);
    expect(sqlLog()).toEqual([]);
    expect(OfertasModel.crear).not.toHaveBeenCalled();
  });
});

describe('orden.cupos_actualizados — upsert de puestos', () => {
  const oferta = { id: 50 };
  beforeEach(() => {
    OfertasModel.obtenerPorExternalRef.mockImplementation(async () => oferta);
    respuestas = [[/FROM cargos/, (_t, p) => [[{ id: p[0] === 'auxiliar' ? 101 : 102 }]]]];
  });
  const puestoExistente = (id) => [/FROM oferta_puestos/, [[{ id }]]];

  test('puesto existente + tarifa: UPDATE de plazas y tarifa_dia', async () => {
    respuestas.push(puestoExistente(9));
    await procesar('orden.cupos_actualizados', 7, { external_ref: 'x', cupos_gig: 4, valor_dia_sugerido: 90000 });
    expect(sqlLog()).toEqual([
      [SQL_CARGO, ['auxiliar']],
      [SQL_PUESTO, [50, 101]],
      ['UPDATE oferta_puestos SET plazas = ?, tarifa_dia = ? WHERE id = ?', [4, 90000, 9]],
    ]);
  });

  test.each([[undefined], [null]])('puesto existente sin tarifa (%s): UPDATE solo de plazas', async (tarifa) => {
    respuestas.push(puestoExistente(9));
    await procesar('orden.cupos_actualizados', 7, { external_ref: 'x', cupos_gig: 4, valor_dia_sugerido: tarifa });
    expect(sqlLog().at(-1)).toEqual(['UPDATE oferta_puestos SET plazas = ? WHERE id = ?', [4, 9]]);
  });

  test('tarifa 0 SÍ se actualiza (solo null/undefined se omiten); plazas 0 también se escribe', async () => {
    respuestas.push(puestoExistente(9));
    await procesar('orden.cupos_actualizados', 7, { external_ref: 'x', cupos_gig: 0, valor_dia_sugerido: 0 });
    expect(sqlLog().at(-1)).toEqual(['UPDATE oferta_puestos SET plazas = ?, tarifa_dia = ? WHERE id = ?', [0, 0, 9]]);
  });

  test('sin puesto y plazas > 0: INSERT con tarifa (o 0 si no viene)', async () => {
    await procesar('orden.cupos_actualizados', 7, { external_ref: 'x', cupos_gig: 3, valor_dia_sugerido: 80000 });
    expect(sqlLog().at(-1)).toEqual(['INSERT INTO oferta_puestos (oferta_id, cargo_id, plazas, tarifa_dia) VALUES (?, ?, ?, ?)', [50, 101, 3, 80000]]);

    log.length = 0;
    await procesar('orden.cupos_actualizados', 7, { external_ref: 'x', cupos_gig: 3 });
    expect(sqlLog().at(-1)).toEqual(['INSERT INTO oferta_puestos (oferta_id, cargo_id, plazas, tarifa_dia) VALUES (?, ?, ?, ?)', [50, 101, 3, 0]]);
  });

  test('sin puesto y plazas 0: no inserta nada', async () => {
    await procesar('orden.cupos_actualizados', 7, { external_ref: 'x', cupos_gig: 0 });
    expect(sqlLog().map(([s]) => s.split(' ')[0])).toEqual(['SELECT', 'SELECT']); // cargo + puesto
  });

  test('gig y custodio: cada cargo con su propio puesto, en ese orden; solo lo que viene en el payload', async () => {
    respuestas.push(puestoExistente(9));
    await procesar('orden.cupos_actualizados', 7, { external_ref: 'x', cupos_sugeridos: 2, cupos_custodio: 1, valor_dia_custodio: 120000 });
    expect(sqlLog()).toEqual([
      [SQL_CARGO, ['auxiliar']],
      [SQL_PUESTO, [50, 101]],
      ['UPDATE oferta_puestos SET plazas = ? WHERE id = ?', [2, 9]],
      [SQL_CARGO, ['custodio']],
      [SQL_PUESTO, [50, 102]],
      ['UPDATE oferta_puestos SET plazas = ?, tarifa_dia = ? WHERE id = ?', [1, 120000, 9]],
    ]);

    log.length = 0;
    await procesar('orden.cupos_actualizados', 7, { external_ref: 'x' });
    expect(sqlLog()).toEqual([]);
  });

  test('oferta externa inexistente: avisa y no consulta nada', async () => {
    OfertasModel.obtenerPorExternalRef.mockImplementation(async () => null);
    await procesar('orden.cupos_actualizados', 7, { external_ref: 'x', cupos_gig: 1 });
    expect(sqlLog()).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith('[integracion] orden.cupos_actualizados: oferta externa no encontrada (x)');
  });
});

describe('integracion.activada / desactivada', () => {
  const admins = [/FROM usuarios/, [[{ usuario_id: 42 }, { usuario_id: 43 }]]];

  test('activada: actualiza activo ANTES de buscar admins y los avisa', async () => {
    respuestas = [admins];
    await procesar('integracion.activada', 7, {});
    expect(log.map((l) => l[0])).toEqual(['integracion.actualizarActivo', 'sql', 'notificarVarios']);
    expect(log[0].slice(1)).toEqual([7, true]);
    expect(sqlLog()).toEqual([[SQL_ADMINS, [7]]]);
    expect(log[2][1]).toEqual([42, 43]);
    expect(log[2][2]).toMatchObject({ empresaId: 7, tipo: 'integracion.activada' });
  });

  test('activada sin admins: no notifica', async () => {
    await procesar('integracion.activada', 7, {});
    expect(Notificaciones.notificarVarios).not.toHaveBeenCalled();
  });

  test('desactivada: orden actualizarActivo → admins → avisa admins → nombre de empresa → avisa super_admins', async () => {
    respuestas = [admins, [/FROM empresas/, [[{ nombre: 'Eventos SAS' }]]]];
    await procesar('integracion.desactivada', 7, {});
    expect(log.map((l) => l[0])).toEqual(['integracion.actualizarActivo', 'sql', 'notificarVarios', 'sql', 'notificarSuperAdmins']);
    expect(log[0].slice(1)).toEqual([7, false]);
    expect(sqlLog()[0]).toEqual([SQL_ADMINS, [7]]);
    expect(sqlLog()[1][1]).toEqual([7]);
    // el LIMIT 1 es opcional a propósito: empresas.id es clave primaria, da lo mismo
    expect(sqlLog()[1][0]).toMatch(/^SELECT nombre FROM empresas WHERE id = \?( LIMIT 1)?$/);
    expect(log[4][1]).toMatchObject({
      empresaId: 7, tipo: 'integracion.desactivada',
      mensaje: 'Eventos SAS se desconectó de logiq360 — deja de ser gratis, 3 días de gracia.',
      data: { empresa_id: 7 },
    });
  });

  test('desactivada sin admins ni nombre: igual avisa a super_admins con texto genérico', async () => {
    await procesar('integracion.desactivada', 7, {});
    expect(Notificaciones.notificarVarios).not.toHaveBeenCalled();
    expect(Notificaciones.notificarSuperAdmins.mock.calls[0][0].mensaje).toBe('Una empresa se desconectó de logiq360 — deja de ser gratis, 3 días de gracia.');
  });

  test('si avisar a super_admins falla: se registra y el evento NO falla', async () => {
    Notificaciones.notificarSuperAdmins.mockRejectedValue(new Error('push caído'));
    await expect(procesar('integracion.desactivada', 7, {})).resolves.toBe(true);
    expect(logger.error).toHaveBeenCalledWith('[integracion] no se pudo notificar desconexión a super_admin (empresa 7):', 'push caído');
  });
});
