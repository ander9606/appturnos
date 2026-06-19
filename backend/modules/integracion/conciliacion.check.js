'use strict';

/**
 * Check runnable de la conciliación de personal.
 * Mockea el modelo de trabajadores, la config y el pull a logiq360; verifica la
 * sugerencia por nombre normalizado y el vínculo (external_ref).
 *
 * Uso:  node modules/integracion/conciliacion.check.js
 */

const assert = require('node:assert');

const IntegracionModel = require('./integracion.model');
const TrabajadoresModel = require('../trabajadores/trabajadores.model');
const IntegracionService = require('./integracion.service');

(async () => {
  // ── conciliacion(): sugiere match por nombre (con acentos/espacios distintos) ──
  IntegracionModel.obtenerConfig = async () => ({
    logiq360_base_url: 'https://logiq360.test', api_key: 'lt_K',
  });
  TrabajadoresModel.listarSinVincularLogiq360 = async () => ([
    { id: 1, nombre: 'Díego', apellido: 'Herrera', cedula: '111', external_ref: null },
    { id: 2, nombre: 'Sin', apellido: 'Match', cedula: '222', external_ref: null },
  ]);
  global.fetch = async (url, opts) => {
    assert.match(url, /\/public\/empleados\?solo_turnos=true$/);
    assert.strictEqual(opts.headers['X-API-Key'], 'lt_K');
    return { ok: true, json: async () => ({ data: [
      { id: 77, nombre: 'Diego', apellido: 'HERRERA' },
      { id: 88, nombre: 'Otro', apellido: 'Empleado' },
    ] }) };
  };

  const r = await IntegracionService.conciliacion(7);
  assert.strictEqual(r.pendientes.length, 2);
  const diego = r.pendientes.find((p) => p.id === 1);
  assert.ok(diego.sugerencia, 'Diego debe tener sugerencia');
  assert.strictEqual(diego.sugerencia.id, 77, 'match por nombre normalizado');
  const sinMatch = r.pendientes.find((p) => p.id === 2);
  assert.strictEqual(sinMatch.sugerencia, null);

  // ── vincularEmpleado(): fija external_ref logiq360:empleado:<id> ──
  let vinculo = null;
  TrabajadoresModel.vincularExternalRef = async (empresaId, trabajadorId, externalRef) => {
    vinculo = { empresaId, trabajadorId, externalRef };
    return 1;
  };
  const v = await IntegracionService.vincularEmpleado(7, 1, 77);
  assert.deepStrictEqual(v, { vinculado: true });
  assert.deepStrictEqual(vinculo, { empresaId: 7, trabajadorId: 1, externalRef: 'logiq360:empleado:77' });

  // ── vincular inexistente → 404 ──
  TrabajadoresModel.vincularExternalRef = async () => 0;
  await assert.rejects(() => IntegracionService.vincularEmpleado(7, 999, 77), /no encontrado/i);

  console.log('✓ conciliacion.check OK');
  process.exit(0);
})().catch((e) => { console.error('✗', e.message); process.exit(1); });
