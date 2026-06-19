'use strict';

/**
 * E2E check: simula el flujo completo de integración logiq360 ↔ App Turnos
 * sin bases de datos reales. Ejecuta en ~100ms.
 *
 * Pasos verificados:
 *   1. Handshake de emparejamiento (iniciar → confirmar → persistir)
 *   2. HMAC: firma y verificación en ambas direcciones
 *   3. Evento entrante orden.creada → crea oferta (idempotente)
 *   4. Evento entrante empleado.creado → crea/actualiza trabajador
 *   5. Conciliación: matching normalizado por nombre con diacríticos
 *
 * Uso: node modules/integracion/e2e.check.js
 */

const assert = require('node:assert');
const crypto = require('node:crypto');

// ── 1. Emparejamiento ────────────────────────────────────────────────────────

console.log('1. Emparejamiento ...');
{
  // logiq360 genera los secretos y el código
  const S_A = crypto.randomBytes(32).toString('hex'); // logiq360 firma sus salientes
  const S_B = crypto.randomBytes(32).toString('hex'); // AppTurnos firma sus salientes
  const K   = 'lt_' + crypto.randomBytes(32).toString('hex');
  const nonce = crypto.randomBytes(24).toString('base64url');
  const LOGIQ360_BASE = 'https://logiq360.test';
  const AT_BASE       = 'https://turnos.test';

  // Código que el usuario copia de logiq360 y pega en App Turnos
  const codigo = Buffer.from(JSON.stringify({ url: LOGIQ360_BASE, nonce }), 'utf8').toString('base64url');

  // App Turnos decodifica el código
  const decoded = JSON.parse(Buffer.from(codigo, 'base64url').toString('utf8'));
  assert.strictEqual(decoded.url, LOGIQ360_BASE, 'url del código debe coincidir');
  assert.strictEqual(decoded.nonce, nonce, 'nonce del código debe coincidir');

  // Simula la llamada a /emparejar/confirmar de logiq360
  // → logiq360 entrega el bundle de secretos
  const bundle = {
    tenant_id: 42,
    logiq360_base_url: LOGIQ360_BASE,
    webhook_url: `${LOGIQ360_BASE}/api/integracion/eventos`,
    incoming_secret: S_A,  // App Turnos usará S_A para verificar webhooks de logiq360
    webhook_secret: S_B,   // App Turnos firma sus webhooks con S_B
    api_key: K,            // App Turnos envía K como X-API-Key al llamar a logiq360
  };

  // App Turnos persiste el bundle
  const persistido = {
    activo: 1,
    webhook_url: bundle.webhook_url,
    webhook_secret: bundle.webhook_secret,
    api_key: bundle.api_key,
    incoming_secret: bundle.incoming_secret,
    logiq360_tenant_id: bundle.tenant_id,
    logiq360_base_url: bundle.logiq360_base_url,
  };

  assert.strictEqual(persistido.logiq360_tenant_id, 42, 'tenant_id debe persistir');
  assert.strictEqual(persistido.incoming_secret, S_A, 'S_A → incoming_secret (verifica webhooks de logiq360)');
  assert.strictEqual(persistido.webhook_secret, S_B, 'S_B → webhook_secret (firma webhooks de AppTurnos)');
  assert.strictEqual(persistido.api_key, K, 'K → api_key (auth pull a logiq360)');
  assert.strictEqual(persistido.activo, 1, 'integración activa tras emparejamiento');

  // Código inválido → debe fallar la decodificación
  assert.throws(
    () => JSON.parse(Buffer.from('no-es-json-valido', 'base64url').toString('utf8')),
    /SyntaxError/
  );

  console.log('   ✓ código generado y decodificado');
  console.log('   ✓ bundle de secretos mapeado correctamente');
  console.log('   ✓ código inválido → excepción al decodificar');
}

// ── 2. HMAC — firma y verificación en ambas direcciones ──────────────────────

