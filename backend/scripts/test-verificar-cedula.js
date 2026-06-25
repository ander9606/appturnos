'use strict';

/**
 * Test manual para AuthService.verificarCedula.
 * Uso: node backend/scripts/test-verificar-cedula.js
 * Requiere .env configurado y la BD accesible.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const AuthService = require('../modules/auth/auth.service');

async function assert(desc, fn) {
  try {
    const result = await fn();
    console.log(`✓ ${desc}`, JSON.stringify(result));
  } catch (err) {
    console.error(`✗ ${desc}`, err.message);
  }
}

async function run() {
  // 1. Cédula que no existe en la BD
  await assert('cédula inexistente → { existe: false }', async () => {
    const r = await AuthService.verificarCedula('0000000000');
    if (r.existe !== false) throw new Error(`Esperaba existe=false, got ${JSON.stringify(r)}`);
    return r;
  });

  // Las siguientes pruebas requieren datos reales. Ajusta las cédulas según tu seed.
  const CEDULA_SIN_CUENTA   = process.env.TEST_CEDULA_SIN_CUENTA;
  const CEDULA_CON_INVITACION = process.env.TEST_CEDULA_CON_INVITACION;
  const CEDULA_CON_CUENTA   = process.env.TEST_CEDULA_CON_CUENTA;
  const CEDULA_GESTOR       = process.env.TEST_CEDULA_GESTOR;

  if (CEDULA_SIN_CUENTA) {
    await assert('cédula sin cuenta → existe=true, tiene_cuenta=false', async () => {
      const r = await AuthService.verificarCedula(CEDULA_SIN_CUENTA);
      if (!r.existe) throw new Error('esperaba existe=true');
      if (r.tiene_cuenta) throw new Error('esperaba tiene_cuenta=false');
      return r;
    });
  }

  if (CEDULA_CON_INVITACION) {
    await assert('cédula con invitación pendiente → invitacion != null', async () => {
      const r = await AuthService.verificarCedula(CEDULA_CON_INVITACION);
      if (!r.existe) throw new Error('esperaba existe=true');
      if (!r.invitacion) throw new Error('esperaba invitacion != null');
      if (!r.invitacion.empresa_nombre) throw new Error('esperaba empresa_nombre');
      return r;
    });
  }

  if (CEDULA_CON_CUENTA) {
    await assert('cédula con cuenta activa → tiene_cuenta=true, invitacion=null', async () => {
      const r = await AuthService.verificarCedula(CEDULA_CON_CUENTA);
      if (!r.existe) throw new Error('esperaba existe=true');
      if (!r.tiene_cuenta) throw new Error('esperaba tiene_cuenta=true');
      if (r.invitacion !== null) throw new Error('esperaba invitacion=null');
      return r;
    });
  }

  if (CEDULA_GESTOR) {
    await assert('cédula de gestor (rol nomina) → tipo=nomina_gestor', async () => {
      const r = await AuthService.verificarCedula(CEDULA_GESTOR);
      if (!r.existe) throw new Error('esperaba existe=true');
      if (r.tipo !== 'nomina_gestor') throw new Error(`esperaba tipo=nomina_gestor, got ${r.tipo}`);
      return r;
    });
  }

  if (!CEDULA_SIN_CUENTA && !CEDULA_CON_INVITACION && !CEDULA_CON_CUENTA && !CEDULA_GESTOR) {
    console.log('\nPara pruebas con datos reales, define en el entorno:');
    console.log('  TEST_CEDULA_SIN_CUENTA, TEST_CEDULA_CON_INVITACION, TEST_CEDULA_CON_CUENTA, TEST_CEDULA_GESTOR');
  }

  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
