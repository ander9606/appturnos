'use strict';

/**
 * Check runnable de calcularDeducciones (salud/pensión + fondo de solidaridad).
 * Uso:  node utils/laboralUtils.check.js
 */

const assert = require('node:assert');
const { calcularDeducciones, calcularSubsidioTransporte } = require('./laboralUtils');
const { SMMLV_COP, SUBSIDIO_TRANSPORTE_COP } = require('../config/constants');

// Trabajador por debajo de 4 SMMLV: solo 8% (salud 4% + pensión 4%).
{
  const r = calcularDeducciones(2_000_000);
  assert.strictEqual(r.salud, 80_000);
  assert.strictEqual(r.pension, 80_000);
  assert.strictEqual(r.total, 160_000);
  assert.strictEqual(r.neto, 1_840_000);
}

// Justo en el umbral de 4 SMMLV: se activa el 1% de solidaridad sobre pensión.
{
  const ibc = SMMLV_COP * 4;
  const r = calcularDeducciones(ibc);
  assert.strictEqual(r.salud, ibc * 0.04);
  assert.strictEqual(r.pension, ibc * 0.05); // 4% + 1%
}

// Tramo alto (≥20 SMMLV): 2% de solidaridad.
{
  const ibc = SMMLV_COP * 21;
  const r = calcularDeducciones(ibc);
  assert.strictEqual(r.pension, ibc * 0.06); // 4% + 2%
}

// Subsidio de transporte: aplica completo (30 días) por debajo de 2 SMMLV.
{
  const s = calcularSubsidioTransporte(SMMLV_COP, 30);
  assert.strictEqual(s, SUBSIDIO_TRANSPORTE_COP);
}

// Prorateado a 15 días.
{
  const s = calcularSubsidioTransporte(SMMLV_COP, 15);
  assert.strictEqual(s, SUBSIDIO_TRANSPORTE_COP / 2);
}

// No aplica por encima de 2 SMMLV.
{
  const s = calcularSubsidioTransporte(SMMLV_COP * 2.1, 30);
  assert.strictEqual(s, 0);
}

console.log('laboralUtils.check.js OK');
