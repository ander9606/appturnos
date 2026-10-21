'use strict';

// Test de caracterización de los códigos OTP: congela el SQL, los parámetros y
// las reglas (intentos, expiración, token). Simula solo el borde (pool) de
// cualquier forma de usarlo — getConnection().execute, pool.execute o
// pool.query — así que vale igual si el SQL vive en el service o en un model.
jest.mock('../config/database', () => {
  const llamadas = [];
  let respuesta = () => [[]];
  const ejecutar = async (sql, params) => {
    llamadas.push([sql.replace(/\s+/g, ' ').trim(), params]);
    return respuesta(sql, params);
  };
  const conn = { execute: ejecutar, query: ejecutar, release: jest.fn() };
  return {
    pool: { getConnection: jest.fn(async () => conn), execute: ejecutar, query: ejecutar },
    __llamadas: llamadas,
    __responder: (fn) => { respuesta = fn; },
  };
});
jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../utils/mailer', () => ({ enviarEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../utils/sms', () => ({ enviarSms: jest.fn().mockResolvedValue(undefined) }));

process.env.JWT_SECRET = 'secreto-test';
const jwt = require('jsonwebtoken');
const { __llamadas: llamadas, __responder: responder } = require('../config/database');
const { enviarEmail } = require('../utils/mailer');
const { enviarSms } = require('../utils/sms');
const Verificacion = require('../modules/auth/verificacion.service');

const enUnMinuto = () => new Date(Date.now() + 60_000).toISOString();
const haceUnMinuto = () => new Date(Date.now() - 60_000).toISOString();
const fila = (extra = {}) => ({ id: 7, codigo: '123456', expires_at: enUnMinuto(), intentos: 0, ...extra });
const conSelect = (rows) => responder((sql) => (/^SELECT/.test(sql) ? [rows] : [{ affectedRows: 1 }]));

beforeEach(() => {
  llamadas.length = 0;
  jest.clearAllMocks();
  responder(() => [[]]);
});

describe('enviarOtp', () => {
  test('email: invalida los códigos anteriores, guarda el nuevo (6 dígitos, 10 min) y lo envía', async () => {
    const antes = Date.now();
    await Verificacion.enviarOtp('email', 'a@x.com');

    expect(llamadas).toHaveLength(2);
    expect(llamadas[0][0]).toContain('UPDATE codigos_verificacion SET usado = 1 WHERE tipo = ? AND destino = ? AND usado = 0');
    expect(llamadas[0][1]).toEqual(['email', 'a@x.com']);
    expect(llamadas[1][0]).toContain('INSERT INTO codigos_verificacion (tipo, destino, codigo, expires_at) VALUES (?, ?, ?, ?)');
    const [tipo, destino, codigo, expiresAt] = llamadas[1][1];
    expect([tipo, destino]).toEqual(['email', 'a@x.com']);
    expect(codigo).toMatch(/^\d{6}$/);
    expect(expiresAt.getTime() - antes).toBeGreaterThanOrEqual(10 * 60 * 1000 - 50);
    expect(expiresAt.getTime() - antes).toBeLessThan(10 * 60 * 1000 + 5000);

    expect(enviarEmail).toHaveBeenCalledTimes(1);
    expect(enviarEmail.mock.calls[0][0].to).toBe('a@x.com');
    expect(enviarEmail.mock.calls[0][0].html).toContain(codigo); // el código guardado es el que se envía
    expect(enviarSms).not.toHaveBeenCalled();
  });

  test('sms: envía el código por SMS y no por correo', async () => {
    await Verificacion.enviarOtp('telefono', '3001234567');
    expect(enviarSms).toHaveBeenCalledWith(expect.objectContaining({ to: '3001234567', body: expect.stringContaining(llamadas[1][1][2]) }));
    expect(enviarEmail).not.toHaveBeenCalled();
  });
});

describe('verificarOtp', () => {
  test('sin código vigente: 400, no toca nada más', async () => {
    conSelect([]);
    await expect(Verificacion.verificarOtp('email', 'a@x.com', '123456')).rejects.toMatchObject({ statusCode: 400 });
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0][0]).toContain('FROM codigos_verificacion WHERE tipo = ? AND destino = ? AND usado = 0 ORDER BY created_at DESC LIMIT 1');
    expect(llamadas[0][1]).toEqual(['email', 'a@x.com']);
  });

  test('con 5 intentos fallidos: invalida el código y responde 429', async () => {
    conSelect([fila({ intentos: 5 })]);
    await expect(Verificacion.verificarOtp('email', 'a@x.com', '123456')).rejects.toMatchObject({ statusCode: 429 });
    expect(llamadas[1]).toEqual([expect.stringContaining('UPDATE codigos_verificacion SET usado = 1 WHERE id = ?'), [7]]);
  });

  test('código expirado: lo invalida y responde 400', async () => {
    conSelect([fila({ expires_at: haceUnMinuto() })]);
    await expect(Verificacion.verificarOtp('email', 'a@x.com', '123456')).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('expirado') });
    expect(llamadas[1]).toEqual([expect.stringContaining('UPDATE codigos_verificacion SET usado = 1 WHERE id = ?'), [7]]);
  });

  test('código incorrecto: suma un intento y responde 400', async () => {
    conSelect([fila()]);
    await expect(Verificacion.verificarOtp('email', 'a@x.com', '000000')).rejects.toMatchObject({ statusCode: 400, message: 'Código incorrecto.' });
    expect(llamadas[1]).toEqual([expect.stringContaining('UPDATE codigos_verificacion SET intentos = intentos + 1 WHERE id = ?'), [7]]);
  });

  test('código correcto: lo marca usado y devuelve un token de 15 min para ese destino', async () => {
    conSelect([fila()]);
    const token = await Verificacion.verificarOtp('email', 'a@x.com', '123456');

    expect(llamadas[1]).toEqual([expect.stringContaining('UPDATE codigos_verificacion SET usado = 1 WHERE id = ?'), [7]]);
    const p = jwt.verify(token, process.env.JWT_SECRET);
    expect([p.tipo, p.destino]).toEqual(['email', 'a@x.com']);
    expect(p.exp - p.iat).toBe(15 * 60);
    expect(() => Verificacion.validarTokenVerificacion(token, 'email', 'a@x.com')).not.toThrow();
    expect(() => Verificacion.validarTokenVerificacion(token, 'email', 'otro@x.com')).toThrow('no corresponde');
  });
});
