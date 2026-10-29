'use strict';

// Test de caracterización: congela QUÉ SQL ejecuta wompi.service y con qué
// parámetros, simulando solo el borde (pool.query). No depende de si el SQL
// vive en el service o en un model, así que sirve para refactorizar sin miedo.
jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../utils/mailer', () => ({ enviarEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../utils/facturaPdf', () => ({ generarFacturaPdf: jest.fn().mockResolvedValue(Buffer.from('pdf')) }));
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificarVarios: jest.fn().mockResolvedValue(undefined),
  notificarSuperAdmins: jest.fn().mockResolvedValue(undefined),
}));

const crypto = require('crypto');
const { pool } = require('../config/database');
const Notificaciones = require('../modules/notificaciones/notificaciones.service');
const { enviarEmail } = require('../utils/mailer');

process.env.WOMPI_EVENTS_SECRET = 'secreto-test';
process.env.WOMPI_PRIVATE_KEY = 'llave-test';
const WompiService = require('../modules/webhooks/wompi.service');

/** Evento firmado como lo haría Wompi. */
function evento({ status = 'APPROVED', reference = 'AT-7-profesional-3', id = 'tx-1', tipo = 'transaction.updated' } = {}) {
  const payload = {
    event: tipo,
    timestamp: 1700000000,
    data: { transaction: { id, status, reference, amount_in_cents: 50800000 } },
    signature: { properties: ['data.transaction.id', 'data.transaction.status'] },
  };
  const toHash = `${id}${status}` + payload.timestamp + process.env.WOMPI_EVENTS_SECRET;
  payload.signature.checksum = crypto.createHash('sha256').update(toHash).digest('hex');
  return payload;
}

/**
 * Responde según el contenido del SQL. `respuestas` es [regex, valor] en orden de
 * prioridad; si algún valor es un Error, se rechaza con él.
 */
function simularDb(respuestas = []) {
  pool.query.mockImplementation(async (sql) => {
    for (const [re, valor] of respuestas) {
      if (re.test(sql)) {
        if (valor instanceof Error) throw valor;
        return valor;
      }
    }
    return [{ affectedRows: 1 }];
  });
}

