'use strict';

// La cláusula de fuerza mayor está OCULTA por defecto (CLAUSULA_FUERZA_MAYOR apagada): un contrato nuevo nace sin ella.
// Encendida, los contratos que se creen desde entonces la llevan; los demás no cambian.
jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));

const DATOS = { anio: 2026, asignacionId: 500, fecha: '2026-11-03', descripcionLabor: 'Mesero', valorDia: 120000 };

function cargarModelo(valorEnv) {
  const previo = process.env.CLAUSULA_FUERZA_MAYOR;
  if (valorEnv === undefined) delete process.env.CLAUSULA_FUERZA_MAYOR; else process.env.CLAUSULA_FUERZA_MAYOR = valorEnv;
  let modelo;
  jest.isolateModules(() => { modelo = require('../modules/contratos/contratos.model'); });
  if (previo === undefined) delete process.env.CLAUSULA_FUERZA_MAYOR; else process.env.CLAUSULA_FUERZA_MAYOR = previo;
  return modelo;
}

async function marcaQueSeGuarda(valorEnv) {
  const ejecutor = { query: jest.fn().mockResolvedValue([{ insertId: 1 }]) };
  await cargarModelo(valorEnv).crear(7, DATOS, ejecutor);
  const [sql, params] = ejecutor.query.mock.calls[0];
  expect(sql).toContain('clausula_fuerza_mayor');
  return params[params.length - 1]; // la marca es el último parámetro
}

test('por defecto (interruptor apagado) el contrato nuevo NO lleva la cláusula', async () => {
  expect(await marcaQueSeGuarda(undefined)).toBe(0);
});

test('con CLAUSULA_FUERZA_MAYOR distinto de 1 sigue apagada', async () => {
  expect(await marcaQueSeGuarda('true')).toBe(0);
  expect(await marcaQueSeGuarda('0')).toBe(0);
});

test('con CLAUSULA_FUERZA_MAYOR=1 el contrato nuevo la lleva', async () => {
  expect(await marcaQueSeGuarda('1')).toBe(1);
});

test('re-generar un contrato existente no cambia su marca (ON DUPLICATE KEY no la toca)', async () => {
  const ejecutor = { query: jest.fn().mockResolvedValue([{ insertId: 1 }]) };
  await cargarModelo('1').crear(7, DATOS, ejecutor);
  const sql = ejecutor.query.mock.calls[0][0];
  expect(sql.slice(sql.indexOf('ON DUPLICATE KEY UPDATE'))).not.toContain('clausula_fuerza_mayor');
});
