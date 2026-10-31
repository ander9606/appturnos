'use strict';

// Caracterización de los 4 middlewares que consultan la base directamente
// (verificarSuscripcion, verificarApiKeyLogiq360, verificarFirmaLogiq360 y
// resolverEmpresasActivas) ANTES de sacarles el SQL a los models. Corren en CADA
// petición, así que se congela todo: SQL, parámetros, qué se pasa a next(), qué se
// inyecta en req y qué pasa cuando la base falla. Simula solo el borde (pool) y usa los
// models reales, así que vale igual si el SQL vive en el middleware o en un model.
jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

process.env.JWT_SECRET = 'secreto-test';

const { pool } = require('../config/database');
const logger = require('../utils/logger');
const { firmar } = require('../utils/hmac');
const verificarSuscripcion = require('../middleware/verificarSuscripcion');
const { verificarApiKeyLogiq360 } = require('../middleware/verificarApiKeyLogiq360');
const { verificarFirmaLogiq360 } = require('../middleware/verificarFirmaLogiq360');
const { resolverEmpresasActivas } = require('../middleware/authMiddleware');

const sql = (s) => s.replace(/\s+/g, ' ').trim();
let llamadas;
let respuestas; // [regex, valor | Error]
const responder = (...pares) => { respuestas = pares; };

beforeEach(() => {
  llamadas = [];
  respuestas = [];
  delete process.env.LOGIQ360_WEBHOOK_SECRET;
  jest.clearAllMocks();
  pool.query.mockImplementation(async (texto, params) => {
    llamadas.push([sql(texto), params]);
    for (const [re, valor] of respuestas) {
      if (re.test(texto)) {
        if (valor instanceof Error) throw valor;
        return valor;
      }
    }
    return [[]];
  });
});

const errorDe = (next) => next.mock.calls[0][0];

// ── verificarSuscripcion ─────────────────────────────────────────────────────

describe('verificarSuscripcion', () => {
  const AHORA = new Date('2026-06-15T12:00:00Z');
  const SQL_CONEXION = 'SELECT activo, api_key FROM integracion_config WHERE empresa_id = ? LIMIT 1';
  const SQL_VIGENCIA = 'SELECT suscripcion_vigente_hasta FROM empresas WHERE id = ? AND activo = 1 LIMIT 1';
  const req = { usuario: { empresa_id: 3 } };
  const correr = async (...args) => { const next = jest.fn(); await verificarSuscripcion(args[0] ?? req, {}, next); return next; };
  const vigencia = (fecha) => [/FROM empresas/, [[{ suscripcion_vigente_hasta: fecha }]]];
  const conectada = [/FROM integracion_config/, [[{ activo: 1, api_key: 'k' }]]];

  beforeEach(() => { jest.useFakeTimers().setSystemTime(AHORA); });
  afterEach(() => jest.useRealTimers());

  test('conectada a logiq360 (activo + api_key): pasa sin mirar el vencimiento', async () => {
    responder(conectada);
    const next = await correr();
    expect(next).toHaveBeenCalledWith();
    expect(llamadas).toEqual([[SQL_CONEXION, [3]]]);
  });

  test.each([
    ['activo = 0', { activo: 0, api_key: 'k' }],
    ['sin api_key', { activo: 1, api_key: null }],
  ])('integración %s: no cuenta como conectada y se revisa el vencimiento', async (_n, fila) => {
    responder([/FROM integracion_config/, [[fila]]], vigencia(null));
    const next = await correr();
    expect(next).toHaveBeenCalledWith();
    expect(llamadas.map(([s]) => s)).toEqual([SQL_CONEXION, SQL_VIGENCIA]);
    expect(llamadas[1][1]).toEqual([3]);
  });

  test('empresa inexistente o inactiva → 404', async () => {
    const next = await correr();
    expect(errorDe(next)).toMatchObject({ statusCode: 404, message: 'Empresa no encontrada' });
  });

  test('suscripción indefinida (NULL, admin manual) → pasa', async () => {
    responder(vigencia(null));
    expect(await correr()).toHaveBeenCalledWith();
  });

  test.each([
    ['vigente hasta mañana', new Date('2026-06-16T00:00:00Z'), true],
    ['venció ayer (dentro de la gracia)', new Date('2026-06-14T00:00:00Z'), true],
    ['venció hace 2 días (fin de la gracia de 2 días)', new Date('2026-06-13T00:00:00Z'), false],
    ['venció hace 5 días (fuera de la gracia)', new Date('2026-06-10T00:00:00Z'), false],
    ['venció en 2020', '2020-01-01', false],
  ])('%s', async (_n, fecha, pasa) => {
    responder(vigencia(fecha));
    const next = await correr();
    if (pasa) expect(next).toHaveBeenCalledWith();
    else expect(errorDe(next)).toMatchObject({ statusCode: 402, message: 'Suscripción vencida. Renueva tu plan para continuar.' });
  });

  test('si falla la consulta de conexión o la de vigencia: next(error), nunca pasa', async () => {
    const boom = new Error('db caída');
    responder([/FROM integracion_config/, boom]);
    expect(errorDe(await correr())).toBe(boom);

    responder([/FROM integracion_config/, [[]]], [/FROM empresas/, boom]);
    expect(errorDe(await correr())).toBe(boom);
  });
});