/** [fragmento reconocible del SQL, params] de cada llamada, en orden. */
const sqls = () => pool.query.mock.calls.map(([sql, params]) => [sql.replace(/\s+/g, ' ').trim(), params]);
const contiene = (frag) => expect.stringContaining(frag);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('WompiService.procesarEvento', () => {
  test('APPROVED: guarda el evento, activa la suscripción, lo marca procesado y busca correo para la factura', async () => {
    simularDb([
      [/INSERT IGNORE INTO wompi_eventos/, [{ affectedRows: 1, insertId: 42 }]],
      [/FROM empresas e\s+LEFT JOIN usuarios/, [[{ nombre: 'ACME', nit: '1', email: null }]]],
    ]);

    const r = await WompiService.procesarEvento(evento());

    expect(r).toEqual({ ok: true, empresaId: 7, plan: 'profesional', meses: 3 });
    const q = sqls();
    expect(q).toHaveLength(4);
    expect(q[0][0]).toContain('INSERT IGNORE INTO wompi_eventos');
    expect(q[0][1].slice(0, 5)).toEqual(['tx-1', 'AT-7-profesional-3', 7, 'profesional', 3]);
    expect(q[1][0]).toContain('UPDATE empresas SET plan = ?');
    expect(q[1][0]).toContain("suscripcion_origen = 'wompi'");
    expect(q[1][0]).toContain('WHERE id = ? AND activo = 1');
    expect(q[1][1]).toEqual(['profesional', 3, 169333, 3, 7]); // valor/mes y modalidad guardados para el prorrateo
    expect(q[2][0]).toContain("SET estado = 'procesado', procesado_at = NOW(), intentos = intentos + 1");
    expect(q[2][1]).toEqual([42]);
    expect(q[3][0]).toContain('FROM empresas e LEFT JOIN usuarios u');
    expect(q[3][1]).toEqual([7]);
    expect(enviarEmail).not.toHaveBeenCalled(); // sin correo: factura no enviada, pero la suscripción ya quedó activa
  });

  test('APPROVED con correo: envía la factura al correo de la empresa', async () => {
    simularDb([
      [/INSERT IGNORE INTO wompi_eventos/, [{ affectedRows: 1, insertId: 42 }]],
      [/FROM empresas e\s+LEFT JOIN usuarios/, [[{ nombre: 'ACME', nit: '1', email: 'a@acme.co' }]]],
    ]);
    await WompiService.procesarEvento(evento());
    expect(enviarEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'a@acme.co' }));
  });

  test('duplicado: no vuelve a activar nada', async () => {
    simularDb([[/INSERT IGNORE INTO wompi_eventos/, [{ affectedRows: 0, insertId: 0 }]]]);
    const r = await WompiService.procesarEvento(evento());
    expect(r).toEqual({ ok: true, razon: 'duplicado' });
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test('si falla el UPDATE de empresas: marca el evento en error (el worker reintenta) y devuelve error_db', async () => {
    simularDb([
      [/INSERT IGNORE INTO wompi_eventos/, [{ affectedRows: 1, insertId: 42 }]],
      [/UPDATE empresas/, new Error('deadlock')],
    ]);
    const r = await WompiService.procesarEvento(evento());
    expect(r).toEqual({ ok: false, razon: 'error_db' });
    const q = sqls();
    expect(q[q.length - 1][0]).toContain("SET estado = 'error', intentos = intentos + 1, error_detalle = ?");
    expect(q[q.length - 1][1]).toEqual(['deadlock', 42]);
  });

  test('DECLINED: marca rechazado y notifica a admins de la empresa y a super_admins', async () => {
    simularDb([
      [/INSERT IGNORE INTO wompi_eventos/, [{ affectedRows: 1, insertId: 43 }]],
      [/rol = 'admin_empresa' AND activo = 1/, [[{ id: 11 }, { id: 12 }]]],
      [/SELECT nombre FROM empresas/, [[{ nombre: 'ACME' }]]],
    ]);
    const r = await WompiService.procesarEvento(evento({ status: 'DECLINED', id: 'tx-2' }));

    expect(r).toEqual({ ok: true, razon: 'rechazado' });
    const q = sqls();
    expect(q[1]).toEqual([contiene("SET estado = 'rechazado' WHERE id = ?"), [43]]);
    expect(q[2]).toEqual([contiene("SELECT id FROM usuarios WHERE empresa_id = ? AND rol = 'admin_empresa' AND activo = 1"), [7]]);
    expect(q[3]).toEqual([contiene('SELECT nombre FROM empresas WHERE id = ?'), [7]]);
    expect(Notificaciones.notificarVarios).toHaveBeenCalledWith([11, 12], expect.objectContaining({ empresaId: 7, tipo: 'suscripcion.pago_rechazado' }));
    expect(Notificaciones.notificarSuperAdmins).toHaveBeenCalledWith(expect.objectContaining({ mensaje: expect.stringContaining('ACME') }));
  });

  test('DECLINED sin admins: no llama notificarVarios pero sí avisa a super_admins', async () => {
    simularDb([
      [/INSERT IGNORE INTO wompi_eventos/, [{ affectedRows: 1, insertId: 44 }]],
      [/rol = 'admin_empresa' AND activo = 1/, [[]]],
      [/SELECT nombre FROM empresas/, [[]]],
    ]);
    await WompiService.procesarEvento(evento({ status: 'ERROR', id: 'tx-3' }));
    expect(Notificaciones.notificarVarios).not.toHaveBeenCalled();
    expect(Notificaciones.notificarSuperAdmins).toHaveBeenCalledWith(expect.objectContaining({ mensaje: expect.stringContaining('Una empresa') }));
  });

  test('referencia no parseable: el evento queda ignorado', async () => {
    simularDb([[/INSERT IGNORE INTO wompi_eventos/, [{ affectedRows: 1, insertId: 45 }]]]);
    const r = await WompiService.procesarEvento(evento({ reference: 'otra-cosa', id: 'tx-4' }));
    expect(r).toEqual({ ok: true, razon: 'ignorado' });
    expect(sqls()[1]).toEqual([contiene("SET estado = 'ignorado' WHERE id = ?"), [45]]);
  });
});

