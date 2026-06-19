'use strict';

/**
 * Seed de datos de prueba completos — nómina + turnos + logiq360
 *
 * Uso: cd backend && node scripts/seed-datos-prueba.js
 *
 * Requiere que seed-test-users.js ya haya corrido (empresa Demo + usuarios base).
 * Idempotente: se puede correr más de una vez sin duplicar registros.
 *
 * Crea:
 *   - 4 trabajadores nómina (Carlos, María, Pedro, Luisa)
 *   - 4 trabajadores turnos marketplace (Diego, Valentina, Andrés, Sofía)
 *   - Integración logiq360 activa con eventos in/out
 *   - 2 períodos de nómina (1 cerrado con snapshot, 1 abierto)
 *   - ~88 registros diarios con horas ordinarias/extra/nocturnas/festivo
 *   - 4 ofertas de turno (3 completadas + 1 próxima)
 *   - 8 asignaciones completadas con ingreso/egreso GPS + contratos + calificaciones
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const bcrypt    = require('bcrypt');
const { pool }  = require('../config/database');
const { randomUUID } = require('crypto');

const PASSWORD      = 'Test1234!';
const BCRYPT_ROUNDS = 10;

// ─── helpers ──────────────────────────────────────────────────────────────────

function ok(msg)   { console.log(`  ✅ ${msg}`); }
function skip(msg) { console.log(`  ⚠️  ${msg}`); }
function section(title) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 50 - title.length))}`);
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   Seed datos de prueba — nómina + turnos + logiq360  ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  try { await pool.query('SELECT 1'); ok('Base de datos conectada\n'); }
  catch (e) { console.error('❌ DB error:', e.message); process.exit(1); }

  // ── 0. IDs base ─────────────────────────────────────────────────────────────
  const [[empresa]] = await pool.query(`SELECT id FROM empresas WHERE slug = 'empresa-demo'`);
  if (!empresa) {
    console.error('❌ Empresa Demo no encontrada. Corre seed-test-users.js primero.');
    process.exit(1);
  }
  const eId = empresa.id;
  console.log(`  ℹ️  empresa_id = ${eId}`);

  // Cargos del sistema
  const [[cAux]]  = await pool.query(`SELECT id FROM cargos WHERE empresa_id IS NULL AND codigo='auxiliar'`);
  const [[cJefe]] = await pool.query(`SELECT id FROM cargos WHERE empresa_id IS NULL AND codigo='jefe_montaje'`);
  const [[cCond]] = await pool.query(`SELECT id FROM cargos WHERE empresa_id IS NULL AND codigo='conductor'`);
  if (!cAux || !cJefe || !cCond) {
    console.error('❌ Cargos del sistema no encontrados. Asegúrate de que la migración 012 haya corrido.');
    process.exit(1);
  }
  const [auxId, jefeId, condId] = [cAux.id, cJefe.id, cCond.id];
  console.log(`  ℹ️  cargos: auxiliar=${auxId}  jefe_montaje=${jefeId}  conductor=${condId}`);

  // Usuarios existentes del primer seed
  const [[uAdmin]]   = await pool.query(`SELECT id FROM usuarios WHERE email='admin@demo.com'`);
  const [[uJTurnos]] = await pool.query(`SELECT id FROM usuarios WHERE email='jturnos@demo.com'`);
  const [[uJNomina]] = await pool.query(`SELECT id FROM usuarios WHERE email='jnomina@demo.com'`);
  const adminId   = uAdmin?.id;
  const jTurnosId = uJTurnos?.id;
  const jNominaId = uJNomina?.id;
  console.log(`  ℹ️  admin=${adminId}  jefe_turnos=${jTurnosId}  jefe_nomina=${jNominaId}\n`);

  const hash = await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS);

  // ── 1. Trabajadores nómina ────────────────────────────────────────────────
  section('1. Trabajadores nómina');

  const nominaDefs = [
    { nombre:'Carlos',   apellido:'Ruiz Pérez',      email:'carlos.ruiz@demo.com',     cedula:'1020304050',
      cargo:'Auxiliar de montaje',  salario_base:1_500_000, tarifa_hora:6250.00  },
    { nombre:'María',    apellido:'González Díaz',   email:'maria.gonzalez@demo.com',  cedula:'1020304051',
      cargo:'Auxiliar de montaje',  salario_base:1_500_000, tarifa_hora:6250.00  },
    { nombre:'Pedro',    apellido:'Martínez Silva',  email:'pedro.martinez@demo.com',  cedula:'1020304052',
      cargo:'Jefe de montaje',      salario_base:2_200_000, tarifa_hora:9166.67  },
    { nombre:'Luisa',    apellido:'Vargas Moreno',   email:'luisa.vargas@demo.com',    cedula:'1020304053',
      cargo:'Conductora',           salario_base:1_800_000, tarifa_hora:7500.00  },
    { nombre:'Ana',      apellido:'Morales Peña',    email:'ana.morales@demo.com',      cedula:'1020304054',
      cargo:'Auxiliar logístico',   salario_base:1_600_000, tarifa_hora:6666.67  },
    { nombre:'Ricardo',  apellido:'Castro Bernal',   email:'ricardo.castro@demo.com',   cedula:'1020304055',
      cargo:'Auxiliar logístico',   salario_base:1_600_000, tarifa_hora:6666.67  },
  ];

  // valor_hora_snapshot = salario_base / 240
  const nominaSnapshots = nominaDefs.map(w => parseFloat((w.salario_base / 240).toFixed(4)));

  const nominaIds = [];
  for (const w of nominaDefs) {
    let uId;
    const [[uEx]] = await pool.query(`SELECT id FROM usuarios WHERE email=?`, [w.email]);
    if (uEx) { uId = uEx.id; skip(`usuario ${w.email} (id=${uId})`); }
    else {
      const [r] = await pool.query(
        `INSERT INTO usuarios (empresa_id,nombre,apellido,email,password_hash,rol,activo)
         VALUES (?,?,?,?,?,'trabajador_nomina',1)`,
        [eId, w.nombre, w.apellido, w.email, hash]
      );
      uId = r.insertId;
      ok(`usuario ${w.email} (id=${uId})`);
    }

    let tId;
    const [[tEx]] = await pool.query(
      `SELECT id FROM trabajadores WHERE empresa_id=? AND cedula=?`, [eId, w.cedula]
    );
    if (tEx) { tId = tEx.id; skip(`trabajador ${w.nombre} ${w.apellido} (id=${tId})`); }
    else {
      const [r] = await pool.query(
        `INSERT INTO trabajadores (empresa_id,usuario_id,nombre,apellido,cedula,email,tipo,cargo,salario_base,tarifa_hora,activo)
         VALUES (?,?,?,?,?,?,'nomina',?,?,?,1)`,
        [eId, uId, w.nombre, w.apellido, w.cedula, w.email, w.cargo, w.salario_base, w.tarifa_hora]
      );
      tId = r.insertId;
      ok(`trabajador ${w.nombre} ${w.apellido} (id=${tId})`);
    }
    nominaIds.push(tId);
  }

  // ── 2. Trabajadores turnos (marketplace) ─────────────────────────────────
  section('2. Trabajadores turnos marketplace');

  const turnosDefs = [
    { nombre:'Diego',     apellido:'Herrera Castro', email:'diego.herrera@turnos.com',    cedula:'2030405060',
      cargo:'Auxiliar',         tarifa_hora: 9375.00, external_ref:'logiq360:trabajador:201', cargo_id: auxId  },
    { nombre:'Valentina', apellido:'Torres Jiménez', email:'valentina.torres@turnos.com', cedula:'2030405061',
      cargo:'Auxiliar',         tarifa_hora: 9375.00, external_ref:'logiq360:trabajador:202', cargo_id: auxId  },
    { nombre:'Andrés',    apellido:'López Gómez',    email:'andres.lopez@turnos.com',     cedula:'2030405062',
      cargo:'Conductor',        tarifa_hora:12500.00, external_ref:'logiq360:trabajador:203', cargo_id: condId },
    { nombre:'Sofía',     apellido:'Ramírez Peña',   email:'sofia.ramirez@turnos.com',    cedula:'2030405063',
      cargo:'Jefe de montaje',  tarifa_hora:18750.00, external_ref:'logiq360:trabajador:204', cargo_id: jefeId },
  ];

  const turnosWorkers = []; // { uId, tId, teId }
  for (const w of turnosDefs) {
    let uId;
    const [[uEx]] = await pool.query(`SELECT id FROM usuarios WHERE email=?`, [w.email]);
    if (uEx) { uId = uEx.id; skip(`usuario ${w.email} (id=${uId})`); }
    else {
      const [r] = await pool.query(
        `INSERT INTO usuarios (empresa_id,nombre,apellido,email,password_hash,rol,activo)
         VALUES (NULL,?,?,?,?,'trabajador_turnos',1)`,
        [w.nombre, w.apellido, w.email, hash]
      );
      uId = r.insertId;
      ok(`usuario ${w.email} (id=${uId})`);
    }

    let tId;
    const [[tEx]] = await pool.query(
      `SELECT id FROM trabajadores WHERE empresa_id=? AND cedula=?`, [eId, w.cedula]
    );
    if (tEx) { tId = tEx.id; skip(`trabajador ${w.nombre} ${w.apellido} (id=${tId})`); }
    else {
      const [r] = await pool.query(
        `INSERT INTO trabajadores (empresa_id,usuario_id,nombre,apellido,cedula,email,tipo,cargo,tarifa_hora,external_ref,activo)
         VALUES (?,?,?,?,?,?,'turnos',?,?,?,1)`,
        [eId, uId, w.nombre, w.apellido, w.cedula, w.email, w.cargo, w.tarifa_hora, w.external_ref]
      );
      tId = r.insertId;
      ok(`trabajador ${w.nombre} ${w.apellido} (id=${tId})`);
    }

    // Vínculo trabajador_empresa
    let teId;
    const [[teEx]] = await pool.query(
      `SELECT id FROM trabajador_empresa WHERE usuario_id=? AND empresa_id=?`, [uId, eId]
    );
    if (teEx) { teId = teEx.id; skip(`trabajador_empresa usuario=${uId}`); }
    else {
      const [r] = await pool.query(
        `INSERT INTO trabajador_empresa (usuario_id,empresa_id,trabajador_id,estado,iniciado_por,fecha_resuelto)
         VALUES (?,?,?,'activo','empresa',NOW())`,
        [uId, eId, tId]
      );
      teId = r.insertId;
      ok(`trabajador_empresa id=${teId}`);
    }

    // Asignar cargo certificado
    if (adminId) {
      const [[tcEx]] = await pool.query(
        `SELECT id FROM trabajador_cargos WHERE trabajador_empresa_id=? AND cargo_id=?`, [teId, w.cargo_id]
      );
      if (!tcEx) {
        await pool.query(
          `INSERT INTO trabajador_cargos (trabajador_empresa_id,cargo_id,asignado_por) VALUES (?,?,?)`,
          [teId, w.cargo_id, adminId]
        );
        ok(`cargo '${w.cargo}' asignado a ${w.nombre}`);
      } else {
        skip(`cargo '${w.cargo}' ya asignado a ${w.nombre}`);
      }
    }

    turnosWorkers.push({ uId, tId, teId });
  }

  // ── 3. Integración logiq360 ──────────────────────────────────────────────
  section('3. Integración logiq360');

  const [[icEx]] = await pool.query(
    `SELECT id FROM integracion_config WHERE empresa_id=?`, [eId]
  );
  if (icEx) {
    skip('integracion_config ya existe');
  } else {
    await pool.query(
      `INSERT INTO integracion_config
         (empresa_id,activo,webhook_url,webhook_secret,api_key,incoming_secret)
       VALUES (?,1,?,?,?,?)`,
      [eId,
       'https://api.logiq360.com/webhooks/app-turnos',
       'wh_secret_demo_abc123xyz789',
       'api_key_demo_empresa_demo_001',
       'in_secret_demo_xyz456abc123']
    );
    ok('integracion_config creada (activo=1)');
  }

  // Eventos entrantes (órdenes de logiq360)
  const [[evInCount]] = await pool.query(
    `SELECT COUNT(*) AS c FROM integration_events_in WHERE empresa_id=?`, [eId]
  );
  if (evInCount.c > 0) {
    skip(`integration_events_in: ${evInCount.c} eventos ya existen`);
  } else {
    const evIn = [
      { tipo:'orden.creada',    estado:'procesado', ts:'2026-05-13 09:00:00',
        payload: { alquiler_id:31, titulo:'Montaje Feria del Hogar', fecha:'2026-05-15',
          hora_inicio:'07:00', lugar:'Corferias, Bogotá', lat:4.6488, lon:-74.0940,
          puestos:[{cargo:'auxiliar',plazas:5,tarifa_dia:75000},{cargo:'jefe_montaje',plazas:1,tarifa_dia:150000}],
          notas_para_operario:'Presentarse con carné y botas industriales. Parqueadero gratis en entrada 3.' } },
      { tipo:'orden.creada',    estado:'procesado', ts:'2026-05-16 11:30:00',
        payload: { alquiler_id:35, titulo:'Operación Logística IKEA', fecha:'2026-05-20',
          hora_inicio:'06:00', lugar:'Bodega Zona Franca, Funza', lat:4.7168, lon:-74.2055,
          puestos:[{cargo:'auxiliar',plazas:3,tarifa_dia:80000},{cargo:'conductor',plazas:1,tarifa_dia:120000}],
          notas_para_operario:'Entrada por portería 2. Traer documento de identidad original.' } },
      { tipo:'orden.cancelada', estado:'procesado', ts:'2026-05-17 14:00:00',
        payload: { alquiler_id:33, motivo:'Cliente canceló el evento por lluvia', fecha_original:'2026-05-18' } },
      { tipo:'orden.publicada', estado:'procesado', ts:'2026-05-13 09:05:00',
        payload: { alquiler_id:31 } },
      { tipo:'orden.publicada', estado:'procesado', ts:'2026-05-16 11:35:00',
        payload: { alquiler_id:35 } },
    ];
    for (const ev of evIn) {
      await pool.query(
        `INSERT INTO integration_events_in
           (empresa_id,event_id,tipo_evento,payload,estado,procesado_at,created_at)
         VALUES (?,?,?,?,?,?,?)`,
        [eId, randomUUID(), ev.tipo, JSON.stringify(ev.payload), ev.estado, ev.ts, ev.ts]
      );
      ok(`evento_in ${ev.tipo}`);
    }
  }

  // ── 4. Períodos de nómina ────────────────────────────────────────────────
  section('4. Períodos de nómina');

  let periodo1Id, periodo2Id;

  const [[p1Ex]] = await pool.query(
    `SELECT id FROM periodos_nomina WHERE empresa_id=? AND fecha_inicio='2026-05-01'`, [eId]
  );
  if (p1Ex) {
    periodo1Id = p1Ex.id;
    skip(`período 1 (2026-05-01→15) id=${periodo1Id}`);
  } else {
    const [r] = await pool.query(
      `INSERT INTO periodos_nomina (empresa_id,fecha_inicio,fecha_fin,tipo,estado,cerrado_por,cerrado_at)
       VALUES (?,'2026-05-01','2026-05-15','quincenal','cerrado',?,'2026-05-16 08:00:00')`,
      [eId, jNominaId]
    );
    periodo1Id = r.insertId;
    ok(`período 1 cerrado (id=${periodo1Id})`);
  }

  const [[p2Ex]] = await pool.query(
    `SELECT id FROM periodos_nomina WHERE empresa_id=? AND fecha_inicio='2026-05-16'`, [eId]
  );
  if (p2Ex) {
    periodo2Id = p2Ex.id;
    skip(`período 2 (2026-05-16→31) id=${periodo2Id}`);
  } else {
    const [r] = await pool.query(
      `INSERT INTO periodos_nomina (empresa_id,fecha_inicio,fecha_fin,tipo,estado)
       VALUES (?,'2026-05-16','2026-05-31','quincenal','abierto')`,
      [eId]
    );
    periodo2Id = r.insertId;
    ok(`período 2 abierto (id=${periodo2Id})`);
  }

  // ── 5. Registros diarios ─────────────────────────────────────────────────
  section('5. Registros diarios');

  // Período 1 (may 1-15): 1 mayo = festivo (Día del Trabajo)
  // Días laborales: 1(fes), 2, 5, 6, 7, 8, 9, 12, 13, 14, 15
  const diasP1 = [
    { f:'2026-05-01', e:'07:00:00', s:'15:00:00', fest:1,
      ord:0.00, xd:0.00, xn:0.00, noc:0.00, fes:8.00 },
    { f:'2026-05-02', e:'07:00:00', s:'15:00:00', fest:0,
      ord:8.00, xd:0.00, xn:0.00, noc:0.00, fes:0.00 },
    { f:'2026-05-05', e:'07:00:00', s:'16:00:00', fest:0,
      ord:8.00, xd:1.00, xn:0.00, noc:0.00, fes:0.00 },
    { f:'2026-05-06', e:'07:00:00', s:'15:00:00', fest:0,
      ord:8.00, xd:0.00, xn:0.00, noc:0.00, fes:0.00 },
    { f:'2026-05-07', e:'07:00:00', s:'15:00:00', fest:0,
      ord:8.00, xd:0.00, xn:0.00, noc:0.00, fes:0.00 },
    { f:'2026-05-08', e:'06:00:00', s:'22:00:00', fest:0,
      ord:8.00, xd:7.00, xn:0.00, noc:1.00, fes:0.00 },  // turno largo noche parcial
    { f:'2026-05-09', e:'07:00:00', s:'17:00:00', fest:0,
      ord:8.00, xd:2.00, xn:0.00, noc:0.00, fes:0.00 },
    { f:'2026-05-12', e:'07:00:00', s:'15:00:00', fest:0,
      ord:8.00, xd:0.00, xn:0.00, noc:0.00, fes:0.00 },
    { f:'2026-05-13', e:'07:00:00', s:'15:00:00', fest:0,
      ord:8.00, xd:0.00, xn:0.00, noc:0.00, fes:0.00 },
    { f:'2026-05-14', e:'21:00:00', s:'05:00:00', fest:0,
      ord:0.00, xd:0.00, xn:2.00, noc:6.00, fes:0.00 },  // turno nocturno
    { f:'2026-05-15', e:'07:00:00', s:'15:00:00', fest:0,
      ord:8.00, xd:0.00, xn:0.00, noc:0.00, fes:0.00 },
  ];

  // Período 2 (may 16-28 hasta hoy): días laborales hasta ayer
  const diasP2 = [
    { f:'2026-05-16', e:'07:00:00', s:'15:00:00', fest:0,
      ord:8.00, xd:0.00, xn:0.00, noc:0.00, fes:0.00 },
    { f:'2026-05-19', e:'07:00:00', s:'16:00:00', fest:0,
      ord:8.00, xd:1.00, xn:0.00, noc:0.00, fes:0.00 },
    { f:'2026-05-20', e:'07:00:00', s:'15:00:00', fest:0,
      ord:8.00, xd:0.00, xn:0.00, noc:0.00, fes:0.00 },
    { f:'2026-05-21', e:'07:00:00', s:'15:00:00', fest:0,
      ord:8.00, xd:0.00, xn:0.00, noc:0.00, fes:0.00 },
    { f:'2026-05-22', e:'07:00:00', s:'15:00:00', fest:0,
      ord:8.00, xd:0.00, xn:0.00, noc:0.00, fes:0.00 },
    { f:'2026-05-23', e:'07:00:00', s:'17:00:00', fest:0,
      ord:8.00, xd:2.00, xn:0.00, noc:0.00, fes:0.00 },
    { f:'2026-05-26', e:'07:00:00', s:'15:00:00', fest:0,
      ord:8.00, xd:0.00, xn:0.00, noc:0.00, fes:0.00 },
    { f:'2026-05-27', e:'07:00:00', s:'15:00:00', fest:0,
      ord:8.00, xd:0.00, xn:0.00, noc:0.00, fes:0.00 },
  ];

  let regCreados = 0;
  let regOmitidos = 0;

  for (let wi = 0; wi < nominaIds.length; wi++) {
    const tId      = nominaIds[wi];
    const snapshot = nominaSnapshots[wi];

    for (const d of diasP1) {
      const [[ex]] = await pool.query(
        `SELECT id FROM registros_diarios WHERE empresa_id=? AND trabajador_id=? AND fecha=?`,
        [eId, tId, d.f]
      );
      if (ex) { regOmitidos++; continue; }
      await pool.query(
        `INSERT INTO registros_diarios
           (empresa_id,trabajador_id,periodo_id,fecha,hora_entrada,hora_salida,
            horas_ordinarias,horas_extra_diurnas,horas_extra_nocturnas,horas_nocturnas,horas_festivo,
            es_festivo,valor_hora_snapshot,aprobado_por)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [eId, tId, periodo1Id, d.f, d.e, d.s,
         d.ord, d.xd, d.xn, d.noc, d.fes, d.fest, snapshot, jNominaId]
      );
      regCreados++;
    }

    for (const d of diasP2) {
      const [[ex]] = await pool.query(
        `SELECT id FROM registros_diarios WHERE empresa_id=? AND trabajador_id=? AND fecha=?`,
        [eId, tId, d.f]
      );
      if (ex) { regOmitidos++; continue; }
      await pool.query(
        `INSERT INTO registros_diarios
           (empresa_id,trabajador_id,periodo_id,fecha,hora_entrada,hora_salida,
            horas_ordinarias,horas_extra_diurnas,horas_extra_nocturnas,horas_nocturnas,horas_festivo,
            es_festivo,aprobado_por)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [eId, tId, periodo2Id, d.f, d.e, d.s,
         d.ord, d.xd, d.xn, d.noc, d.fes, d.fest, jNominaId]
      );
      regCreados++;
    }
  }

  if (regCreados)  ok(`${regCreados} registros diarios creados`);
  if (regOmitidos) skip(`${regOmitidos} registros omitidos (ya existían)`);

  // ── 6. Ofertas de turno ──────────────────────────────────────────────────
  section('6. Ofertas de turno');

  const ofertasDefs = [
    {
      titulo:'Montaje Feria del Hogar',
      desc:  'Instalación de stands y estructuras para feria de decoración',
      fecha: '2026-05-15', hi:'07:00:00', hf:'17:00:00',
      lugar: 'Corferias, Bogotá', lat:4.6488, lon:-74.0940,
      estado:'completada', ext_ref:'logiq360:orden:101',
      alq_ref:'logiq360:alquiler:31',
      ext_notas:'Presentarse con carné y botas industriales. Parqueadero gratis en entrada 3.',
      puestos:[
        { cid:auxId,  plazas:5, tarifa:75000,  notas:'Uniforme industrial obligatorio' },
        { cid:jefeId, plazas:1, tarifa:150000, notas:'Experiencia previa en feria requerida' },
      ],
    },
    {
      titulo:'Operación Logística IKEA',
      desc:  'Cargue y descargue de mercancía en bodega zona franca',
      fecha: '2026-05-20', hi:'06:00:00', hf:'15:00:00',
      lugar: 'Bodega Zona Franca, Funza', lat:4.7168, lon:-74.2055,
      estado:'completada', ext_ref:'logiq360:orden:102',
      alq_ref:'logiq360:alquiler:35',
      ext_notas:'Entrada por portería 2. Traer documento de identidad original.',
      puestos:[
        { cid:auxId,  plazas:3, tarifa:80000,  notas:null },
        { cid:condId, plazas:1, tarifa:120000, notas:'Licencia C1 vigente' },
      ],
    },
    {
      titulo:'Cargue Contenedor Terminal Bogotá',
      desc:  'Cargue de contenedor 40 pies con maquinaria industrial',
      fecha: '2026-05-27', hi:'05:00:00', hf:'13:00:00',
      lugar: 'Terminal de Carga El Dorado', lat:4.7011, lon:-74.1469,
      estado:'completada', ext_ref:null, alq_ref:null, ext_notas:null,
      puestos:[
        { cid:auxId, plazas:4, tarifa:75000, notas:'Guantes y chaleco reflectivo obligatorio' },
      ],
    },
    {
      titulo:'Montaje Evento Cultural TeatroCalle',
      desc:  'Instalación de tarima y equipos de sonido para festival de teatro',
      fecha: '2026-05-30', hi:'08:00:00', hf:'18:00:00',
      lugar: 'Plaza de Bolívar, Bogotá', lat:4.5981, lon:-74.0761,
      estado:'publicada', ext_ref:null, alq_ref:null, ext_notas:null,
      puestos:[
        { cid:auxId,  plazas:6, tarifa:78000,  notas:null },
        { cid:jefeId, plazas:1, tarifa:155000, notas:'Experiencia en eventos en vivo' },
        { cid:condId, plazas:1, tarifa:125000, notas:null },
      ],
    },
  ];

  const ofertaIds   = [];
  const puestoMaps  = [];  // index → { cargo_id: puesto_id }

  for (const o of ofertasDefs) {
    let oId;
    const [[oEx]] = await pool.query(
      `SELECT id FROM ofertas_turno WHERE empresa_id=? AND titulo=? AND fecha=?`,
      [eId, o.titulo, o.fecha]
    );
    if (oEx) {
      oId = oEx.id;
      skip(`oferta "${o.titulo}" (id=${oId})`);
    } else {
      const [r] = await pool.query(
        `INSERT INTO ofertas_turno
           (empresa_id,titulo,descripcion,fecha,hora_inicio,hora_fin_estimada,
            lugar,latitud,longitud,estado,external_ref,alquiler_ref,externo_notas,creado_por)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [eId, o.titulo, o.desc, o.fecha, o.hi, o.hf,
         o.lugar, o.lat, o.lon, o.estado, o.ext_ref, o.alq_ref, o.ext_notas, jTurnosId]
      );
      oId = r.insertId;
      ok(`oferta "${o.titulo}" (id=${oId})`);
    }
    ofertaIds.push(oId);

    const pMap = {};
    for (const p of o.puestos) {
      const [[pEx]] = await pool.query(
        `SELECT id FROM oferta_puestos WHERE oferta_id=? AND cargo_id=?`, [oId, p.cid]
      );
      if (pEx) {
        pMap[p.cid] = pEx.id;
      } else {
        const [rp] = await pool.query(
          `INSERT INTO oferta_puestos (oferta_id,cargo_id,plazas,plazas_cubiertas,tarifa_dia,notas)
           VALUES (?,?,?,0,?,?)`,
          [oId, p.cid, p.plazas, p.tarifa, p.notas]
        );
        pMap[p.cid] = rp.insertId;
        ok(`  puesto cargo=${p.cid} tarifa=${p.tarifa.toLocaleString('es-CO')} (id=${rp.insertId})`);
      }
    }
    puestoMaps.push(pMap);
  }

  // ── 7. Asignaciones, contratos y calificaciones ──────────────────────────
  section('7. Asignaciones, contratos y calificaciones');

  // turnosWorkers: [0]=Diego(aux) [1]=Valentina(aux) [2]=Andrés(cond) [3]=Sofía(jefe)
  const asigs = [
    // ── Oferta 0: Feria Hogar (May 15) ──────────────────────────────────
    { oIdx:0, wIdx:0, cid:auxId,  tarifa:75000,
      hi:'2026-05-15 07:10:00', he:'2026-05-15 17:05:00',
      lat:4.6490, lon:-74.0938, hrs:9.92, pago:93000, num:'CD-2026-001',
      est:'completado', cal:5, com:'Excelente trabajo, puntual y responsable' },
    { oIdx:0, wIdx:1, cid:auxId,  tarifa:75000,
      hi:'2026-05-15 07:05:00', he:'2026-05-15 17:00:00',
      lat:4.6489, lon:-74.0939, hrs:9.92, pago:93000, num:'CD-2026-002',
      est:'completado', cal:4, com:'Buen desempeño, cumplió con las tareas' },
    { oIdx:0, wIdx:3, cid:jefeId, tarifa:150000,
      hi:'2026-05-15 06:55:00', he:'2026-05-15 17:30:00',
      lat:4.6487, lon:-74.0941, hrs:10.58, pago:198750, num:'CD-2026-003',
      est:'completado', cal:5, com:'Liderazgo sobresaliente, equipo muy bien coordinado' },
    // ── Oferta 1: IKEA (May 20) ──────────────────────────────────────────
    { oIdx:1, wIdx:0, cid:auxId,  tarifa:80000,
      hi:'2026-05-20 06:08:00', he:'2026-05-20 15:02:00',
      lat:4.7170, lon:-74.2053, hrs:8.90, pago:89000, num:'CD-2026-004',
      est:'completado', cal:5, com:null },
    { oIdx:1, wIdx:1, cid:auxId,  tarifa:80000,
      hi:'2026-05-20 06:15:00', he:'2026-05-20 15:00:00',
      lat:4.7169, lon:-74.2054, hrs:8.75, pago:87500, num:'CD-2026-005',
      est:'completado', cal:4, com:'Cumplió con todas las tareas asignadas' },
    { oIdx:1, wIdx:2, cid:condId, tarifa:120000,
      hi:'2026-05-20 06:00:00', he:'2026-05-20 15:10:00',
      lat:4.7167, lon:-74.2056, hrs:9.17, pago:137500, num:'CD-2026-006',
      est:'completado', cal:5, com:'Conductor muy profesional, conoce bien las rutas' },
    // ── Oferta 2: Contenedor (May 27) ────────────────────────────────────
    { oIdx:2, wIdx:0, cid:auxId, tarifa:75000,
      hi:'2026-05-27 05:12:00', he:'2026-05-27 13:08:00',
      lat:4.7013, lon:-74.1467, hrs:7.93, pago:74438, num:'CD-2026-007',
      est:'completado', cal:4, com:null },
    { oIdx:2, wIdx:1, cid:auxId, tarifa:75000,
      hi:'2026-05-27 05:08:00', he:'2026-05-27 13:05:00',
      lat:4.7012, lon:-74.1468, hrs:7.95, pago:74625, num:'CD-2026-008',
      est:'completado', cal:null, com:null },  // pendiente calificar
  ];

  for (const a of asigs) {
    const oId   = ofertaIds[a.oIdx];
    const pId   = puestoMaps[a.oIdx][a.cid];
    const tId   = turnosWorkers[a.wIdx].tId;

    const [[aEx]] = await pool.query(
      `SELECT id FROM asignaciones_turno WHERE oferta_id=? AND trabajador_id=?`, [oId, tId]
    );
    let asigId;
    if (aEx) {
      asigId = aEx.id;
      skip(`asignacion oferta=${oId} trabajador=${tId}`);
    } else {
      const [r] = await pool.query(
        `INSERT INTO asignaciones_turno
           (empresa_id,oferta_id,puesto_id,trabajador_id,estado,
            hora_ingreso_real,hora_egreso_real,latitud_ingreso,longitud_ingreso,
            horas_trabajadas,pago_total)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [eId, oId, pId, tId, a.est, a.hi, a.he, a.lat, a.lon, a.hrs, a.pago]
      );
      asigId = r.insertId;
      ok(`asignacion id=${asigId} (${turnosDefs[a.wIdx].nombre}, oferta ${a.oIdx+1})`);

      await pool.query(
        `UPDATE oferta_puestos SET plazas_cubiertas = plazas_cubiertas + 1 WHERE id=?`, [pId]
      );
    }

    // Contrato diario
    const [[cEx]] = await pool.query(`SELECT id FROM contratos_diarios WHERE asignacion_id=?`, [asigId]);
    if (!cEx) {
      await pool.query(
        `INSERT INTO contratos_diarios
           (empresa_id,asignacion_id,numero_contrato,fecha,descripcion_labor,valor_dia,firmado_trabajador,firmado_at)
         VALUES (?,?,?,?,?,?,1,?)`,
        [eId, asigId, a.num, ofertasDefs[a.oIdx].fecha,
         `Prestación de servicios — ${ofertasDefs[a.oIdx].titulo}`, a.tarifa, a.he]
      );
      ok(`  contrato ${a.num}`);
    }

    // Calificación
    if (a.cal !== null && jTurnosId) {
      const [[calEx]] = await pool.query(
        `SELECT id FROM calificaciones_turno WHERE asignacion_id=?`, [asigId]
      );
      if (!calEx) {
        await pool.query(
          `INSERT INTO calificaciones_turno
             (empresa_id,asignacion_id,trabajador_id,calificacion,comentario,calificado_por)
           VALUES (?,?,?,?,?,?)`,
          [eId, asigId, tId, a.cal, a.com, jTurnosId]
        );
        ok(`  calificación ${a.cal}★ → ${turnosDefs[a.wIdx].nombre}`);
      }
    }
  }

  // Recalcular ranking de todos los trabajadores turnos
  for (const w of turnosWorkers) {
    await pool.query(`
      UPDATE trabajadores
      SET ranking = (
            SELECT AVG(calificacion) FROM calificaciones_turno WHERE trabajador_id = ?
          ),
          total_calificaciones = (
            SELECT COUNT(*) FROM calificaciones_turno WHERE trabajador_id = ?
          )
      WHERE id = ?
    `, [w.tId, w.tId, w.tId]);
  }
  ok('Rankings de trabajadores turnos actualizados');

  // ── 8. Eventos salientes logiq360 ────────────────────────────────────────
  section('8. Eventos salientes logiq360');

  const [[evOutCount]] = await pool.query(
    `SELECT COUNT(*) AS c FROM integration_events_out WHERE empresa_id=?`, [eId]
  );
  if (evOutCount.c > 0) {
    skip(`integration_events_out: ${evOutCount.c} eventos ya existen`);
  } else {
    const evOut = [
      { tipo:'trabajador.ingreso', ts:'2026-05-15 07:10:00', estado:'enviado',
        payload:{ alquiler_ref:'logiq360:alquiler:31', trabajador_ref:'logiq360:trabajador:201',
                  hora_ingreso:'2026-05-15T07:10:00-05:00', lat:4.6490, lon:-74.0938 } },
      { tipo:'trabajador.egreso',  ts:'2026-05-15 17:05:00', estado:'enviado',
        payload:{ alquiler_ref:'logiq360:alquiler:31', trabajador_ref:'logiq360:trabajador:201',
                  hora_egreso:'2026-05-15T17:05:00-05:00', horas_trabajadas:9.92, pago_total:93000 } },
      { tipo:'contrato.completado',ts:'2026-05-15 17:06:00', estado:'enviado',
        payload:{ alquiler_ref:'logiq360:alquiler:31', numero_contrato:'CD-2026-001',
                  trabajador_ref:'logiq360:trabajador:201', valor_dia:75000 } },
      { tipo:'trabajador.ingreso', ts:'2026-05-20 06:08:00', estado:'enviado',
        payload:{ alquiler_ref:'logiq360:alquiler:35', trabajador_ref:'logiq360:trabajador:201',
                  hora_ingreso:'2026-05-20T06:08:00-05:00', lat:4.7170, lon:-74.2053 } },
      { tipo:'trabajador.egreso',  ts:'2026-05-20 15:02:00', estado:'enviado',
        payload:{ alquiler_ref:'logiq360:alquiler:35', trabajador_ref:'logiq360:trabajador:201',
                  hora_egreso:'2026-05-20T15:02:00-05:00', horas_trabajadas:8.90, pago_total:89000 } },
      { tipo:'trabajador.egreso',  ts:'2026-05-27 13:08:00', estado:'fallido',
        payload:{ alquiler_ref:null, trabajador_ref:'logiq360:trabajador:201',
                  nota:'oferta manual sin alquiler_ref — descartado por lógica de negocio' } },
    ];
    for (const ev of evOut) {
      await pool.query(
        `INSERT INTO integration_events_out
           (empresa_id,event_id,tipo_evento,payload,estado,intentos,enviado_at,created_at)
         VALUES (?,?,?,?,?,?,?,?)`,
        [eId, randomUUID(), ev.tipo, JSON.stringify(ev.payload),
         ev.estado, ev.estado === 'enviado' ? 1 : 5,
         ev.estado === 'enviado' ? ev.ts : null, ev.ts]
      );
      ok(`evento_out ${ev.tipo} [${ev.estado}]`);
    }
  }

  // ── Resumen ──────────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   ✅  Seed completado — resumen de acceso            ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('\n  Contraseña de todos los usuarios: Test1234!\n');
  console.log('  NÓMINA ────────────────────────────────────────────');
  console.log('    jnomina@demo.com           jefe_nomina');
  console.log('    carlos.ruiz@demo.com       trabajador_nomina  (sueldo $1.5M)');
  console.log('    maria.gonzalez@demo.com    trabajador_nomina  (sueldo $1.5M)');
  console.log('    pedro.martinez@demo.com    trabajador_nomina  (sueldo $2.2M)');
  console.log('    luisa.vargas@demo.com      trabajador_nomina  (sueldo $1.8M)');
  console.log('\n  TURNOS ─────────────────────────────────────────────');
  console.log('    jturnos@demo.com               jefe_turnos');
  console.log('    diego.herrera@turnos.com       trabajador_turnos [logiq360:201]');
  console.log('    valentina.torres@turnos.com    trabajador_turnos [logiq360:202]');
  console.log('    andres.lopez@turnos.com        trabajador_turnos [logiq360:203]');
  console.log('    sofia.ramirez@turnos.com       trabajador_turnos [logiq360:204]');
  console.log('\n  PERÍODOS DE NÓMINA ─────────────────────────────────');
  console.log('    P1  2026-05-01 → 05-15   CERRADO  (con valor_hora_snapshot)');
  console.log('    P2  2026-05-16 → 05-31   ABIERTO');
  console.log('\n  TURNOS COMPLETADOS ─────────────────────────────────');
  console.log('    2026-05-15  Montaje Feria del Hogar     [logiq360:alquiler:31]');
  console.log('    2026-05-20  Operación Logística IKEA    [logiq360:alquiler:35]');
  console.log('    2026-05-27  Cargue Contenedor Terminal');
  console.log('\n  TURNO PRÓXIMO ──────────────────────────────────────');
  console.log('    2026-05-30  Montaje Evento Cultural TeatroCalle  [publicada]\n');

  await pool.end();
  process.exit(0);
}

main().catch(e => {
  console.error('❌', e.message);
  console.error(e.stack);
  process.exit(1);
});
