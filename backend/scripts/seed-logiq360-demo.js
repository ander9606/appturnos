'use strict';

/**
 * seed-logiq360-demo.js
 *
 * Datos de prueba que simulan el ciclo de vida completo de la integración
 * logiq360 → App Turnos. Auto-contenido: crea su propia empresa y usuarios.
 *
 * Uso:
 *   cd backend && node scripts/seed-logiq360-demo.js
 *
 * Escenarios creados:
 *  [1] BORRADOR   — Orden recién llegada de logiq360. Jefe aún no la publica.
 *  [2] PUBLICADA  — Publicada, trabajadores aplicaron, pendientes de confirmar.
 *  [3] EN_PROCESO — Hoy. Diego y Valentina marcaron ingreso (en sitio ahora).
 *  [4] CERRADA    — Todas las plazas cubiertas, sin más cupos.
 *  [5] COMPLETADA — Semana pasada. Asignaciones completadas con calificación.
 *  [6] CANCELADA  — Cancelada por logiq360 (orden.cancelada).
 *
 * Integración configurada (compatibles con npm run seed:plataforma-integracion en logiq360):
 *   incoming_secret  = 'in_secret_carpas_demo_hmac_789'  — logiq360 firma sus webhooks con este
 *   api_key          = 'lt_plataforma_demo_apikey_2024x'  — AppTurnos se autentica en logiq360
 *   webhook_secret   = 'hook_out_carpas_demo_secret_456'  — AppTurnos firma sus webhooks
 *   webhook_url      = LOGIQ360_WEBHOOK_URL || http://localhost:3000/api/integracion/eventos
 *
 * Credenciales (contraseña: Demo1234!):
 *   admin@plataforma-prueba.co      → admin_empresa
 *   jefe@plataforma-prueba.co       → jefe_turnos
 *   diego@turnos.co           → trabajador_turnos  (ranking 5.0 — ve ofertas al instante)
 *   valentina@turnos.co       → trabajador_turnos  (ranking 2.0 — delay 60 min)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const bcrypt          = require('bcrypt');
const { pool }        = require('../config/database');
const { randomUUID }  = require('crypto');

const SLUG     = 'plataforma-prueba';
const PASSWORD = 'Demo1234!';

// ── Helpers ──────────────────────────────────────────────────────────────────

function ok(msg)   { process.stdout.write(`  ✅  ${msg}\n`); }
function skip(msg) { process.stdout.write(`  ⚠️   ${msg}\n`); }
function section(t){ process.stdout.write(`\n── ${t} ${'─'.repeat(Math.max(0, 52 - t.length))}\n`); }

function d(offsetDays = 0) {
  const dt = new Date();
  dt.setDate(dt.getDate() + offsetDays);
  return dt.toISOString().slice(0, 10);
}
function ts(dateStr, time) { return `${dateStr} ${time}`; }

async function upsertEmpresa(nombre, slug, nit) {
  const [[ex]] = await pool.query('SELECT id FROM empresas WHERE slug=?', [slug]);
  if (ex) { skip(`empresa "${nombre}" ya existe (id=${ex.id})`); return ex.id; }
  await pool.query(
    `INSERT INTO empresas (nombre,slug,nit,ciudad,plan,acepta_postulaciones)
     VALUES (?,?,?,'Bogotá D.C.','profesional',1)`,
    [nombre, slug, nit]
  );
  ok(`empresa "${nombre}" creada (id=1)`);
  return 1;
}

async function upsertUsuario(eId, nombre, apellido, email, rol, hash) {
  const [[ex]] = await pool.query('SELECT id FROM usuarios WHERE email=?', [email]);
  if (ex) { skip(`usuario ${email} ya existe (id=${ex.id})`); return ex.id; }
  // turnos workers son marketplace (multi-empresa) → null; nomina workers son tenant-specific → eId
  const empresaId = rol === 'trabajador_nomina' ? eId : rol.startsWith('trabajador') ? null : eId;
  const [r] = await pool.query(
    `INSERT INTO usuarios (empresa_id,nombre,apellido,email,password_hash,rol,activo)
     VALUES (?,?,?,?,?,?,1)`,
    [empresaId, nombre, apellido, email, hash, rol]
  );
  ok(`usuario ${email} (${rol}) id=${r.insertId}`);
  return r.insertId;
}

async function upsertTrabajador(eId, uId, nombre, apellido, cedula, cargo, tarifaHora, ranking, externalRef) {
  const [[ex]] = await pool.query(
    'SELECT id FROM trabajadores WHERE empresa_id=? AND cedula=?', [eId, cedula]
  );
  if (ex) { skip(`trabajador ${nombre} ya existe (id=${ex.id})`); return ex.id; }
  const [r] = await pool.query(
    `INSERT INTO trabajadores
       (empresa_id,usuario_id,nombre,apellido,cedula,email,tipo,cargo,
        tarifa_hora,ranking,total_calificaciones,external_ref,activo)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1) `,
    [eId, uId, nombre, apellido, cedula, null, 'turnos', cargo,
     tarifaHora, ranking, ranking ? 3 : 0, externalRef]
  );
  ok(`trabajador ${nombre} ${apellido} (id=${r.insertId}, ranking=${ranking ?? 'null'})`);
  return r.insertId;
}

async function vincularTrabajador(uId, eId, tId) {
  const [[ex]] = await pool.query(
    'SELECT id FROM trabajador_empresa WHERE usuario_id=? AND empresa_id=?', [uId, eId]
  );
  if (ex) { skip(`vínculo usuario=${uId} empresa=${eId} ya existe`); return ex.id; }
  const [r] = await pool.query(
    `INSERT INTO trabajador_empresa (usuario_id,empresa_id,trabajador_id,estado,iniciado_por,fecha_resuelto)
     VALUES (?,?,?,'activo','empresa',NOW())`,
    [uId, eId, tId]
  );
  ok(`trabajador_empresa id=${r.insertId}`);
  return r.insertId;
}

async function asignarCargo(teId, cargoId, asignadoPor, nombre) {
  const [[ex]] = await pool.query(
    'SELECT id FROM trabajador_cargos WHERE trabajador_empresa_id=? AND cargo_id=?', [teId, cargoId]
  );
  if (ex) { skip(`cargo ya asignado`); return; }
  await pool.query(
    'INSERT INTO trabajador_cargos (trabajador_empresa_id,cargo_id,asignado_por) VALUES (?,?,?)',
    [teId, cargoId, asignadoPor]
  );
  ok(`cargo asignado (te=${teId}, cargo=${nombre})`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  process.stdout.write('\n╔═══════════════════════════════════════════════════════╗\n');
  process.stdout.write('║   Seed logiq360 demo — ciclo de vida completo         ║\n');
  process.stdout.write('╚═══════════════════════════════════════════════════════╝\n');

  try { await pool.query('SELECT 1'); ok('Base de datos conectada\n'); }
  catch (e) { process.stderr.write(`❌ DB: ${e.message}\n`); process.exit(1); }

  // ── 1. Empresa ──────────────────────────────────────────────────────────────
  section('1. Empresa');
  const eId = await upsertEmpresa('Plataforma de Prueba S.A.S', SLUG, '901234567-8');

  // ── 2. Usuarios ─────────────────────────────────────────────────────────────
  section('2. Usuarios');
  const hash = await bcrypt.hash(PASSWORD, 10);
  const adminId     = await upsertUsuario(eId, 'Andrés',    'Morales',  'admin@plataforma-prueba.co',    'admin_empresa',     hash);
  const jefeId      = await upsertUsuario(eId, 'Claudia',   'Restrepo', 'jefe@plataforma-prueba.co',     'jefe_turnos',       hash);
  const jNominaId   = await upsertUsuario(eId, 'Roberto',   'Salcedo',  'jnomina@plataforma-prueba.co',  'jefe_nomina',       hash);
  const uDiegoId    = await upsertUsuario(eId, 'Diego',     'Herrera',  'diego@turnos.co',         'trabajador_turnos', hash);
  const uValentinaId= await upsertUsuario(eId, 'Valentina', 'Torres',   'valentina@turnos.co',     'trabajador_turnos', hash);
  const uCarlosId   = await upsertUsuario(eId, 'Carlos',    'Ruiz',     'carlos@plataforma-prueba.co',   'trabajador_nomina', hash);
  const uMariaId    = await upsertUsuario(eId, 'María',     'González', 'maria@plataforma-prueba.co',    'trabajador_nomina', hash);
  const uAnaId      = await upsertUsuario(eId, 'Ana',       'Morales',  'ana@plataforma-prueba.co',      'trabajador_nomina', hash);
  const uPedroId    = await upsertUsuario(eId, 'Pedro',     'Martínez', 'pedro@plataforma-prueba.co',    'trabajador_nomina', hash);

  // ── 3. Cargos del sistema ────────────────────────────────────────────────────
  section('3. Cargos del sistema (migración 016)');
  const [[cAux]]  = await pool.query(`SELECT id FROM cargos WHERE empresa_id IS NULL AND codigo='auxiliar'`);
  const [[cJefe]] = await pool.query(`SELECT id FROM cargos WHERE empresa_id IS NULL AND codigo='jefe_montaje'`);
  const [[cCond]] = await pool.query(`SELECT id FROM cargos WHERE empresa_id IS NULL AND codigo='conductor'`);
  if (!cAux || !cJefe || !cCond) {
    process.stderr.write('❌ Cargos del sistema no encontrados. Corre las migraciones primero.\n');
    process.exit(1);
  }
  const [auxId, jefeMontajeId, condId] = [cAux.id, cJefe.id, cCond.id];
  ok(`auxiliar=${auxId}  jefe_montaje=${jefeMontajeId}  conductor=${condId}`);

  // ── 4. Trabajadores ──────────────────────────────────────────────────────────
  section('4. Trabajadores turnos');
  const tDiegoId     = await upsertTrabajador(eId, uDiegoId,    'Diego',     'Herrera', '3040506070', 'Auxiliar',         9375, 5.0, 'logiq360:trabajador:301');
  const tValentinaId = await upsertTrabajador(eId, uValentinaId,'Valentina', 'Torres',  '3040506071', 'Auxiliar',         9375, 2.0, 'logiq360:trabajador:302');

  const teD = await vincularTrabajador(uDiegoId,     eId, tDiegoId);
  const teV = await vincularTrabajador(uValentinaId, eId, tValentinaId);

  await asignarCargo(teD, auxId, adminId, 'auxiliar');
  await asignarCargo(teV, auxId, adminId, 'auxiliar');

  // ── 4b. Trabajadores nómina ──────────────────────────────────────────────────
  section('4b. Trabajadores nómina');

  const nominaDefs = [
    { uId: uCarlosId, nombre:'Carlos',  apellido:'Ruiz Pérez',     cedula:'4050607080', cargo:'Auxiliar de montaje',  salario:1_500_000 },
    { uId: uMariaId,  nombre:'María',   apellido:'González Díaz',  cedula:'4050607081', cargo:'Auxiliar logístico',   salario:1_600_000 },
    { uId: uAnaId,    nombre:'Ana',     apellido:'Morales Peña',   cedula:'4050607082', cargo:'Auxiliar logístico',   salario:1_600_000 },
    { uId: uPedroId,  nombre:'Pedro',   apellido:'Martínez Silva', cedula:'4050607083', cargo:'Jefe de montaje',      salario:2_200_000 },
  ];

  const nominaTIds = [];
  for (const w of nominaDefs) {
    const tarifa = parseFloat((w.salario / 240).toFixed(4));
    const [[tEx]] = await pool.query('SELECT id FROM trabajadores WHERE empresa_id=? AND cedula=?', [eId, w.cedula]);
    if (tEx) { skip(`trabajador ${w.nombre} (id=${tEx.id})`); nominaTIds.push({ tId: tEx.id, snapshot: tarifa }); continue; }
    const [r] = await pool.query(
      `INSERT INTO trabajadores (empresa_id,usuario_id,nombre,apellido,cedula,email,tipo,cargo,salario_base,tarifa_hora,activo)
       VALUES (?,?,?,?,?,?,'nomina',?,?,?,1)`,
      [eId, w.uId, w.nombre, w.apellido, w.cedula, `${w.nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')}@plataforma-prueba.co`, w.cargo, w.salario, tarifa]
    );
    ok(`trabajador ${w.nombre} ${w.apellido} (id=${r.insertId})`);
    nominaTIds.push({ tId: r.insertId, snapshot: tarifa });
  }

  // Períodos relativos a hoy para que siempre cubran la fecha actual
  const hoy   = new Date();
  const mes   = hoy.getMonth() + 1;
  const anio  = hoy.getFullYear();
  const mesA  = mes === 1 ? 12 : mes - 1;
  const anioA = mes === 1 ? anio - 1 : anio;
  const pad   = (n) => String(n).padStart(2, '0');

  const p1Inicio = `${anioA}-${pad(mesA)}-01`;
  const p1Fin    = `${anioA}-${pad(mesA)}-15`;
  const p2Inicio = `${anio}-${pad(mes)}-01`;
  const p2Fin    = `${anio}-${pad(mes)}-30`;

  // Período cerrado (mes anterior)
  let p1Id;
  const [[p1Ex]] = await pool.query(`SELECT id FROM periodos_nomina WHERE empresa_id=? AND fecha_inicio=?`, [eId, p1Inicio]);
  if (p1Ex) { p1Id = p1Ex.id; skip(`período cerrado ya existe (id=${p1Id})`); }
  else {
    const [r] = await pool.query(
      `INSERT INTO periodos_nomina (empresa_id,fecha_inicio,fecha_fin,tipo,estado) VALUES (?,?,?,'quincenal','cerrado')`,
      [eId, p1Inicio, p1Fin]
    );
    p1Id = r.insertId; ok(`período cerrado creado ${p1Inicio}→${p1Fin} (id=${p1Id})`);
  }

  // Período abierto (mes actual, cubre todo el mes para no quedar fuera de rango)
  let p2Id;
  const [[p2Ex]] = await pool.query(`SELECT id FROM periodos_nomina WHERE empresa_id=? AND fecha_inicio=?`, [eId, p2Inicio]);
  if (p2Ex) {
    p2Id = p2Ex.id;
    // Asegura que fecha_fin cubra hoy (puede haberse creado con fecha_fin pasada)
    await pool.query(`UPDATE periodos_nomina SET fecha_fin=? WHERE id=?`, [p2Fin, p2Id]);
    skip(`período abierto ya existe (id=${p2Id}) — fecha_fin actualizada a ${p2Fin}`);
  } else {
    const [r] = await pool.query(
      `INSERT INTO periodos_nomina (empresa_id,fecha_inicio,fecha_fin,tipo,estado) VALUES (?,?,?,'quincenal','abierto')`,
      [eId, p2Inicio, p2Fin]
    );
    p2Id = r.insertId; ok(`período abierto creado ${p2Inicio}→${p2Fin} (id=${p2Id})`);
  }

  // Registros diarios representativos (días fijos del mes anterior y primeros del actual)
  const diasP1 = [
    { f:`${anioA}-${pad(mesA)}-05`, e:'07:00:00', s:'15:00:00', fest:0, ord:8, xd:0, xn:0, noc:0, fes:0 },
    { f:`${anioA}-${pad(mesA)}-06`, e:'07:00:00', s:'16:00:00', fest:0, ord:8, xd:1, xn:0, noc:0, fes:0 },
    { f:`${anioA}-${pad(mesA)}-07`, e:'21:00:00', s:'05:00:00', fest:0, ord:0, xd:0, xn:2, noc:6, fes:0 },
    { f:`${anioA}-${pad(mesA)}-08`, e:'07:00:00', s:'15:00:00', fest:1, ord:0, xd:0, xn:0, noc:0, fes:8 },
  ];
  const diasP2 = [
    { f:`${anio}-${pad(mes)}-02`, e:'07:00:00', s:'15:00:00', fest:0, ord:8, xd:0, xn:0, noc:0, fes:0 },
    { f:`${anio}-${pad(mes)}-03`, e:'07:00:00', s:'16:00:00', fest:0, ord:8, xd:1, xn:0, noc:0, fes:0 },
  ];

  let regCreados = 0, regOmitidos = 0;
  for (const { tId, snapshot } of nominaTIds) {
    for (const [pId, dias] of [[p1Id, diasP1], [p2Id, diasP2]]) {
      for (const d of dias) {
        const [[ex]] = await pool.query(
          'SELECT id FROM registros_diarios WHERE empresa_id=? AND trabajador_id=? AND fecha=?', [eId, tId, d.f]
        );
        if (ex) { regOmitidos++; continue; }
        await pool.query(
          `INSERT INTO registros_diarios
             (empresa_id,trabajador_id,periodo_id,fecha,hora_entrada,hora_salida,
              horas_ordinarias,horas_extra_diurnas,horas_extra_nocturnas,
              horas_nocturnas,horas_festivo,es_festivo,valor_hora_snapshot,aprobado_por)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [eId, tId, pId, d.f, d.e, d.s, d.ord, d.xd, d.xn, d.noc, d.fes, d.fest, snapshot, jNominaId]
        );
        regCreados++;
      }
    }
  }
  if (regCreados)  ok(`${regCreados} registros diarios creados`);
  if (regOmitidos) skip(`${regOmitidos} registros omitidos`);

  // ── 5. Integración logiq360 ──────────────────────────────────────────────────
  section('5. Integración logiq360');
  const [[icEx]] = await pool.query('SELECT id FROM integracion_config WHERE empresa_id=?', [eId]);
  if (icEx) {
    skip('integracion_config ya existe');
  } else {
    const logiq360WebhookUrl = process.env.LOGIQ360_WEBHOOK_URL || 'http://localhost:3000/api/integracion/eventos';
    await pool.query(
      `INSERT INTO integracion_config
         (empresa_id,activo,webhook_url,webhook_secret,api_key,incoming_secret)
       VALUES (?,1,?,?,?,?)`,
      [eId,
       logiq360WebhookUrl,                          // logiq360 recibe eventos de AppTurnos aquí
       'hook_out_carpas_demo_secret_456',            // AppTurnos firma sus webhooks con este secreto
       'lt_plataforma_demo_apikey_2024x',            // AppTurnos usa este key al llamar a logiq360
       'in_secret_carpas_demo_hmac_789']             // logiq360 firma sus webhooks con este secreto
    );
    ok(`integracion_config (webhook_url=${logiq360WebhookUrl})`);
  }

  // ── 6. Ofertas — un escenario por estado ────────────────────────────────────
  section('6. Ofertas de turno');

  async function upsertOferta(o) {
    const [[ex]] = await pool.query(
      'SELECT id FROM ofertas_turno WHERE empresa_id=? AND titulo=? AND fecha=?',
      [eId, o.titulo, o.fecha]
    );
    if (ex) { skip(`oferta "${o.titulo}" ya existe (id=${ex.id})`); return ex.id; }
    const [r] = await pool.query(
      `INSERT INTO ofertas_turno
         (empresa_id,titulo,descripcion,fecha,hora_inicio,hora_fin_estimada,
          lugar,latitud,longitud,estado,external_ref,alquiler_ref,externo_notas,creado_por)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [eId, o.titulo, o.desc, o.fecha, o.hi, o.hf,
       o.lugar, o.lat, o.lon, o.estado, o.extRef, o.alqRef, o.extNotas, jefeId]
    );
    ok(`[${o.estado.toUpperCase().padEnd(10)}] "${o.titulo}" (id=${r.insertId})`);
    return r.insertId;
  }

  async function upsertPuesto(oId, cargoId, plazas, tarifaDia, notas) {
    const [[ex]] = await pool.query(
      'SELECT id FROM oferta_puestos WHERE oferta_id=? AND cargo_id=?', [oId, cargoId]
    );
    if (ex) { skip(`  puesto cargo=${cargoId} ya existe`); return ex.id; }
    const [r] = await pool.query(
      `INSERT INTO oferta_puestos (oferta_id,cargo_id,plazas,plazas_cubiertas,tarifa_dia,notas)
       VALUES (?,?,?,0,?,?)`,
      [oId, cargoId, plazas, tarifaDia, notas]
    );
    ok(`  puesto cargo=${cargoId}  ${plazas} plazas  $${tarifaDia.toLocaleString('es-CO')}/día`);
    return r.insertId;
  }

  // ── [1] BORRADOR — recién llegada de logiq360, jefe aún no la publica ─────
  const oBorradorId = await upsertOferta({
    titulo:   'Instalación Carpa IKEA — Zona Franca',
    desc:     'Montaje de los productos: 1× Carpa 12x12, 2× Mástil de tensado, 20× Ancla de suelo de la empresa Plataforma de Prueba S.A.S',
    fecha:    d(2), hi: '06:00:00', hf: '15:00:00',
    lugar:    'Zona Franca Bogotá — Av. Calle 26 #82-70',
    lat: 4.6890, lon: -74.1220,
    estado:   'borrador',
    extRef:   'logiq360:orden:301',
    alqRef:   'logiq360:alquiler:81',
    extNotas: 'Bodega zona franca. Usar chaleco reflectivo. Contacto: Sr. Torres 310-555-0101. Parqueadero disponible.',
  });
  // Puesto creado por el handler con tarifa 0 — el jefe decide tarifa y puede dividir
  await upsertPuesto(oBorradorId, auxId, 4, 0, 'Puesto generado por logiq360 — el jefe puede dividirlo por cargo');

  // ── [2] PUBLICADA — publicada, trabajadores aplicaron ─────────────────────
  const oPublicadaId = await upsertOferta({
    titulo:   'Desmontaje Feria Alimentaria — Corferias',
    desc:     'Montaje de los productos: 2× Carpa 6x9, 8× Mesa plegable, 40× Silla plástica de la empresa Plataforma de Prueba S.A.S',
    fecha:    d(4), hi: '07:00:00', hf: '16:00:00',
    lugar:    'Corferias, Cra 37 #24-67, Bogotá',
    lat: 4.6280, lon: -74.0905,
    estado:   'publicada',
    extRef:   'logiq360:orden:302',
    alqRef:   'logiq360:alquiler:82',
    extNotas: 'Llevar guantes de trabajo. Acceso por portería norte.',
  });
  const pAux82 = await upsertPuesto(oPublicadaId, auxId,        4, 78000, null);
  const pJefe82= await upsertPuesto(oPublicadaId, jefeMontajeId,1, 140000,'Experiencia coordinando equipos');

  // Aplicaciones pendientes de confirmar
  for (const [tId, pId, label] of [
    [tDiegoId,     pAux82,  'Diego → auxiliar'],
    [tValentinaId, pAux82,  'Valentina → auxiliar'],
  ]) {
    const [[aEx]] = await pool.query(
      'SELECT id FROM asignaciones_turno WHERE oferta_id=? AND trabajador_id=?', [oPublicadaId, tId]
    );
    if (aEx) { skip(`asignación ${label} ya existe`); continue; }
    await pool.query(
      `INSERT INTO asignaciones_turno (empresa_id,oferta_id,puesto_id,trabajador_id,estado)
       VALUES (?,?,?,?,'pendiente')`,
      [eId, oPublicadaId, pId, tId]
    );
    ok(`  asignación pendiente: ${label}`);
    await pool.query(
      'UPDATE oferta_puestos SET plazas_cubiertas = plazas_cubiertas + 1 WHERE id=?', [pId]
    );
  }

  // ── [3] EN_PROCESO — hoy, ambos trabajadores en sitio ─────────────────────
  const fechaHoy = d(0);
  const oEnProcesoId = await upsertOferta({
    titulo:   'Evento Corporativo Bancolombia — Parque 93',
    desc:     'Montaje de los productos: 1× Carpa VIP 8x8, 5× Panel decorativo, 20× Silla Tiffany de la empresa Plataforma de Prueba S.A.S',
    fecha:    fechaHoy, hi: '07:00:00', hf: '17:00:00',
    lugar:    'Parque 93 — Cl. 93 #13-33, Bogotá',
    lat: 4.6665, lon: -74.0536,
    estado:   'en_proceso',
    extRef:   'logiq360:orden:303',
    alqRef:   'logiq360:alquiler:83',
    extNotas: 'Uniforme: polo negro. Presentarse en portería norte.',
  });
  const pAux83 = await upsertPuesto(oEnProcesoId, auxId, 2, 95000, null);

  const ingresoHoy = ts(fechaHoy, '07:08:00');
  for (const [tId, lat, lon, label] of [
    [tDiegoId,     4.6666, -74.0535, 'Diego'],
    [tValentinaId, 4.6664, -74.0537, 'Valentina'],
  ]) {
    const [[aEx]] = await pool.query(
      'SELECT id FROM asignaciones_turno WHERE oferta_id=? AND trabajador_id=?', [oEnProcesoId, tId]
    );
    if (aEx) { skip(`asignación ${label} ya existe`); continue; }
    await pool.query(
      `INSERT INTO asignaciones_turno
         (empresa_id,oferta_id,puesto_id,trabajador_id,estado,hora_ingreso_real,latitud_ingreso,longitud_ingreso)
       VALUES (?,?,?,?,'en_progreso',?,?,?)`,
      [eId, oEnProcesoId, pAux83, tId, ingresoHoy, lat, lon]
    );
    ok(`  ${label} en sitio (ingreso ${ingresoHoy})`);
    await pool.query(
      'UPDATE oferta_puestos SET plazas_cubiertas = plazas_cubiertas + 1 WHERE id=?', [pAux83]
    );
  }

  // ── [4] CERRADA — todas las plazas cubiertas ────────────────────────────────
  const oCerradaId = await upsertOferta({
    titulo:   'Congreso Médico — Centro de Convenciones',
    desc:     'Montaje de stand médico para congreso de neumología.',
    fecha:    d(1), hi: '08:00:00', hf: '18:00:00',
    lugar:    'Centro de Convenciones, Bogotá',
    lat: 4.6097, lon: -74.0817,
    estado:   'cerrada',
    extRef:   null, alqRef: null, extNotas: null,
  });
  const pAux84 = await upsertPuesto(oCerradaId, auxId, 2, 85000, null);
  // Plazas cubiertas (sin asignaciones reales — solo simular estado visual)
  await pool.query(
    'UPDATE oferta_puestos SET plazas_cubiertas=2 WHERE id=?', [pAux84]
  );
  ok('  plazas_cubiertas = 2/2 (cerrada)');

  // ── [5] COMPLETADA — semana pasada, con calificaciones ─────────────────────
  const fechaCompleta = d(-7);
  const oCompletadaId = await upsertOferta({
    titulo:   'Montaje Stand Expo Belleza — Ágora',
    desc:     'Montaje de los productos: 1× Stand 3x3, 4× Panel divisor, 10× Spot LED de la empresa Plataforma de Prueba S.A.S',
    fecha:    fechaCompleta, hi: '06:00:00', hf: '15:00:00',
    lugar:    'Ágora Bogotá — Cl. 24 #38-47',
    lat: 4.6180, lon: -74.0878,
    estado:   'completada',
    extRef:   'logiq360:orden:300',
    alqRef:   'logiq360:alquiler:80',
    extNotas: null,
  });
  const pAux80 = await upsertPuesto(oCompletadaId, auxId, 2, 90000, null);

  const ingresoComp = ts(fechaCompleta, '06:05:00');
  const egresoComp  = ts(fechaCompleta, '15:10:00');
  for (const [tId, hrs, pago, cal, com, label] of [
    [tDiegoId,     9.08, 102150, 5, 'Puntual, buen trabajo en equipo',     'Diego'],
    [tValentinaId, 9.08, 102150, 4, 'Cumplió con las tareas satisfactoriamente', 'Valentina'],
  ]) {
    const [[aEx]] = await pool.query(
      'SELECT id FROM asignaciones_turno WHERE oferta_id=? AND trabajador_id=?', [oCompletadaId, tId]
    );
    let asigId;
    if (aEx) { asigId = aEx.id; skip(`asignación ${label} ya existe`); }
    else {
      const [r] = await pool.query(
        `INSERT INTO asignaciones_turno
           (empresa_id,oferta_id,puesto_id,trabajador_id,estado,
            hora_ingreso_real,hora_egreso_real,latitud_ingreso,longitud_ingreso,
            horas_trabajadas,pago_total)
         VALUES (?,?,?,?,'completado',?,?,4.6181,-74.0877,?,?)`,
        [eId, oCompletadaId, pAux80, tId, ingresoComp, egresoComp, hrs, pago]
      );
      asigId = r.insertId;
      ok(`  ${label} completado (${hrs}h, $${pago.toLocaleString('es-CO')})`);
      await pool.query(
        'UPDATE oferta_puestos SET plazas_cubiertas = plazas_cubiertas + 1 WHERE id=?', [pAux80]
      );
    }
    // Calificación
    const [[calEx]] = await pool.query(
      'SELECT id FROM calificaciones_turno WHERE asignacion_id=?', [asigId]
    );
    if (!calEx && jefeId) {
      await pool.query(
        `INSERT INTO calificaciones_turno
           (empresa_id,asignacion_id,trabajador_id,calificacion,comentario,calificado_por)
         VALUES (?,?,?,?,?,?)`,
        [eId, asigId, tId, cal, com, jefeId]
      );
      ok(`  calificación ${cal}★ → ${label}`);
    }
  }
  // Actualizar ranking
  for (const tId of [tDiegoId, tValentinaId]) {
    await pool.query(`
      UPDATE trabajadores
      SET ranking = (SELECT AVG(calificacion) FROM calificaciones_turno WHERE trabajador_id=?),
          total_calificaciones = (SELECT COUNT(*) FROM calificaciones_turno WHERE trabajador_id=?)
      WHERE id=?`, [tId, tId, tId]);
  }
  ok('  rankings actualizados');

  // ── [6] CANCELADA — cancelada por logiq360 ─────────────────────────────────
  const oCanceladaId = await upsertOferta({
    titulo:   'Evento Aire Libre — Cancelado por lluvia',
    desc:     null,
    fecha:    d(-1), hi: '09:00:00', hf: null,
    lugar:    'Parque Simón Bolívar, Bogotá',
    lat: 4.6578, lon: -74.0932,
    estado:   'cancelada',
    extRef:   'logiq360:orden:299',
    alqRef:   'logiq360:alquiler:79',
    extNotas: null,
  });
  await upsertPuesto(oCanceladaId, auxId, 3, 75000, null);

  // ── 7. Eventos entrantes (historial de lo que logiq360 envió) ───────────────
  section('7. Eventos entrantes de logiq360');

  const eventosIn = [
    { tipo:'orden.creada',    ts: d(-10)+' 09:00:00', estado:'procesado',
      payload:{ event_id: randomUUID(), external_ref:'logiq360:orden:300', alquiler_ref:'logiq360:alquiler:80',
                titulo:'Montaje Stand Expo Belleza — Ágora',
                fecha:d(-7), hora_inicio:'06:00', ubicacion:'Ágora Bogotá — Cl. 24 #38-47',
                cupos_sugeridos:2, valor_dia_sugerido:90000,
                productos_resumen:[
                  { cantidad:1, nombre:'Stand 3x3' },
                  { cantidad:4, nombre:'Panel divisor' },
                  { cantidad:10, nombre:'Spot LED' },
                ] } },
    { tipo:'orden.completada',ts: d(-7)+' 15:30:00', estado:'procesado',
      payload:{ external_ref:'logiq360:orden:300' } },

    { tipo:'orden.creada',    ts: d(-3)+' 10:00:00', estado:'procesado',
      payload:{ event_id: randomUUID(), external_ref:'logiq360:orden:299', alquiler_ref:'logiq360:alquiler:79',
                titulo:'Evento Aire Libre', fecha:d(-1), hora_inicio:'09:00',
                ubicacion:'Parque Simón Bolívar, Bogotá', cupos_sugeridos:3, valor_dia_sugerido:75000,
                productos_resumen:[
                  { cantidad:2, nombre:'Carpa 4x4' },
                  { cantidad:20, nombre:'Silla plástica' },
                ] } },
    { tipo:'orden.cancelada', ts: d(-2)+' 16:00:00', estado:'procesado',
      payload:{ external_ref:'logiq360:orden:299', motivo:'Cancelado por el cliente — pronóstico de lluvia' } },

    { tipo:'orden.creada',    ts: d(-1)+' 08:00:00', estado:'procesado',
      payload:{ event_id: randomUUID(), external_ref:'logiq360:orden:301', alquiler_ref:'logiq360:alquiler:81',
                titulo:'Instalación Carpa IKEA — Zona Franca',
                fecha:d(2), hora_inicio:'06:00', ubicacion:'Zona Franca Bogotá',
                latitud:4.6890, longitud:-74.1220,
                cupos_sugeridos:4, valor_dia_sugerido:0,
                notas_para_operario:'Bodega zona franca. Usar chaleco reflectivo. Contacto: Sr. Torres 310-555-0101.',
                productos_resumen:[
                  { cantidad:1, nombre:'Carpa 12x12' },
                  { cantidad:2, nombre:'Mástil de tensado' },
                  { cantidad:20, nombre:'Ancla de suelo' },
                ] } },

    { tipo:'orden.creada',    ts: d(0)+' 07:00:00', estado:'procesado',
      payload:{ event_id: randomUUID(), external_ref:'logiq360:orden:302', alquiler_ref:'logiq360:alquiler:82',
                titulo:'Desmontaje Feria Alimentaria', fecha:d(4), hora_inicio:'07:00',
                ubicacion:'Corferias, Bogotá', cupos_sugeridos:5, valor_dia_sugerido:80000,
                productos_resumen:[
                  { cantidad:2, nombre:'Carpa 6x9' },
                  { cantidad:8, nombre:'Mesa plegable' },
                  { cantidad:40, nombre:'Silla plástica' },
                ] } },
    { tipo:'orden.publicada', ts: d(0)+' 07:05:00', estado:'procesado',
      payload:{ external_ref:'logiq360:orden:302' } },

    { tipo:'orden.creada',    ts: d(-2)+' 06:00:00', estado:'procesado',
      payload:{ event_id: randomUUID(), external_ref:'logiq360:orden:303', alquiler_ref:'logiq360:alquiler:83',
                titulo:'Evento Corporativo Bancolombia', fecha:d(0), hora_inicio:'07:00',
                ubicacion:'Parque 93, Bogotá', cupos_sugeridos:2, valor_dia_sugerido:95000,
                productos_resumen:[
                  { cantidad:1, nombre:'Carpa VIP 8x8' },
                  { cantidad:5, nombre:'Panel decorativo' },
                  { cantidad:20, nombre:'Silla Tiffany' },
                ] } },
    { tipo:'orden.publicada', ts: d(-2)+' 06:05:00', estado:'procesado',
      payload:{ external_ref:'logiq360:orden:303' } },
  ];

  const [[evInCount]] = await pool.query(
    'SELECT COUNT(*) AS c FROM integration_events_in WHERE empresa_id=?', [eId]
  );
  if (evInCount.c > 0) {
    skip(`integration_events_in: ${evInCount.c} eventos ya existen`);
  } else {
    for (const ev of eventosIn) {
      await pool.query(
        `INSERT INTO integration_events_in
           (empresa_id,event_id,tipo_evento,payload,estado,procesado_at,created_at)
         VALUES (?,?,?,?,?,?,?)`,
        [eId, randomUUID(), ev.tipo, JSON.stringify(ev.payload), ev.estado, ev.ts, ev.ts]
      );
      ok(`evento_in  ${ev.tipo.padEnd(18)}  [${ev.estado}]`);
    }
  }

  // ── 8. Eventos salientes (lo que App Turnos notificó a logiq360) ────────────
  section('8. Eventos salientes hacia logiq360');

  const [[evOutCount]] = await pool.query(
    'SELECT COUNT(*) AS c FROM integration_events_out WHERE empresa_id=?', [eId]
  );
  if (evOutCount.c > 0) {
    skip(`integration_events_out: ${evOutCount.c} eventos ya existen`);
  } else {
    const eventosOut = [
      { tipo:'trabajador.ingreso', ts: ts(fechaCompleta,'06:05:00'), estado:'enviado',
        payload:{ alquiler_ref:'logiq360:alquiler:80', trabajador_ref:'logiq360:trabajador:301',
                  hora_ingreso:`${fechaCompleta}T06:05:00-05:00`, lat:4.6181, lon:-74.0877 } },
      { tipo:'trabajador.egreso',  ts: ts(fechaCompleta,'15:10:00'), estado:'enviado',
        payload:{ alquiler_ref:'logiq360:alquiler:80', trabajador_ref:'logiq360:trabajador:301',
                  hora_egreso:`${fechaCompleta}T15:10:00-05:00`, horas_trabajadas:9.08, pago_total:102150 } },
      { tipo:'trabajador.ingreso', ts: ts(fechaCompleta,'06:07:00'), estado:'enviado',
        payload:{ alquiler_ref:'logiq360:alquiler:80', trabajador_ref:'logiq360:trabajador:302',
                  hora_ingreso:`${fechaCompleta}T06:07:00-05:00`, lat:4.6182, lon:-74.0876 } },
      { tipo:'trabajador.egreso',  ts: ts(fechaCompleta,'15:13:00'), estado:'enviado',
        payload:{ alquiler_ref:'logiq360:alquiler:80', trabajador_ref:'logiq360:trabajador:302',
                  hora_egreso:`${fechaCompleta}T15:13:00-05:00`, horas_trabajadas:9.08, pago_total:102150 } },
      { tipo:'trabajador.ingreso', ts: ts(fechaHoy,'07:08:00'), estado:'enviado',
        payload:{ alquiler_ref:'logiq360:alquiler:83', trabajador_ref:'logiq360:trabajador:301',
                  hora_ingreso:`${fechaHoy}T07:08:00-05:00`, lat:4.6666, lon:-74.0535 } },
      { tipo:'trabajador.ingreso', ts: ts(fechaHoy,'07:09:00'), estado:'enviado',
        payload:{ alquiler_ref:'logiq360:alquiler:83', trabajador_ref:'logiq360:trabajador:302',
                  hora_ingreso:`${fechaHoy}T07:09:00-05:00`, lat:4.6664, lon:-74.0537 } },
    ];
    for (const ev of eventosOut) {
      await pool.query(
        `INSERT INTO integration_events_out
           (empresa_id,event_id,tipo_evento,payload,estado,intentos,enviado_at,created_at)
         VALUES (?,?,?,?,?,1,?,?)`,
        [eId, randomUUID(), ev.tipo, JSON.stringify(ev.payload), ev.estado, ev.ts, ev.ts]
      );
      ok(`evento_out ${ev.tipo.padEnd(20)} [${ev.estado}]`);
    }
  }

  // ── Resumen ──────────────────────────────────────────────────────────────────
  process.stdout.write('\n╔═══════════════════════════════════════════════════════════════╗\n');
  process.stdout.write('║   ✅  Seed completado                                         ║\n');
  process.stdout.write('╚═══════════════════════════════════════════════════════════════╝\n\n');
  process.stdout.write('  Contraseña de todos: Demo1234!\n\n');
  process.stdout.write('  USUARIOS ─────────────────────────────────────────────────────\n');
  process.stdout.write('    admin@plataforma-prueba.co        admin_empresa\n');
  process.stdout.write('    jefe@plataforma-prueba.co         jefe_turnos\n');
  process.stdout.write('    jnomina@plataforma-prueba.co      jefe_nomina\n');
  process.stdout.write('    diego@turnos.co                   trabajador_turnos  (ranking 5.0 ★★★★★)\n');
  process.stdout.write('    valentina@turnos.co               trabajador_turnos  (ranking 2.0 ★★☆☆☆)\n');
  process.stdout.write('    carlos@plataforma-prueba.co       trabajador_nomina  (Auxiliar de montaje)\n');
  process.stdout.write('    maria@plataforma-prueba.co        trabajador_nomina  (Auxiliar logístico)\n');
  process.stdout.write('    ana@plataforma-prueba.co          trabajador_nomina  (Auxiliar logístico)\n');
  process.stdout.write('    pedro@plataforma-prueba.co        trabajador_nomina  (Jefe de montaje)\n\n');
  process.stdout.write('  ESCENARIOS LOGIQ360 ──────────────────────────────────────────\n');
  process.stdout.write(`    [BORRADOR]    en ${d(2)}  Instalación Carpa IKEA            logiq360:orden:301\n`);
  process.stdout.write(`                  → jefe debe revisar puestos y publicar\n`);
  process.stdout.write(`    [PUBLICADA]   en ${d(4)}  Desmontaje Feria Alimentaria      logiq360:orden:302\n`);
  process.stdout.write(`                  → Diego y Valentina aplicaron (pendientes)\n`);
  process.stdout.write(`    [EN_PROCESO]  hoy        Evento Corporativo Bancolombia     logiq360:orden:303\n`);
  process.stdout.write(`                  → Diego y Valentina en sitio (ingreso marcado)\n`);
  process.stdout.write(`    [CERRADA]     en ${d(1)}  Congreso Médico                    (manual)\n`);
  process.stdout.write(`                  → plazas cubiertas, sin cupos disponibles\n`);
  process.stdout.write(`    [COMPLETADA]  el ${d(-7)}  Montaje Stand Expo Belleza        logiq360:orden:300\n`);
  process.stdout.write(`    [CANCELADA]   el ${d(-1)}  Evento Aire Libre                 logiq360:orden:299\n\n`);
  process.stdout.write('  INTEGRACIÓN ─────────────────────────────────────────────────\n');
  process.stdout.write('    incoming_secret: in_secret_carpas_demo_hmac_789\n');
  process.stdout.write('    (logiq360 firma sus webhooks con este secreto — HMAC per-tenant)\n\n');
  process.stdout.write('  PULL ENDPOINTS (usa header X-API-Key: in_secret_carpas_demo_hmac_789)\n');
  process.stdout.write('    GET /api/integracion/public/en-sitio/logiq360:orden:303\n');
  process.stdout.write('    GET /api/integracion/public/estado/logiq360:orden:302\n\n');

  await pool.end();
  process.exit(0);
}

main().catch(e => {
  process.stderr.write(`❌ ${e.message}\n${e.stack}\n`);
  process.exit(1);
});