describe('WompiService.reintentarEvento / procesarPendientes', () => {
  const fila = { id: 9, empresa_id: 7, plan: 'basico', meses: 1, payload: JSON.stringify({ data: { transaction: { amount_in_cents: 12900000 } } }) };

  test('reintentarEvento: evento inexistente o fuera de estado error lanza', async () => {
    simularDb([[/FROM wompi_eventos WHERE id = \? AND estado = 'error'/, [[]]]]);
    await expect(WompiService.reintentarEvento(9)).rejects.toThrow('Evento no encontrado o no esta en estado error');
    expect(sqls()[0][1]).toEqual([9]);
  });

  test('reintentarEvento: sin empresa_id exige reconciliación manual', async () => {
    simularDb([[/FROM wompi_eventos WHERE id = \?/, [[{ ...fila, empresa_id: null }]]]]);
    await expect(WompiService.reintentarEvento(9)).rejects.toThrow('reconciliacion manual');
  });

  test('reintentarEvento: reactiva la suscripción con los datos guardados', async () => {
    simularDb([
      [/FROM wompi_eventos WHERE id = \?/, [[fila]]],
      [/FROM empresas e\s+LEFT JOIN usuarios/, [[{}]]],
    ]);
    await expect(WompiService.reintentarEvento(9)).resolves.toEqual({ ok: true, empresaId: 7, plan: 'basico', meses: 1 });
    expect(sqls()[1][1]).toEqual(['basico', 1, 129000, 1, 7]);
  });

  test('procesarPendientes: lee eventos en error con <3 intentos; uno falla y otro pasa', async () => {
    simularDb([
      [/FROM wompi_eventos\s+WHERE estado = 'error' AND intentos < 3/, [[fila, { ...fila, id: 10 }]]],
      [/FROM empresas e\s+LEFT JOIN usuarios/, [[{}]]],
    ]);
    // el primer UPDATE empresas falla, el segundo pasa
    let n = 0;
    const base = pool.query.getMockImplementation();
    pool.query.mockImplementation(async (sql, p) => {
      if (/UPDATE empresas/.test(sql) && n++ === 0) throw new Error('boom');
      return base(sql, p);
    });

    await expect(WompiService.procesarPendientes()).resolves.toBe(1);
    expect(sqls()[0][0]).toContain("estado = 'error' AND intentos < 3 AND empresa_id IS NOT NULL");
    expect(sqls().some(([s, p]) => s.includes("estado = 'error', intentos = intentos + 1") && p[0] === 'boom' && p[1] === 9)).toBe(true);
  });
});

describe('WompiService.generarLinkPago', () => {
  const planes = [
    { codigo: 'basico', orden: 1, max_trabajadores: 10, precio_cop: 129000, incluidos: null, precio_adicional_cop: null },
    { codigo: 'profesional', orden: 2, max_trabajadores: 30, precio_cop: 169000, incluidos: null, precio_adicional_cop: null },
    { codigo: 'empresarial', orden: 3, max_trabajadores: null, precio_cop: 299000, incluidos: 80, precio_adicional_cop: 3500 },
  ];

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { id: 'lnk123' } }) });
  });

  test('renovar sin plan: con 12 activos y plan basico sube al mínimo que los admite (profesional)', async () => {
    simularDb([
      [/AS activos/, [[{ activos: 12, plan_actual: 'basico' }]]],
      [/FROM planes ORDER BY orden/, [planes]],
    ]);
    const r = await WompiService.generarLinkPago({ empresaId: 7, nombreEmpresa: 'ACME', meses: 2 });

    expect(sqls()[0][0]).toContain('SELECT COUNT(*) FROM trabajadores WHERE empresa_id = e.id AND activo = 1');
    expect(sqls()[0][1]).toEqual([7]);
    expect(r).toMatchObject({ plan: 'profesional', monto_cop: 338000, referencia: 'AT-7-profesional-2', url: 'https://checkout.wompi.co/l/lnk123' });
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).amount_in_cents).toBe(33800000);
  });

  test('nunca baja de plan: empresa en empresarial con pocos activos renueva empresarial', async () => {
    simularDb([
      [/AS activos/, [[{ activos: 3, plan_actual: 'empresarial' }]]],
      [/FROM planes ORDER BY orden/, [planes]],
    ]);
    const r = await WompiService.generarLinkPago({ empresaId: 7, nombreEmpresa: 'ACME' });
    expect(r.plan).toBe('empresarial');
    expect(r.monto_cop).toBe(299000);
  });

  test('sin WOMPI_PRIVATE_KEY lanza antes de tocar la base', async () => {
    const k = process.env.WOMPI_PRIVATE_KEY;
    delete process.env.WOMPI_PRIVATE_KEY;
    await expect(WompiService.generarLinkPago({ empresaId: 7, nombreEmpresa: 'x' })).rejects.toThrow('WOMPI_PRIVATE_KEY no configurada');
    expect(pool.query).not.toHaveBeenCalled();
    process.env.WOMPI_PRIVATE_KEY = k;
  });
});
