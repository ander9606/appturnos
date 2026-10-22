'use strict';

// Golden master de las transacciones de AuthModel (activarCuentaTrabajador, registrarEmpresa,
// eliminarCuenta) y AdminModel.eliminarEmpresaCompleta, generado con el código ANTES de pasarlas a
// enTransaccion(). Ver __tests__/helpers/transaccionGolden.js: fija SQL, parámetros, orden,
// begin/commit/rollback/release, el valor devuelto y el comportamiento ante cada falla.
jest.mock('../config/database', () => ({ pool: { query: jest.fn(), getConnection: jest.fn() } }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { pool } = require('../config/database');
const { verificarGolden, escenariosDe } = require('./helpers/transaccionGolden');
const AuthModel = require('../modules/auth/auth.model');
const AdminModel = require('../modules/admin/admin.model');

const EMPRESA = {
  nombreEmpresa: 'Eventos SAS', slug: 'eventos', nit: '900', descripcion: 'd', actividad: 'a', telefono: '1',
  emailEmpresa: 'e@x.com', direccion: 'cll', ciudad: 'Bogotá', nombre: 'Ana', apellido: 'Pérez', email: 'ana@x.com', passwordHash: 'h',
};

const CASOS = {
  // ids: true → cada consulta devuelve un insertId distinto, para saber CUÁL se usa en el valor devuelto
  'auth.activarCuentaTrabajador': {
    llamar: () => AuthModel.activarCuentaTrabajador({
      trabajadorId: 5, empresa_id: 1, nombre: 'Ana', apellido: 'Pérez', email: 'ana@x.com', password_hash: 'h', rol: 'trabajador_turnos',
    }),
    ids: true,
  },
  'auth.registrarEmpresa (completa)': { llamar: () => AuthModel.registrarEmpresa(EMPRESA), ids: true },
  'auth.registrarEmpresa (mínima: opcionales vacíos)': {
    llamar: () => AuthModel.registrarEmpresa({ nombreEmpresa: 'E', slug: 'e', nombre: 'A', email: 'a@x.com', passwordHash: 'h' }),
    ids: true,
  },
  'auth.eliminarCuenta (con fichas, email y teléfono)': {
    llamar: () => AuthModel.eliminarCuenta(42, [7, 8], 'hash-inutil'),
    fila: { email: 'ana@x.com', telefono: '3001234567' },
  },
  'auth.eliminarCuenta (solo email, con una ficha)': {
    llamar: () => AuthModel.eliminarCuenta(42, [7], 'hash-inutil'),
    fila: { email: 'ana@x.com', telefono: null },
  },
  'auth.eliminarCuenta (sin fichas, sin email ni teléfono)': {
    llamar: () => AuthModel.eliminarCuenta(42, [], 'hash-inutil'),
    fila: { email: null, telefono: null },
  },
  'admin.eliminarEmpresaCompleta (fallas muestreadas)': {
    llamar: () => AdminModel.eliminarEmpresaCompleta(9),
    muestra: true,
  },
};

test('las transacciones de auth y admin se comportan igual que el golden (éxito y cada falla)', async () => {
  const { escrito, actual, golden } = await verificarGolden(pool, CASOS, 'transaccionesModelsT2.golden.json');
  if (escrito) return;
  expect(Object.keys(actual)).toEqual(Object.keys(golden));
  for (const nombre of Object.keys(golden)) {
    expect({ nombre, escenarios: actual[nombre] }).toEqual({ nombre, escenarios: golden[nombre] });
  }
});

// Lectura directa de lo esencial, para que el golden no sea una caja negra.
test('eliminarCuenta: cada rama de consultas aparece solo cuando corresponde', async () => {
  const consultas = async (caso) => (await escenariosDe(pool, caso.llamar, { fila: caso.fila })).ok.log
    .filter((l) => l[0] === 'query').map((l) => l[1].split(' ').slice(0, 3).join(' '));

  const todo = await consultas(CASOS['auth.eliminarCuenta (con fichas, email y teléfono)']);
  expect(todo).toContain('DELETE FROM codigos_verificacion');
  expect(todo).toContain('DELETE FROM disponibilidad_trabajador');

  const sinNada = await consultas(CASOS['auth.eliminarCuenta (sin fichas, sin email ni teléfono)']);
  expect(sinNada).not.toContain('DELETE FROM codigos_verificacion');
  expect(sinNada).not.toContain('DELETE FROM disponibilidad_trabajador');
});

test('eliminarEmpresaCompleta: borra en el orden declarado, cada consulta con tantos parámetros como "?" y termina en empresas', async () => {
  const esc = await escenariosDe(pool, CASOS['admin.eliminarEmpresaCompleta (fallas muestreadas)'].llamar, { muestra: true });
  const qs = esc.ok.log.filter((l) => l[0] === 'query');
  expect(qs.length).toBeGreaterThan(40);
  for (const [, sql, params] of qs) {
    expect(params).toHaveLength((sql.match(/\?/g) || []).length);
    expect(params.every((p) => p === 9)).toBe(true);
  }
  expect(qs.at(-1)[1]).toBe('DELETE FROM empresas WHERE id = ?');
  expect(esc.ok.log.map((l) => l[0]).slice(0, 2)).toEqual(['getConnection', 'begin']);
  expect(esc.ok.log.map((l) => l[0]).slice(-2)).toEqual(['commit', 'release']);
});