// ── verificarApiKeyLogiq360 ──────────────────────────────────────────────────

describe('verificarApiKeyLogiq360', () => {
  const correr = async (key) => {
    const req = { headers: key === undefined ? {} : { 'x-api-key': key } };
    const next = jest.fn();
    await verificarApiKeyLogiq360(req, {}, next);
    return { req, next };
  };

  test('clave válida: SQL exacto, inyecta req.empresa_id y llama next() sin argumentos', async () => {
    responder([/integracion_config/, [[{ empresa_id: 7 }, { empresa_id: 8 }]]]);
    const { req, next } = await correr('at_abc');
    expect(llamadas).toEqual([[
      'SELECT empresa_id FROM integracion_config WHERE logiq360_api_key = ? AND activo = 1 LIMIT 1',
      ['at_abc'],
    ]]);
    expect(req.empresa_id).toBe(7);
    expect(next).toHaveBeenCalledWith();
  });

  test('sin cabecera o cabecera vacía → 401 sin consultar', async () => {
    for (const k of [undefined, '']) {
      const { next } = await correr(k);
      expect(errorDe(next)).toMatchObject({ statusCode: 401, message: 'X-API-Key requerido' });
    }
    expect(llamadas).toEqual([]);
  });

  test('clave desconocida o integración inactiva → 401 y no inyecta empresa', async () => {
    const { req, next } = await correr('mala');
    expect(errorDe(next)).toMatchObject({ statusCode: 401, message: 'API key inválida o integración inactiva' });
    expect(req.empresa_id).toBeUndefined();
  });

  test('si la base falla, la promesa del middleware rechaza (Express 5 la entrega al errorHandler)', async () => {
    responder([/integracion_config/, new Error('db caída')]);
    await expect(verificarApiKeyLogiq360({ headers: { 'x-api-key': 'k' } }, {}, jest.fn())).rejects.toThrow('db caída');
  });
});

// ── verificarFirmaLogiq360 ───────────────────────────────────────────────────