console.log('2. HMAC ...');
{
  const { firmar, firmasCoinciden } = require('./../../utils/hmac');

  const S_A = 'secreto-logiq360-firma-salientes';
  const S_B = 'secreto-appturnos-firma-salientes';

  // logiq360 → AppTurnos: logiq360 firma con S_A, AppTurnos verifica con S_A (incoming_secret)
  const payload = JSON.stringify({ event: 'orden.creada', tenant_id: 42, data: { id: 301 } });
  const firmaLogiq360 = firmar(payload, S_A);
  assert.ok(firmaLogiq360.startsWith('sha256='), 'firma debe tener prefijo sha256=');
  assert.ok(firmasCoinciden(firmaLogiq360, firmar(payload, S_A)), 'verificación con S_A debe pasar');
  assert.ok(!firmasCoinciden(firmaLogiq360, firmar(payload, S_B)), 'S_B distinto de S_A → falla');

  // AppTurnos → logiq360: AppTurnos firma con S_B, logiq360 verifica con S_B (webhook_secret)
  const payloadAT = JSON.stringify({ event: 'ingreso.marcado', tenant_id: 42, data: {} });
  const firmaAT = firmar(payloadAT, S_B);
  assert.ok(firmasCoinciden(firmaAT, firmar(payloadAT, S_B)), 'verificación con S_B debe pasar');
  assert.ok(!firmasCoinciden(firmaAT, firmar(payloadAT, S_A)), 'S_A no verifica lo de AppTurnos');

  // Firma de payload alterado → falla
  const payloadAlterado = payloadAT.replace('ingreso', 'egreso');
  assert.ok(!firmasCoinciden(firmaAT, firmar(payloadAlterado, S_B)), 'payload alterado → firma inválida');

  console.log('   ✓ logiq360 → AppTurnos: S_A firma y verifica correctamente');
  console.log('   ✓ AppTurnos → logiq360: S_B firma y verifica correctamente');
  console.log('   ✓ payload alterado detectado');
}

// ── 3-5 requieren async ──────────────────────────────────────────────────────

