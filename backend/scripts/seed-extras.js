'use strict';

/**
 * Seed extras — datos de junio 2026 para pruebas en pantallas de nómina y turnos.
 * Uso: cd backend && node scripts/seed-extras.js
 *
 * Requiere seed-test-users.js + seed-datos-prueba.js ya corridos.
 * Idempotente: se puede correr más de una vez sin duplicar registros.
 *
 * Crea:
 *   - Período nómina P3 (2026-06-01→15, abierto) con 5 días de registros
 *     incluyendo turno festivo (Jun 4 = Corpus Christi) y nocturno
 *   - 11 ofertas de turno publicadas: 4 semana actual (Jun 3-6)
 *     + 7 semana próxima (Jun 8-13, incluyendo Jun 12 festivo Sagrado Corazón)
 *   - Postulaciones pendientes de Diego, Valentina, Andrés y Sofía
 *     para que el gestor pueda confirmarlas
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { pool } = require('../config/database');

function ok(msg)      { console.log(`  ✅ ${msg}`); }
function skip(msg)    { console.log(`  ⚠️  ${msg}`); }
function section(t)   { console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 50 - t.length))}`); }

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   Seed extras — nómina jun + turnos sem actual/prox  ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  try { await pool.query('SELECT 1'); ok('Base de datos conectada\n'); }
  catch (e) { console.error('❌ DB error:', e.message); process.exit(1); }

  // ── IDs base ──────────────────────────────────────────────────────────────

  const [[empresa]] = await pool.query(`SELECT id FROM empresas WHERE slug = 'empresa-demo'`);
  if (!empresa) {
    console.error('❌ Empresa Demo no encontrada. Corre seed-test-users.js primero.');
    process.exit(1);
  }
  const eId = empresa.id;

  const [[uJNomina]]  = await pool.query(`SELECT id FROM usuarios WHERE email='jnomina@demo.com'`);
  const [[uJTurnos]]  = await pool.query(`SELECT id FROM usuarios WHERE email='jturnos@demo.com'`);
  const jNominaId = uJNomina?.id;
  const jTurnosId = uJTurnos?.id;

  const [[cAux]]  = await pool.query(`SELECT id FROM cargos WHERE empresa_id IS NULL AND codigo='auxiliar'`);
  const [[cJefe]] = await pool.query(`SELECT id FROM cargos WHERE empresa_id IS NULL AND codigo='jefe_montaje'`);
  const [[cCond]] = await pool.query(`SELECT id FROM cargos WHERE empresa_id IS NULL AND codigo='conductor'`);
  if (!cAux || !cJefe || !cCond) {
    console.error('❌ Cargos del sistema no encontrados. Corre la migración 012 primero.');
    process.exit(1);
  }
  const [auxId, jefeId, condId] = [cAux.id, cJefe.id, cCond.id];

  // Trabajadores de nómina (4 de seed-datos-prueba.js)
  const nominaEmails = [
    'carlos.ruiz@demo.com',
    'maria.gonzalez@demo.com',
    'pedro.martinez@demo.com',
    'luisa.vargas@demo.com',
  ];
  const nominaIds = [];
  for (const email of nominaEmails) {
    const [[u]] = await pool.query(`SELECT id FROM usuarios WHERE email=?`, [email]);
    if (!u) { console.error(`❌ Usuario ${email} no encontrado`); process.exit(1); }
    const [[t]] = await pool.query(
      `SELECT id, salario_base FROM trabajadores WHERE empresa_id=? AND usuario_id=?`, [eId, u.id]
    );
    if (!t) { console.error(`❌ Trabajador ${email} no encontrado`); process.exit(1); }
    nominaIds.push({ tId: t.id, snapshot: parseFloat((t.salario_base / 240).toFixed(4)) });
  }

  // Trabajadores de turnos (4 del marketplace)
  const turnosEmails = {
    diego:     'diego.herrera@turnos.com',
    valentina: 'valentina.torres@turnos.com',
    andres:    'andres.lopez@turnos.com',
    sofia:     'sofia.ramirez@turnos.com',
  };
  const turnosIds = {};
  for (const [key, email] of Object.entries(turnosEmails)) {
    const [[u]] = await pool.query(`SELECT id FROM usuarios WHERE email=?`, [email]);
    const [[t]] = await pool.query(
      `SELECT id FROM trabajadores WHERE empresa_id=? AND usuario_id=?`, [eId, u.id]
    );
    turnosIds[key] = t.id;
  }

  // ── 1. Período P3: junio 2026 ─────────────────────────────────────────────
  section('1. Período nómina P3 (2026-06-01 → 06-15, abierto)');

  let periodo3Id;
  const [[p3Ex]] = await pool.query(
    `SELECT id FROM periodos_nomina WHERE empresa_id=? AND fecha_inicio='2026-06-01'`, [eId]
  );
  if (p3Ex) {
    periodo3Id = p3Ex.id;
    skip(`período P3 ya existe (id=${periodo3Id})`);
  } else {
    const [r] = await pool.query(
      `INSERT INTO periodos_nomina (empresa_id, fecha_inicio, fecha_fin, tipo, estado)
       VALUES (?, '2026-06-01', '2026-06-15', 'quincenal', 'abierto')`,
      [eId]
    );
    periodo3Id = r.insertId;
    ok(`período P3 creado (id=${periodo3Id})`);
  }

  // ── 2. Registros diarios P3 ───────────────────────────────────────────────
  section('2. Registros diarios P3 — jun 1-5');

  // Jun 4 = Corpus Christi (festivo Colombia 2026)
  const diasP3 = [
    { f:'2026-06-01', e:'07:00:00', s:'15:00:00', fest:0,
      ord:8.00, xd:0.00, xn:0.00, noc:0.00, fes:0.00 },
    { f:'2026-06-02', e:'07:00:00', s:'16:00:00', fest:0,
      ord:8.00, xd:1.00, xn:0.00, noc:0.00, fes:0.00 },  // 1h extra diurna
    { f:'2026-06-03', e:'07:00:00', s:'15:00:00', fest:0,
      ord:8.00, xd:0.00, xn:0.00, noc:0.00, fes:0.00 },
    { f:'2026-06-04', e:'07:00:00', s:'15:00:00', fest:1,
      ord:0.00, xd:0.00, xn:0.00, noc:0.00, fes:8.00 },  // Corpus Christi
    { f:'2026-06-05', e:'21:00:00', s:'05:00:00', fest:0,
      ord:0.00, xd:0.00, xn:2.00, noc:6.00, fes:0.00 },  // turno nocturno
  ];

  let regCreados = 0, regOmitidos = 0;
  for (const { tId, snapshot } of nominaIds) {
    for (const d of diasP3) {
      const [[ex]] = await pool.query(
        `SELECT id FROM registros_diarios WHERE empresa_id=? AND trabajador_id=? AND fecha=?`,
        [eId, tId, d.f]
      );
      if (ex) { regOmitidos++; continue; }
      await pool.query(
        `INSERT INTO registros_diarios
           (empresa_id, trabajador_id, periodo_id, fecha, hora_entrada, hora_salida,
            horas_ordinarias, horas_extra_diurnas, horas_extra_nocturnas,
            horas_nocturnas, horas_festivo, es_festivo, valor_hora_snapshot, aprobado_por)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [eId, tId, periodo3Id, d.f, d.e, d.s,
         d.ord, d.xd, d.xn, d.noc, d.fes, d.fest, snapshot, jNominaId]
      );
      regCreados++;
    }
  }
  if (regCreados)   ok(`${regCreados} registros diarios creados`);
  if (regOmitidos)  skip(`${regOmitidos} registros omitidos (ya existían)`);

  // ── 3. Ofertas de turno ───────────────────────────────────────────────────
  section('3. Ofertas de turno — semana actual (jun 3-6) y próxima (jun 8-13)');

  const ofertasDefs = [
    // ── Semana actual ────────────────────────────────────────────────────────
    {
      titulo: 'Desmontaje Feria Artesanal',
      desc:   'Retiro de stands y estructuras después de feria de artesanías',
      fecha:  '2026-06-03', hi: '06:00:00', hf: '14:00:00',
      lugar:  'Corferias, Bogotá', lat: 4.6488, lon: -74.0940,
      puestos: [{ cid: auxId, plazas: 3, tarifa: 72000, notas: null }],
    },
    {
      titulo: 'Montaje Stand Expo Tecnología',
      desc:   'Instalación de stand corporativo en exposición de tecnología',
      fecha:  '2026-06-04', hi: '08:00:00', hf: '18:00:00',
      lugar:  'Ágora Bogotá', lat: 4.6559, lon: -74.0944,
      puestos: [
        { cid: auxId,  plazas: 4, tarifa: 75000, notas: 'Carné de identidad para acceso' },
        { cid: jefeId, plazas: 1, tarifa: 150000, notas: 'Experiencia en eventos tech' },
      ],
    },
    {
      titulo: 'Operación Nocturna Bodega Norte',
      desc:   'Clasificación y almacenamiento de mercancía en turno nocturno',
      fecha:  '2026-06-05', hi: '22:00:00', hf: '06:00:00',
      lugar:  'Bodega Norte Bogotá', lat: 4.7432, lon: -74.0633,
      puestos: [
        { cid: auxId,  plazas: 2, tarifa: 85000, notas: 'Botas industriales requeridas' },
        { cid: condId, plazas: 1, tarifa: 120000, notas: null },
      ],
    },
    {
      titulo: 'Cargue Maquinaria Planta Soacha',
      desc:   'Cargue de maquinaria pesada en planta industrial de Soacha',
      fecha:  '2026-06-06', hi: '05:00:00', hf: '13:00:00',
      lugar:  'Zona Industrial Soacha', lat: 4.5778, lon: -74.2172,
      puestos: [
        { cid: auxId,  plazas: 3, tarifa: 78000, notas: 'Casco y chaleco reflectivo obligatorio' },
        { cid: condId, plazas: 1, tarifa: 115000, notas: 'Licencia C2 vigente' },
      ],
    },
    // ── Semana próxima ───────────────────────────────────────────────────────
    {
      titulo: 'Instalación Evento Corporativo Samsung',
      desc:   'Montaje de sala de presentaciones y stands para evento Samsung Colombia',
      fecha:  '2026-06-08', hi: '07:00:00', hf: '17:00:00',
      lugar:  'Centro Andino, Bogotá', lat: 4.6670, lon: -74.0527,
      puestos: [
        { cid: auxId,  plazas: 5, tarifa: 80000, notas: null },
        { cid: jefeId, plazas: 1, tarifa: 160000, notas: 'Inglés básico deseable' },
      ],
    },
    {
      titulo: 'Transporte Especial Aeropuerto El Dorado',
      desc:   'Traslado de carga sensible entre bodegas y terminal aérea',
      fecha:  '2026-06-08', hi: '04:00:00', hf: '12:00:00',
      lugar:  'Aeropuerto El Dorado, Bogotá', lat: 4.7016, lon: -74.1469,
      puestos: [
        { cid: condId, plazas: 2, tarifa: 130000, notas: 'Licencia C1, habilitación aeroportuaria' },
      ],
    },
    {
      titulo: 'Montaje Feria Inmobiliaria Nacional',
      desc:   'Instalación de módulos y acabados para feria del sector inmobiliario',
      fecha:  '2026-06-09', hi: '07:00:00', hf: '17:00:00',
      lugar:  'Plaza Mayor, Medellín', lat: 6.2209, lon: -75.5823,
      puestos: [
        { cid: auxId,  plazas: 6, tarifa: 78000, notas: null },
        { cid: jefeId, plazas: 1, tarifa: 155000, notas: null },
      ],
    },
    {
      titulo: 'Operación Logística Zona Franca Bogotá',
      desc:   'Recepción, clasificación y despacho de mercancía importada',
      fecha:  '2026-06-10', hi: '06:00:00', hf: '15:00:00',
      lugar:  'Zona Franca Bogotá, Funza', lat: 4.7168, lon: -74.2055,
      puestos: [
        { cid: auxId,  plazas: 4, tarifa: 80000, notas: 'Carné vigente para zona franca' },
        { cid: condId, plazas: 1, tarifa: 120000, notas: 'Entrada por portería 4' },
      ],
    },
    {
      titulo: 'Desmontaje Congreso Médico Internacional',
      desc:   'Retiro de equipos médicos y estructuras del congreso en WTC',
      fecha:  '2026-06-11', hi: '08:00:00', hf: '18:00:00',
      lugar:  'World Trade Center, Bogotá', lat: 4.6568, lon: -74.0535,
      puestos: [
        { cid: auxId,  plazas: 3, tarifa: 76000, notas: 'Manejo cuidadoso de equipos electrónicos' },
        { cid: jefeId, plazas: 1, tarifa: 152000, notas: null },
      ],
    },
    {
      titulo: 'Montaje Festival Gastronómico Usaquén',
      desc:   'Instalación de carpas, mobiliario y cocinas para festival de gastronomía',
      fecha:  '2026-06-12', hi: '07:00:00', hf: '20:00:00',  // festivo Sagrado Corazón
      lugar:  'Parque Usaquén, Bogotá', lat: 4.6961, lon: -74.0317,
      puestos: [
        { cid: auxId,  plazas: 8, tarifa: 95000,  notas: null },
        { cid: jefeId, plazas: 2, tarifa: 190000, notas: 'Experiencia en eventos masivos' },
        { cid: condId, plazas: 1, tarifa: 140000, notas: null },
      ],
    },
    {
      titulo: 'Logística Concierto Nocturno Movistar Arena',
      desc:   'Cargue de equipos de sonido, iluminación y tarima para concierto nocturno',
      fecha:  '2026-06-13', hi: '14:00:00', hf: '02:00:00',
      lugar:  'Movistar Arena, Bogotá', lat: 4.6445, lon: -74.0780,
      puestos: [
        { cid: auxId,  plazas: 6, tarifa: 88000,  notas: 'Ropa oscura obligatoria' },
        { cid: jefeId, plazas: 1, tarifa: 175000, notas: 'Experiencia en producción musical' },
        { cid: condId, plazas: 2, tarifa: 130000, notas: 'Vehículo propio o empresa' },
      ],
    },
  ];

  const ofertaIds  = [];
  const puestoMaps = [];

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
           (empresa_id, titulo, descripcion, fecha, hora_inicio, hora_fin_estimada,
            lugar, latitud, longitud, estado, creado_por)
         VALUES (?,?,?,?,?,?,?,?,?,'publicada',?)`,
        [eId, o.titulo, o.desc, o.fecha, o.hi, o.hf,
         o.lugar, o.lat, o.lon, jTurnosId]
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
          `INSERT INTO oferta_puestos (oferta_id, cargo_id, plazas, plazas_cubiertas, tarifa_dia, notas)
           VALUES (?,?,?,0,?,?)`,
          [oId, p.cid, p.plazas, p.tarifa, p.notas]
        );
        pMap[p.cid] = rp.insertId;
        ok(`  puesto cargo=${p.cid} plazas=${p.plazas} (id=${rp.insertId})`);
      }
    }
    puestoMaps.push(pMap);
  }

  // ── 4. Postulaciones pendientes ───────────────────────────────────────────
  section('4. Postulaciones pendientes para el gestor');

  // ofertaIdx → [{ trabajadorId, cargoId }]
  const postulaciones = [
    // Semana actual
    { oIdx: 0, tId: turnosIds.diego,     cid: auxId  },  // Jun 3 Feria Artesanal
    { oIdx: 0, tId: turnosIds.valentina, cid: auxId  },
    { oIdx: 1, tId: turnosIds.valentina, cid: auxId  },  // Jun 4 Expo Tecnología
    { oIdx: 1, tId: turnosIds.sofia,     cid: jefeId },
    { oIdx: 2, tId: turnosIds.andres,    cid: condId },  // Jun 5 Operación Nocturna
    // Semana próxima
    { oIdx: 4, tId: turnosIds.diego,     cid: auxId  },  // Jun 8 Samsung
    { oIdx: 4, tId: turnosIds.valentina, cid: auxId  },
    { oIdx: 4, tId: turnosIds.sofia,     cid: jefeId },
    { oIdx: 5, tId: turnosIds.andres,    cid: condId },  // Jun 8 Aeropuerto
    { oIdx: 6, tId: turnosIds.diego,     cid: auxId  },  // Jun 9 Feria Inmobiliaria
    { oIdx: 6, tId: turnosIds.valentina, cid: auxId  },
    { oIdx: 6, tId: turnosIds.sofia,     cid: jefeId },
    { oIdx: 7, tId: turnosIds.diego,     cid: auxId  },  // Jun 10 Zona Franca
    { oIdx: 7, tId: turnosIds.andres,    cid: condId },
    { oIdx: 9, tId: turnosIds.diego,     cid: auxId  },  // Jun 12 Festival Gastronómico (festivo)
    { oIdx: 9, tId: turnosIds.valentina, cid: auxId  },
    { oIdx: 9, tId: turnosIds.sofia,     cid: jefeId },
    { oIdx: 9, tId: turnosIds.andres,    cid: condId },
    { oIdx:10, tId: turnosIds.diego,     cid: auxId  },  // Jun 13 Concierto
    { oIdx:10, tId: turnosIds.valentina, cid: auxId  },
    { oIdx:10, tId: turnosIds.andres,    cid: condId },
    { oIdx:10, tId: turnosIds.sofia,     cid: jefeId },
  ];

  let postCreadas = 0, postOmitidas = 0;
  for (const p of postulaciones) {
    const oId = ofertaIds[p.oIdx];
    const pId = puestoMaps[p.oIdx][p.cid];
    if (!pId) { skip(`puesto cargo=${p.cid} no existe en oferta idx=${p.oIdx}`); continue; }

    const [[aEx]] = await pool.query(
      `SELECT id FROM asignaciones_turno WHERE oferta_id=? AND trabajador_id=?`, [oId, p.tId]
    );
    if (aEx) { postOmitidas++; continue; }

    await pool.query(
      `INSERT INTO asignaciones_turno
         (empresa_id, oferta_id, puesto_id, trabajador_id, estado)
       VALUES (?,?,?,?,'pendiente')`,
      [eId, oId, pId, p.tId]
    );
    await pool.query(
      `UPDATE oferta_puestos SET plazas_cubiertas = plazas_cubiertas + 1 WHERE id=?`, [pId]
    );
    postCreadas++;
  }
  if (postCreadas)  ok(`${postCreadas} postulaciones creadas (estado=pendiente)`);
  if (postOmitidas) skip(`${postOmitidas} postulaciones omitidas (ya existían)`);

  // ── Resumen ───────────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   ✅  Seed extras completado                         ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('\n  NÓMINA — Período P3 (2026-06-01 → 06-15, abierto)');
  console.log('    5 días de registros para los 4 trabajadores_nomina');
  console.log('    Jun 1: 8h ordinarias');
  console.log('    Jun 2: 8h ord + 1h extra diurna');
  console.log('    Jun 3: 8h ordinarias');
  console.log('    Jun 4: 8h festivo (Corpus Christi)');
  console.log('    Jun 5: turno nocturno (6h noc + 2h extra noct)');
  console.log('\n  TURNOS — 11 ofertas publicadas:');
  console.log('    Semana actual:');
  console.log('    Jun 3   Desmontaje Feria Artesanal         (2 postulantes)');
  console.log('    Jun 4   Montaje Stand Expo Tecnología      (2 postulantes)');
  console.log('    Jun 5   Operación Nocturna Bodega Norte    (1 postulante)');
  console.log('    Jun 6   Cargue Maquinaria Planta Soacha    (sin postulantes)');
  console.log('    Semana próxima:');
  console.log('    Jun 8   Instalación Evento Samsung         (3 postulantes)');
  console.log('    Jun 8   Transporte Especial Aeropuerto     (1 postulante)');
  console.log('    Jun 9   Montaje Feria Inmobiliaria         (3 postulantes)');
  console.log('    Jun 10  Operación Logística Zona Franca    (2 postulantes)');
  console.log('    Jun 11  Desmontaje Congreso Médico         (sin postulantes)');
  console.log('    Jun 12  Festival Gastronómico Usaquén [FESTIVO] (4 postulantes)');
  console.log('    Jun 13  Concierto Nocturno Movistar Arena  (4 postulantes)\n');

  await pool.end();
  process.exit(0);
}

main().catch(e => {
  console.error('❌', e.message);
  console.error(e.stack);
  process.exit(1);
});