describe('verificarFirmaLogiq360', () => {
  const SQL_SECRETO = 'SELECT incoming_secret FROM integracion_config WHERE (logiq360_tenant_id = ? OR empresa_id = ?) ORDER BY (logiq360_tenant_id = ?) DESC LIMIT 1';
  const cuerpo = Buffer.from('{"tenant_id":"T1","evento":"x"}');
  const correr = async ({ body = { tenant_id: 'T1' }, raw = cuerpo, firma } = {}) => {
    const req = { body, rawBody: raw, headers: firma === undefined ? {} : { 'x-logiq360-signature': firma } };
    const next = jest.fn();
    await verificarFirmaLogiq360(req, {}, next);
    return next;
  };
  const conSecreto = (s) => [/incoming_secret/, [[{ incoming_secret: s }]]];

  test('secreto del tenant + firma correcta: pasa; SQL exacto con el tenant 3 veces', async () => {
    responder(conSecreto('s3cr3t'));
    const next = await correr({ firma: firmar(cuerpo, 's3cr3t') });
    expect(next).toHaveBeenCalledWith();
    expect(llamadas).toEqual([[SQL_SECRETO, ['T1', 'T1', 'T1']]]);
  });

  test('firma incorrecta, ausente o de otro secreto → 401 "Firma del webhook inválida"', async () => {
    responder(conSecreto('s3cr3t'));
    for (const firma of [firmar(cuerpo, 'otro'), undefined, 'sha256=00', firmar(Buffer.from('otro cuerpo'), 's3cr3t')]) {
      const next = await correr({ firma });
      expect(errorDe(next)).toMatchObject({ statusCode: 401, message: 'Firma del webhook inválida' });
    }
  });

  test('el secreto del tenant manda sobre el global', async () => {
    process.env.LOGIQ360_WEBHOOK_SECRET = 'global';
    responder(conSecreto('del-tenant'));
    expect(await correr({ firma: firmar(cuerpo, 'global') })).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    expect(await correr({ firma: firmar(cuerpo, 'del-tenant') })).toHaveBeenCalledWith();
  });

  test.each([
    ['tenant sin fila', []],
    ['fila con incoming_secret null', [{ incoming_secret: null }]],
    ['fila con incoming_secret vacío', [{ incoming_secret: '' }]],
  ])('%s: cae al secreto global del entorno', async (_n, filas) => {
    process.env.LOGIQ360_WEBHOOK_SECRET = 'global';
    responder([/incoming_secret/, [filas]]);
    expect(await correr({ firma: firmar(cuerpo, 'global') })).toHaveBeenCalledWith();
  });

  test('sin tenant_id en el cuerpo: no consulta la base y usa el secreto global', async () => {
    process.env.LOGIQ360_WEBHOOK_SECRET = 'global';
    const next = await correr({ body: {}, firma: firmar(cuerpo, 'global') });
    expect(next).toHaveBeenCalledWith();
    expect(llamadas).toEqual([]);
    expect(await correr({ body: undefined, firma: firmar(cuerpo, 'global') })).toHaveBeenCalledWith();
  });

  test('sin ningún secreto: fail-closed 401 y deja constancia en el log con el tenant', async () => {
    const next = await correr({ firma: firmar(cuerpo, 'x') });
    expect(errorDe(next)).toMatchObject({ statusCode: 401, message: 'Firma del webhook inválida' });
    expect(logger.error).toHaveBeenCalledWith(
      'Webhook logiq360 sin incoming_secret configurado — evento rechazado (fail-closed)',
      { tenantId: 'T1' }
    );
  });

  test('sin rawBody se firma un buffer vacío', async () => {
    responder(conSecreto('s'));
    expect(await correr({ raw: null, firma: firmar(Buffer.alloc(0), 's') })).toHaveBeenCalledWith();
  });

  test('si la base falla, la promesa rechaza y no pasa nada a next', async () => {
    responder([/incoming_secret/, new Error('db caída')]);
    const next = jest.fn();
    await expect(verificarFirmaLogiq360({ body: { tenant_id: 'T1' }, headers: {} }, {}, next)).rejects.toThrow('db caída');
    expect(next).not.toHaveBeenCalled();
  });
});

// ── resolverEmpresasActivas ──────────────────────────────────────────────────

describe('resolverEmpresasActivas', () => {
  const correr = async (usuario) => {
    const req = { usuario };
    const next = jest.fn();
    await resolverEmpresasActivas(req, {}, next);
    return { req, next };
  };

  test('trabajador_turnos: SQL exacto con su id y lista de empresas en req.empresasActivas', async () => {
    responder([/trabajador_empresa/, [[{ empresa_id: 1 }, { empresa_id: 4 }]]]);
    const { req, next } = await correr({ sub: 42, rol: 'trabajador_turnos' });
    expect(llamadas).toEqual([[
      "SELECT te.empresa_id FROM trabajador_empresa te JOIN empresas e ON e.id = te.empresa_id AND e.activo = 1 WHERE te.usuario_id = ? AND te.estado = 'activo'",
      [42],
    ]]);
    expect(req.empresasActivas).toEqual([1, 4]);
    expect(next).toHaveBeenCalledWith();
  });

  test('sin empresas activas → lista vacía (no undefined)', async () => {
    const { req } = await correr({ sub: 42, rol: 'trabajador_turnos' });
    expect(req.empresasActivas).toEqual([]);
  });

  test.each(['admin_empresa', 'jefe_turnos', 'trabajador_nomina', undefined])('rol %s: no consulta ni inyecta nada', async (rol) => {
    const { req, next } = await correr(rol === undefined ? undefined : { sub: 1, rol });
    expect(llamadas).toEqual([]);
    expect(req.empresasActivas).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  test('si la base falla: next(error) y no inyecta la lista', async () => {
    const boom = new Error('db caída');
    responder([/trabajador_empresa/, boom]);
    const { req, next } = await correr({ sub: 42, rol: 'trabajador_turnos' });
    expect(errorDe(next)).toBe(boom);
    expect(req.empresasActivas).toBeUndefined();
  });
});