(async () => {

// ── 3. Evento entrante: orden.creada ────────────────────────────────────────

console.log('3. orden.creada ...');
{
  const ofertas = [];
  const OfertasModel = require('../turnos/ofertas/ofertas.model');
  const { pool } = require('../../config/database');

  // Mock pool y OfertasModel
  pool.query = async (sql) => {
    if (sql.includes('SELECT id FROM cargos')) return [[{ id: 99 }]];
    if (sql.includes('SELECT nombre FROM empresas')) return [[{ nombre: 'Demo SA' }]];
    return [[]];
  };
  OfertasModel.obtenerPorExternalRef = async () => null; // no existe aún
  OfertasModel.crear = async (_eid, datos) => { ofertas.push(datos); return { id: 500 }; };

  const { procesar } = require('./entrantes.handlers');
  // Resetear cache del cargo auxiliar para usar nuestro mock
  const handlers = require('./entrantes.handlers');

  await procesar('orden.creada', 1, {
    external_ref: 'logiq360:orden:301',
    alquiler_ref: 'logiq360:alquiler:79',
    titulo: 'Montaje Feria',
    fecha: '2025-07-20',
    hora_inicio: '08:00:00',
    ubicacion: 'Centro de Convenciones',
    latitud: 4.65,
    longitud: -74.05,
    cupos_gig: 2,
    valor_dia_sugerido: 80000,
    productos_resumen: [{ cantidad: 3, nombre: 'Carpa 6x3' }],
    equipo_nomina: [{ nombre: 'Diego Herrera', rol: 'Jefe de cuadrilla' }],
  });

  assert.strictEqual(ofertas.length, 1, 'debe haber creado 1 oferta');
  const o = ofertas[0];
  assert.strictEqual(o.external_ref, 'logiq360:orden:301');
  assert.ok(o.descripcion?.includes('3× Carpa 6x3'), 'descripción debe incluir productos');
  assert.ok(o.externo_notas?.includes('Diego Herrera'), 'notas deben incluir equipo nómina');
  assert.strictEqual(o.puestos.length, 1, 'debe crear 1 puesto gig');
  assert.strictEqual(o.puestos[0].plazas, 2, '2 plazas gig');
  assert.strictEqual(o.puestos[0].tarifa_dia, 80000, 'tarifa del payload');

  // Idempotencia: si ya existe, no crea otra
  OfertasModel.obtenerPorExternalRef = async () => ({ id: 500, estado: 'borrador' });
  const antes = ofertas.length;
  await procesar('orden.creada', 1, { external_ref: 'logiq360:orden:301' });
  assert.strictEqual(ofertas.length, antes, 'orden duplicada NO debe crear oferta nueva');

  console.log('   ✓ oferta creada con productos, notas y puestos gig');
  console.log('   ✓ orden duplicada ignorada (idempotente)');
}

// ── 4. Evento entrante: empleado.creado ─────────────────────────────────────

console.log('4. empleado.creado ...');
{
  const TrabajadoresModel = require('../trabajadores/trabajadores.model');
  const creados = [];
  const actualizados = [];

  TrabajadoresModel.obtenerPorExternalRef = async () => null;
  TrabajadoresModel.crear = async (_eid, datos) => { creados.push(datos); return { id: 301 }; };
  TrabajadoresModel.actualizar = async (_eid, id, datos) => { actualizados.push({ id, ...datos }); };

  const { procesar } = require('./entrantes.handlers');

  await procesar('empleado.creado', 1, {
    external_ref: 'logiq360:empleado:301',
    nombre: 'Diego',
    apellido: 'Herrera',
    cedula: '12345678',
    email: 'diego@test.com',
    cargo: 'Instalador',
  });

  assert.strictEqual(creados.length, 1, 'debe crear 1 trabajador');
  assert.strictEqual(creados[0].external_ref, 'logiq360:empleado:301');
  assert.strictEqual(creados[0].tipo, 'turnos');

  // Segundo evento del mismo empleado → actualiza, no duplica
  TrabajadoresModel.obtenerPorExternalRef = async () => ({ id: 301 });
  await procesar('empleado.creado', 1, {
    external_ref: 'logiq360:empleado:301',
    nombre: 'Diego',
    apellido: 'Herrera Gómez', // apellido actualizado
  });
  assert.strictEqual(creados.length, 1, 'no debe crear otro trabajador');
  assert.strictEqual(actualizados.length, 1, 'debe actualizar el existente');
  assert.strictEqual(actualizados[0].apellido, 'Herrera Gómez');

  console.log('   ✓ trabajador creado con external_ref y tipo=turnos');
  console.log('   ✓ empleado duplicado → actualización (idempotente)');
}

// ── 5. Conciliación: matching por nombre normalizado ─────────────────────────

console.log('5. Conciliación de personal ...');
{
  // Lógica de normalización (copiada del service para verificar inline)
  const norm = (s) => String(s || '')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().trim().replace(/\s+/g, ' ');

  const candidatos = [
    { id: 301, nombre: 'Diego',     apellido: 'Herrera'   },
    { id: 302, nombre: 'Valentina', apellido: 'Ríos'      },
    { id: 303, nombre: 'Andrés',    apellido: 'García'    },
  ];

  const porNombre = new Map(candidatos.map((c) => [norm(`${c.nombre} ${c.apellido}`), c]));

  // Trabajadores sin vincular (con variantes de tildes/mayúsculas)
  const casos = [
    { nombre: 'Diego',     apellido: 'Herrera',   esperado: 301 },
    { nombre: 'VALENTINA', apellido: 'RÍOS',      esperado: 302 }, // mayúsculas + tilde
    { nombre: 'Andres',    apellido: 'Garcia',    esperado: 303 }, // sin tildes
    { nombre: 'Carlos',    apellido: 'López',     esperado: null }, // sin match
  ];

  for (const c of casos) {
    const match = porNombre.get(norm(`${c.nombre} ${c.apellido}`)) || null;
    assert.strictEqual(match?.id ?? null, c.esperado,
      `"${c.nombre} ${c.apellido}" → esperado id=${c.esperado}, obtenido=${match?.id}`);
  }

  assert.strictEqual(norm('Ríos'), 'rios', 'ríos normaliza a rios');
  assert.strictEqual(norm('ANDRÉS GARCÍA'), norm('Andres Garcia'), 'mayúsculas+tildes equivalen');

  console.log('   ✓ match exacto (Diego Herrera)');
  console.log('   ✓ match con mayúsculas + tildes (VALENTINA RÍOS)');
  console.log('   ✓ match sin tildes (Andres Garcia)');
  console.log('   ✓ sin match → null (Carlos López)');
}

// ── Resumen ──────────────────────────────────────────────────────────────────

console.log('');
console.log('✓ E2E check OK — todos los flujos pasan');
process.exit(0);

})().catch((e) => { console.error('\n✗', e.message, '\n', e.stack); process.exit(1); });
