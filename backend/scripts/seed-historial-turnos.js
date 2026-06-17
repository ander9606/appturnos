'use strict';

/**
 * Seed: historial de turnos correspondiente a los alquileres 2025 de logiq360.
 *
 * Uso: cd backend && node scripts/seed-historial-turnos.js
 *
 * Requiere que seed-datos-prueba.js haya corrido antes (empresa-demo, trabajadores, cargos).
 * Idempotente: se puede correr múltiples veces sin duplicar registros.
 *
 * Crea:
 *   - 10 ofertas de turno en 2025 (8 completadas + 2 canceladas)
 *   - 24 asignaciones con ingreso/egreso, contratos y calificaciones
 *   - 10 eventos de integración entrantes (orden.creada desde logiq360)
 *   - 16 eventos de integración salientes (ingreso/egreso/contrato)
 *
 * Referencia alquileres logiq360 (seed_historial_alquileres.sql):
 *   14: Matrimonio Ospina-Castellanos
 *   15: Festival del Viento
 *   16: Baby Shower Valentina
 *   17: Convención Avicol
 *   18: Grado Externado
 *   19: Quinceañera Daniela
 *   20: Feria Quindío
 *   21: Cumple 50 años (CANCELADO)
 *   22: Clausura Montessori
 *   23: Navidad Corp (CANCELADO)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { pool }       = require('../config/database');
const { randomUUID } = require('crypto');

function ok(msg)      { console.log(`  ✅ ${msg}`); }
function skip(msg)    { console.log(`  ⚠️  ${msg}`); }
function section(t)   { console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 50 - t.length))}`); }

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   Seed historial de turnos — logiq360 2025           ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  try { await pool.query('SELECT 1'); ok('Base de datos conectada\n'); }
  catch (e) { console.error('❌ DB error:', e.message); process.exit(1); }

  // ── 0. IDs base ─────────────────────────────────────────────────────────────
  const [[empresa]] = await pool.query(`SELECT id FROM empresas WHERE slug = 'empresa-demo'`);
  if (!empresa) {
    console.error('❌ Empresa Demo no encontrada. Corre seed-datos-prueba.js primero.');
    process.exit(1);
  }
  const eId = empresa.id;
  console.log(`  ℹ️  empresa_id = ${eId}`);

  const [[cAux]]  = await pool.query(`SELECT id FROM cargos WHERE empresa_id IS NULL AND codigo='auxiliar'`);
  const [[cJefe]] = await pool.query(`SELECT id FROM cargos WHERE empresa_id IS NULL AND codigo='jefe_montaje'`);
  const [[cCond]] = await pool.query(`SELECT id FROM cargos WHERE empresa_id IS NULL AND codigo='conductor'`);
  if (!cAux || !cJefe || !cCond) {
    console.error('❌ Cargos del sistema no encontrados.');
    process.exit(1);
  }
  const [auxId, jefeId, condId] = [cAux.id, cJefe.id, cCond.id];
  console.log(`  ℹ️  cargos: auxiliar=${auxId}  jefe_montaje=${jefeId}  conductor=${condId}`);

  const [[uJTurnos]] = await pool.query(`SELECT id FROM usuarios WHERE email='jturnos@demo.com'`);
  const jTurnosId    = uJTurnos?.id;
  console.log(`  ℹ️  jefe_turnos id=${jTurnosId}`);

  // Trabajadores de turno del seed previo
  const trabajadores = {};
  for (const email of [
    'diego.herrera@turnos.com',
    'valentina.torres@turnos.com',
    'andres.lopez@turnos.com',
    'sofia.ramirez@turnos.com',
  ]) {
    const [[u]] = await pool.query(`SELECT id FROM usuarios WHERE email=?`, [email]);
    if (!u) {
      console.error(`❌ Usuario ${email} no encontrado. Corre seed-datos-prueba.js primero.`);
      process.exit(1);
    }
    const [[t]] = await pool.query(`SELECT id FROM trabajadores WHERE empresa_id=? AND usuario_id=?`, [eId, u.id]);
    if (!t) {
      console.error(`❌ Trabajador ${email} no encontrado en empresa ${eId}.`);
      process.exit(1);
    }
    trabajadores[email] = t.id;
  }
  const [diegoId, valentId, andresId, sofiaId] = [
    trabajadores['diego.herrera@turnos.com'],
    trabajadores['valentina.torres@turnos.com'],
    trabajadores['andres.lopez@turnos.com'],
    trabajadores['sofia.ramirez@turnos.com'],
  ];
  console.log(`  ℹ️  Diego=${diegoId}  Valentina=${valentId}  Andrés=${andresId}  Sofía=${sofiaId}\n`);

  // ── 1. Ofertas de turno ──────────────────────────────────────────────────────
  section('1. Ofertas de turno (8 completadas + 2 canceladas)');

  /**
   * ext_ref → ordenes_trabajo IDs creados en seed_historial_alquileres.sql (sección 4).
   *   A=24, B=26, C=28, D=30, E=32, F=34, G=36, H=38, I=39, J=41
   * alq_ref → alquileres IDs del mismo seed (14-23 según dump base).
   */
  const ofertasDefs = [
    // ── A: Matrimonio Ospina-Castellanos (16-17 mayo 2025) ──────────────────
    {
      titulo: 'Montaje Matrimonio Ospina-Castellanos',
      desc:   'Instalación de 2 carpas P10 con iluminación perimetral para ceremonia y recepción',
      fecha:  '2025-05-16', hi: '07:00:00', hf: '17:00:00',
      lugar:  'Hacienda Villa del Río, Vía Montenegro Km 8, Armenia',
      lat: 4.5291, lon: -75.6745, estado: 'completada',
      ext_ref: 'logiq360:orden:24', alq_ref: 'logiq360:alquiler:14',
      ext_notas: 'Montaje para 200 personas. Carpa doble con pasillo central. Zona de parqueo disponible.',
      puestos: [
        { cid: auxId,  plazas: 3, tarifa: 75000,  notas: 'Uniforme empresa obligatorio' },
        { cid: condId, plazas: 1, tarifa: 120000, notas: 'Licencia vigente requerida' },
      ],
    },
    // ── B: Festival del Viento (20-22 jun 2025) ─────────────────────────────
    {
      titulo: 'Operación Festival del Viento 2025',
      desc:   'Montaje de 3 carpas independientes para evento musical al aire libre',
      fecha:  '2025-06-20', hi: '06:00:00', hf: '18:00:00',
      lugar:  'Parque Central, Carrera 3 #10-50, Pereira',
      lat: 4.8133, lon: -75.6961, estado: 'completada',
      ext_ref: 'logiq360:orden:26', alq_ref: 'logiq360:alquiler:15',
      ext_notas: '3 carpas, capacidad 500 personas. 2 equipos independientes.',
      puestos: [
        { cid: auxId,  plazas: 3, tarifa: 80000,  notas: null },
        { cid: jefeId, plazas: 1, tarifa: 155000, notas: 'Coordinar equipos simultáneos' },
      ],
    },
    // ── C: Baby Shower Valentina (5 jul 2025) ────────────────────────────────
    {
      titulo: 'Montaje Baby Shower Valentina',
      desc:   'Instalación de parasol en jardín de finca para evento íntimo',
      fecha:  '2025-07-05', hi: '09:00:00', hf: '15:00:00',
      lugar:  'Vereda Carrasquilla, Casa Finca Los Pinos, Tenjo',
      lat: 4.8685, lon: -74.1493, estado: 'completada',
      ext_ref: 'logiq360:orden:28', alq_ref: 'logiq360:alquiler:16',
      ext_notas: 'Evento para 40 personas. Acceso por camino destapado.',
      puestos: [
        { cid: auxId, plazas: 2, tarifa: 70000, notas: null },
      ],
    },
    // ── D: Convención Avicol (21-24 ago 2025) ────────────────────────────────
    {
      titulo: 'Montaje Convención Avicol 2025',
      desc:   'Instalación de 2 carpas con iluminación para convención empresarial de 300 personas',
      fecha:  '2025-08-21', hi: '07:00:00', hf: '17:00:00',
      lugar:  'Centro Empresarial Parque Andino, Bogotá',
      lat: 4.6799, lon: -74.0523, estado: 'completada',
      ext_ref: 'logiq360:orden:30', alq_ref: 'logiq360:alquiler:17',
      ext_notas: 'Montaje previo al evento. Equipo completo de 4 operarios. Carnet de acceso en portería.',
      puestos: [
        { cid: auxId,  plazas: 2, tarifa: 80000,  notas: null },
        { cid: condId, plazas: 1, tarifa: 120000, notas: null },
        { cid: jefeId, plazas: 1, tarifa: 155000, notas: 'Coordinar con administrador del centro' },
      ],
    },
    // ── E: Grado Externado (5-7 sep 2025) ────────────────────────────────────
    {
      titulo: 'Montaje Ceremonia de Grados Externado',
      desc:   'Carpa para ceremonia de grado nocturna en campus universitario',
      fecha:  '2025-09-05', hi: '14:00:00', hf: '22:00:00',
      lugar:  'Campus Universitario Externado, Cancha Principal, Bogotá',
      lat: 4.6087, lon: -74.0689, estado: 'completada',
      ext_ref: 'logiq360:orden:32', alq_ref: 'logiq360:alquiler:18',
      ext_notas: 'Montaje tarde para ceremonia nocturna. Acceso vehicular hasta las 14h.',
      puestos: [
        { cid: auxId, plazas: 2, tarifa: 75000, notas: 'Turno tarde-noche' },
      ],
    },
    // ── F: Quinceañera Daniela (10-12 oct 2025) ──────────────────────────────
    {
      titulo: 'Montaje Quinceañera Daniela Ruiz',
      desc:   'Carpa principal y parasol de zona de mesas para fiesta de 150 personas',
      fecha:  '2025-10-10', hi: '08:00:00', hf: '18:00:00',
      lugar:  'Finca La Esperanza, Vía Palmira Km 3, Cali',
      lat: 3.4516, lon: -76.5320, estado: 'completada',
      ext_ref: 'logiq360:orden:34', alq_ref: 'logiq360:alquiler:19',
      ext_notas: 'Finca con acceso por vía destapada. Llevar vehículo adecuado.',
      puestos: [
        { cid: auxId,  plazas: 2, tarifa: 75000,  notas: null },
        { cid: condId, plazas: 1, tarifa: 120000, notas: 'Vehículo doble tracción recomendado' },
      ],
    },
    // ── G: Feria Quindío (13-16 nov 2025) ────────────────────────────────────
    {
      titulo: 'Operación Feria Empresarial Quindío 2025',
      desc:   '4 carpas P10 para stands de exposición. 2 días de montaje previo.',
      fecha:  '2025-11-13', hi: '06:00:00', hf: '18:00:00',
      lugar:  'Recinto del Pensamiento, Manizales',
      lat: 5.0688, lon: -75.5174, estado: 'completada',
      ext_ref: 'logiq360:orden:36', alq_ref: 'logiq360:alquiler:20',
      ext_notas: 'Operación grande: 4 equipos simultáneos. Coordinación en sitio.',
      puestos: [
        { cid: auxId,  plazas: 3, tarifa: 80000,  notas: 'Turno extendido 12h' },
        { cid: condId, plazas: 1, tarifa: 125000, notas: null },
        { cid: jefeId, plazas: 1, tarifa: 160000, notas: 'Liderar 4 equipos en paralelo' },
      ],
    },
    // ── H: Cumpleaños 50 años (CANCELADO — permiso denegado) ─────────────────
    {
      titulo: 'Montaje Cumpleaños 50 Años Ospina',
      desc:   'Parasol en terraza de edificio para evento íntimo',
      fecha:  '2025-11-29', hi: '09:00:00', hf: '15:00:00',
      lugar:  'Apartamento PH, Cra 15 #85-20, Bogotá',
      lat: 4.6660, lon: -74.0575, estado: 'cancelada',
      ext_ref: 'logiq360:orden:38', alq_ref: 'logiq360:alquiler:21',
      ext_notas: 'CANCELADO: administración del edificio negó el permiso para la terraza.',
      puestos: [
        { cid: auxId, plazas: 1, tarifa: 70000, notas: null },
      ],
    },
    // ── I: Clausura Montessori (5-7 dic 2025) ────────────────────────────────
    {
      titulo: 'Montaje Clausura Escuela Montessori',
      desc:   'Carpa con iluminación y contrapesos en cancha de concreto',
      fecha:  '2025-12-05', hi: '07:30:00', hf: '16:30:00',
      lugar:  'Colegio Montessori La Arboleda, Calle 18 #9-30, Zipaquirá',
      lat: 5.0225, lon: -74.0065, estado: 'completada',
      ext_ref: 'logiq360:orden:39', alq_ref: 'logiq360:alquiler:22',
      ext_notas: 'Contrapesos requeridos por piso de concreto. Evento escolar.',
      puestos: [
        { cid: auxId,  plazas: 2, tarifa: 75000,  notas: null },
        { cid: jefeId, plazas: 1, tarifa: 150000, notas: null },
      ],
    },
    // ── J: Navidad Corp (CANCELADO — presupuesto recortado) ──────────────────
    {
      titulo: 'Montaje Cena Navidad Corporativa Herrera',
      desc:   'Carpa P10 para cena navideña en jardín de club',
      fecha:  '2025-12-19', hi: '08:00:00', hf: '16:00:00',
      lugar:  'Club Los Lagartos, Salón Jardín, Bogotá',
      lat: 4.6762, lon: -74.0538, estado: 'cancelada',
      ext_ref: 'logiq360:orden:41', alq_ref: 'logiq360:alquiler:23',
      ext_notas: 'CANCELADO 10 días antes: recorte de presupuesto navideño.',
      puestos: [
        { cid: auxId,  plazas: 2, tarifa: 75000,  notas: null },
        { cid: condId, plazas: 1, tarifa: 120000, notas: null },
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
           (empresa_id,titulo,descripcion,fecha,hora_inicio,hora_fin_estimada,
            lugar,latitud,longitud,estado,external_ref,alquiler_ref,externo_notas,creado_por)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [eId, o.titulo, o.desc, o.fecha, o.hi, o.hf,
         o.lugar, o.lat, o.lon, o.estado, o.ext_ref, o.alq_ref, o.ext_notas, jTurnosId]
      );
      oId = r.insertId;
      ok(`oferta "${o.titulo}" [${o.estado}] (id=${oId})`);
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
        ok(`  puesto cargo=${p.cid} @${p.tarifa.toLocaleString('es-CO')} (id=${rp.insertId})`);
      }
    }
    puestoMaps.push(pMap);
  }

  // ── 2. Asignaciones, contratos y calificaciones ──────────────────────────────
  section('2. Asignaciones y contratos (solo ofertas completadas)');

  /**
   * oIdx  → índice en ofertasDefs
   * tId   → trabajador_id
   * cid   → cargo_id (para buscar el puesto correcto)
   * tarifa→ tarifa_dia del puesto
   * hi/he → hora ingreso / egreso reales
   * hrs   → horas trabajadas (decimal)
   * pago  → pago_total calculado ≈ tarifa_dia (día completo)
   * num   → número de contrato
   * cal   → calificación (1-5) o null si no aplica
   * com   → comentario calificación
   */
  const asigs = [
    // ── A: Matrimonio Ospina (mayo 16) ────────────────────────────────────────
    { oIdx:0, tId:diegoId,   cid:auxId,  tarifa:75000,
      hi:'2025-05-16 07:08:00', he:'2025-05-16 17:12:00',
      lat:4.5293, lon:-75.6743, hrs:10.07, pago:75000, num:'CD-2025-001',
      cal:5, com:'Montaje perfecto. Muy puntual y prolijo con los detalles.' },
    { oIdx:0, tId:valentId,  cid:auxId,  tarifa:75000,
      hi:'2025-05-16 07:15:00', he:'2025-05-16 17:05:00',
      lat:4.5292, lon:-75.6744, hrs:9.83, pago:75000, num:'CD-2025-002',
      cal:4, com:'Buen trabajo. Cumplió todas las instrucciones.' },
    { oIdx:0, tId:andresId,  cid:condId, tarifa:120000,
      hi:'2025-05-16 06:50:00', he:'2025-05-16 17:20:00',
      lat:4.5290, lon:-75.6747, hrs:10.50, pago:120000, num:'CD-2025-003',
      cal:5, com:'Excelente conductor. Maniobró perfecto en espacio reducido.' },

    // ── B: Festival Viento (jun 20) ────────────────────────────────────────────
    { oIdx:1, tId:diegoId,   cid:auxId,  tarifa:80000,
      hi:'2025-06-20 06:05:00', he:'2025-06-20 18:10:00',
      lat:4.8135, lon:-75.6959, hrs:12.08, pago:96000, num:'CD-2025-004',
      cal:5, com:'Turno extendido, excelente disposición y resistencia.' },
    { oIdx:1, tId:valentId,  cid:auxId,  tarifa:80000,
      hi:'2025-06-20 06:10:00', he:'2025-06-20 18:05:00',
      lat:4.8134, lon:-75.6960, hrs:11.92, pago:95000, num:'CD-2025-005',
      cal:4, com:'Cumplió con el turno extendido sin quejas.' },
    { oIdx:1, tId:sofiaId,   cid:jefeId, tarifa:155000,
      hi:'2025-06-20 05:55:00', he:'2025-06-20 18:20:00',
      lat:4.8132, lon:-75.6962, hrs:12.42, pago:193125, num:'CD-2025-006',
      cal:5, com:'Coordinación impecable de 3 equipos en simultáneo.' },

    // ── C: Baby Shower (jul 5) ─────────────────────────────────────────────────
    { oIdx:2, tId:diegoId,   cid:auxId, tarifa:70000,
      hi:'2025-07-05 09:05:00', he:'2025-07-05 14:55:00',
      lat:4.8687, lon:-74.1491, hrs:5.83, pago:70000, num:'CD-2025-007',
      cal:5, com:'Llegó con tiempo, trabajo limpio y ordenado.' },
    { oIdx:2, tId:valentId,  cid:auxId, tarifa:70000,
      hi:'2025-07-05 09:10:00', he:'2025-07-05 15:00:00',
      lat:4.8686, lon:-74.1492, hrs:5.83, pago:70000, num:'CD-2025-008',
      cal:5, com:'Muy amable con los anfitriones. Gran actitud.' },

    // ── D: Convención Avicol (ago 21) ─────────────────────────────────────────
    { oIdx:3, tId:diegoId,   cid:auxId,  tarifa:80000,
      hi:'2025-08-21 07:10:00', he:'2025-08-21 17:15:00',
      lat:4.6801, lon:-74.0521, hrs:10.08, pago:80000, num:'CD-2025-009',
      cal:4, com:'Buen trabajo en espacio corporativo.' },
    { oIdx:3, tId:valentId,  cid:auxId,  tarifa:80000,
      hi:'2025-08-21 07:05:00', he:'2025-08-21 17:10:00',
      lat:4.6800, lon:-74.0522, hrs:10.08, pago:80000, num:'CD-2025-010',
      cal:4, com:null },
    { oIdx:3, tId:andresId,  cid:condId, tarifa:120000,
      hi:'2025-08-21 06:50:00', he:'2025-08-21 17:30:00',
      lat:4.6798, lon:-74.0525, hrs:10.67, pago:120000, num:'CD-2025-011',
      cal:5, com:'Manejo perfecto del camión en sótano de parqueo.' },
    { oIdx:3, tId:sofiaId,   cid:jefeId, tarifa:155000,
      hi:'2025-08-21 07:00:00', he:'2025-08-21 17:00:00',
      lat:4.6799, lon:-74.0523, hrs:10.00, pago:155000, num:'CD-2025-012',
      cal:5, com:'Coordinación ejemplar. Cliente muy satisfecho.' },

    // ── E: Grado Externado (sep 5) ────────────────────────────────────────────
    { oIdx:4, tId:diegoId,   cid:auxId, tarifa:75000,
      hi:'2025-09-05 14:10:00', he:'2025-09-05 22:05:00',
      lat:4.6089, lon:-74.0687, hrs:7.92, pago:75000, num:'CD-2025-013',
      cal:4, com:'Excelente pese al turno nocturno.' },
    { oIdx:4, tId:valentId,  cid:auxId, tarifa:75000,
      hi:'2025-09-05 14:15:00', he:'2025-09-05 22:00:00',
      lat:4.6088, lon:-74.0688, hrs:7.75, pago:75000, num:'CD-2025-014',
      cal:4, com:null },

    // ── F: Quinceañera Daniela (oct 10) ───────────────────────────────────────
    { oIdx:5, tId:valentId,  cid:auxId,  tarifa:75000,
      hi:'2025-10-10 08:05:00', he:'2025-10-10 18:00:00',
      lat:3.4518, lon:-76.5318, hrs:9.92, pago:75000, num:'CD-2025-015',
      cal:5, com:'Perfecta actitud con el cliente, entorno social.' },
    { oIdx:5, tId:andresId,  cid:condId, tarifa:120000,
      hi:'2025-10-10 07:50:00', he:'2025-10-10 18:10:00',
      lat:3.4514, lon:-76.5322, hrs:10.33, pago:120000, num:'CD-2025-016',
      cal:5, com:'Manejó impecable por vía destapada.' },

    // ── G: Feria Quindío (nov 13) ─────────────────────────────────────────────
    { oIdx:6, tId:diegoId,   cid:auxId,  tarifa:80000,
      hi:'2025-11-13 06:02:00', he:'2025-11-13 18:05:00',
      lat:5.0690, lon:-75.5172, hrs:12.05, pago:96000, num:'CD-2025-017',
      cal:5, com:'Increíble resistencia en turno de 12 horas.' },
    { oIdx:6, tId:valentId,  cid:auxId,  tarifa:80000,
      hi:'2025-11-13 06:08:00', he:'2025-11-13 18:02:00',
      lat:5.0689, lon:-75.5173, hrs:11.90, pago:95000, num:'CD-2025-018',
      cal:4, com:'Muy buena en operación grande.' },
    { oIdx:6, tId:andresId,  cid:condId, tarifa:125000,
      hi:'2025-11-13 05:55:00', he:'2025-11-13 18:10:00',
      lat:5.0687, lon:-75.5176, hrs:12.25, pago:125000, num:'CD-2025-019',
      cal:5, com:'Logística de transporte perfecta para 4 carpas.' },
    { oIdx:6, tId:sofiaId,   cid:jefeId, tarifa:160000,
      hi:'2025-11-13 06:00:00', he:'2025-11-13 18:00:00',
      lat:5.0688, lon:-75.5174, hrs:12.00, pago:160000, num:'CD-2025-020',
      cal:5, com:'Mejor coordinación de operación grande que hemos tenido.' },

    // ── I: Clausura Montessori (dic 5) ────────────────────────────────────────
    { oIdx:8, tId:diegoId,   cid:auxId,  tarifa:75000,
      hi:'2025-12-05 07:35:00', he:'2025-12-05 16:28:00',
      lat:5.0227, lon:-74.0063, hrs:8.88, pago:75000, num:'CD-2025-021',
      cal:5, com:'Muy cuidadoso con el entorno escolar.' },
    { oIdx:8, tId:sofiaId,   cid:jefeId, tarifa:150000,
      hi:'2025-12-05 07:30:00', he:'2025-12-05 16:30:00',
      lat:5.0225, lon:-74.0065, hrs:9.00, pago:150000, num:'CD-2025-022',
      cal:5, com:'Profesionalismo total con comunidad educativa.' },
  ];

  const turnosDefs = ['Diego', 'Valentina', 'Andrés', 'Sofía'];
  const turnosIds  = [diegoId, valentId, andresId, sofiaId];

  for (const a of asigs) {
    const oId = ofertaIds[a.oIdx];
    const pId = puestoMaps[a.oIdx][a.cid];

    const [[aEx]] = await pool.query(
      `SELECT id FROM asignaciones_turno WHERE oferta_id=? AND trabajador_id=?`, [oId, a.tId]
    );
    let asigId;
    if (aEx) {
      asigId = aEx.id;
      skip(`asignacion oferta=${oId} trabajador=${a.tId}`);
    } else {
      const [r] = await pool.query(
        `INSERT INTO asignaciones_turno
           (empresa_id,oferta_id,puesto_id,trabajador_id,estado,
            hora_ingreso_real,hora_egreso_real,latitud_ingreso,longitud_ingreso,
            horas_trabajadas,pago_total)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [eId, oId, pId, a.tId, 'completado',
         a.hi, a.he, a.lat, a.lon, a.hrs, a.pago]
      );
      asigId = r.insertId;
      const nombre = turnosDefs[turnosIds.indexOf(a.tId)] ?? `id=${a.tId}`;
      ok(`asignacion id=${asigId} (${nombre}, oferta idx=${a.oIdx})`);

      await pool.query(
        `UPDATE oferta_puestos SET plazas_cubiertas = plazas_cubiertas + 1 WHERE id=?`, [pId]
      );
    }

    // Contrato
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
          [eId, asigId, a.tId, a.cal, a.com, jTurnosId]
        );
        ok(`  calificación ${a.cal}★`);
      }
    }
  }

  // Recalcular rankings
  for (const tId of [diegoId, valentId, andresId, sofiaId]) {
    await pool.query(`
      UPDATE trabajadores
      SET ranking = (SELECT AVG(calificacion) FROM calificaciones_turno WHERE trabajador_id = ?),
          total_calificaciones = (SELECT COUNT(*) FROM calificaciones_turno WHERE trabajador_id = ?)
      WHERE id = ?
    `, [tId, tId, tId]);
  }
  ok('Rankings actualizados');

  // ── 3. Eventos de integración ────────────────────────────────────────────────
  section('3. Eventos de integración (entrantes + salientes)');

  const [[evInCount]] = await pool.query(
    `SELECT COUNT(*) AS c FROM integration_events_in WHERE empresa_id=? AND tipo_evento LIKE '%orden%' AND created_at < '2026-01-01'`,
    [eId]
  );

  if (evInCount.c >= 10) {
    skip(`integration_events_in: ${evInCount.c} eventos 2025 ya existen`);
  } else {
    const evIn = [
      { tipo:'orden.creada',    ts:'2025-05-13 09:00:00', alq:14,
        payload:{ alquiler_id:14, titulo:'Montaje Matrimonio Ospina-Castellanos',
          fecha:'2025-05-16', hora_inicio:'07:00', lugar:'Hacienda Villa del Río, Armenia',
          puestos:[{cargo:'auxiliar',plazas:3,tarifa_dia:75000},{cargo:'conductor',plazas:1,tarifa_dia:120000}] }},
      { tipo:'orden.creada',    ts:'2025-06-18 10:00:00', alq:15,
        payload:{ alquiler_id:15, titulo:'Operación Festival del Viento 2025',
          fecha:'2025-06-20', hora_inicio:'06:00', lugar:'Parque Central, Pereira',
          puestos:[{cargo:'auxiliar',plazas:3,tarifa_dia:80000},{cargo:'jefe_montaje',plazas:1,tarifa_dia:155000}] }},
      { tipo:'orden.creada',    ts:'2025-07-03 15:00:00', alq:16,
        payload:{ alquiler_id:16, titulo:'Montaje Baby Shower Valentina',
          fecha:'2025-07-05', hora_inicio:'09:00', lugar:'Finca Los Pinos, Tenjo',
          puestos:[{cargo:'auxiliar',plazas:2,tarifa_dia:70000}] }},
      { tipo:'orden.creada',    ts:'2025-08-19 11:00:00', alq:17,
        payload:{ alquiler_id:17, titulo:'Montaje Convención Avicol 2025',
          fecha:'2025-08-21', hora_inicio:'07:00', lugar:'Centro Empresarial Parque Andino, Bogotá',
          puestos:[{cargo:'auxiliar',plazas:2,tarifa_dia:80000},{cargo:'conductor',plazas:1,tarifa_dia:120000},{cargo:'jefe_montaje',plazas:1,tarifa_dia:155000}] }},
      { tipo:'orden.creada',    ts:'2025-09-03 09:00:00', alq:18,
        payload:{ alquiler_id:18, titulo:'Montaje Ceremonia de Grados Externado',
          fecha:'2025-09-05', hora_inicio:'14:00', lugar:'Campus Externado, Bogotá',
          puestos:[{cargo:'auxiliar',plazas:2,tarifa_dia:75000}] }},
      { tipo:'orden.creada',    ts:'2025-10-08 10:00:00', alq:19,
        payload:{ alquiler_id:19, titulo:'Montaje Quinceañera Daniela Ruiz',
          fecha:'2025-10-10', hora_inicio:'08:00', lugar:'Finca La Esperanza, Cali',
          puestos:[{cargo:'auxiliar',plazas:2,tarifa_dia:75000},{cargo:'conductor',plazas:1,tarifa_dia:120000}] }},
      { tipo:'orden.creada',    ts:'2025-11-11 08:00:00', alq:20,
        payload:{ alquiler_id:20, titulo:'Operación Feria Empresarial Quindío 2025',
          fecha:'2025-11-13', hora_inicio:'06:00', lugar:'Recinto del Pensamiento, Manizales',
          puestos:[{cargo:'auxiliar',plazas:3,tarifa_dia:80000},{cargo:'conductor',plazas:1,tarifa_dia:125000},{cargo:'jefe_montaje',plazas:1,tarifa_dia:160000}] }},
      { tipo:'orden.cancelada', ts:'2025-11-19 14:00:00', alq:21,
        payload:{ alquiler_id:21, motivo:'Cliente canceló — permiso de terraza denegado', fecha_original:'2025-11-29' }},
      { tipo:'orden.creada',    ts:'2025-12-03 09:00:00', alq:22,
        payload:{ alquiler_id:22, titulo:'Montaje Clausura Escuela Montessori',
          fecha:'2025-12-05', hora_inicio:'07:30', lugar:'Colegio Montessori, Zipaquirá',
          puestos:[{cargo:'auxiliar',plazas:2,tarifa_dia:75000},{cargo:'jefe_montaje',plazas:1,tarifa_dia:150000}] }},
      { tipo:'orden.cancelada', ts:'2025-12-09 16:00:00', alq:23,
        payload:{ alquiler_id:23, motivo:'Cliente canceló por recorte de presupuesto navideño', fecha_original:'2025-12-19' }},
    ];

    for (const ev of evIn) {
      const [[dup]] = await pool.query(
        `SELECT id FROM integration_events_in WHERE empresa_id=? AND tipo_evento=? AND created_at=?`,
        [eId, ev.tipo, ev.ts]
      );
      if (dup) { skip(`evento_in ${ev.tipo} @${ev.ts}`); continue; }

      await pool.query(
        `INSERT INTO integration_events_in
           (empresa_id,event_id,tipo_evento,payload,estado,procesado_at,created_at)
         VALUES (?,?,?,?,?,?,?)`,
        [eId, randomUUID(), ev.tipo, JSON.stringify(ev.payload),
         'procesado', ev.ts, ev.ts]
      );
      ok(`evento_in ${ev.tipo} alq=${ev.alq}`);
    }
  }

  // Eventos salientes representativos (ingreso/egreso de turnos completados)
  const [[evOutCount]] = await pool.query(
    `SELECT COUNT(*) AS c FROM integration_events_out WHERE empresa_id=? AND created_at < '2026-01-01'`,
    [eId]
  );

  if (evOutCount.c >= 10) {
    skip(`integration_events_out: ${evOutCount.c} eventos 2025 ya existen`);
  } else {
    const evOut = [
      { tipo:'trabajador.ingreso',  ts:'2025-05-16 07:08:00',
        payload:{ alquiler_ref:'logiq360:alquiler:14', trabajador_ref:'logiq360:trabajador:201',
                  hora_ingreso:'2025-05-16T07:08:00-05:00', lat:4.5293, lon:-75.6743 } },
      { tipo:'trabajador.egreso',   ts:'2025-05-16 17:12:00',
        payload:{ alquiler_ref:'logiq360:alquiler:14', trabajador_ref:'logiq360:trabajador:201',
                  hora_egreso:'2025-05-16T17:12:00-05:00', horas_trabajadas:10.07, pago_total:75000 } },
      { tipo:'contrato.completado', ts:'2025-05-16 17:13:00',
        payload:{ alquiler_ref:'logiq360:alquiler:14', numero_contrato:'CD-2025-001',
                  trabajador_ref:'logiq360:trabajador:201', valor_dia:75000 } },
      { tipo:'trabajador.ingreso',  ts:'2025-06-20 06:05:00',
        payload:{ alquiler_ref:'logiq360:alquiler:15', trabajador_ref:'logiq360:trabajador:201',
                  hora_ingreso:'2025-06-20T06:05:00-05:00', lat:4.8135, lon:-75.6959 } },
      { tipo:'trabajador.egreso',   ts:'2025-06-20 18:10:00',
        payload:{ alquiler_ref:'logiq360:alquiler:15', trabajador_ref:'logiq360:trabajador:201',
                  hora_egreso:'2025-06-20T18:10:00-05:00', horas_trabajadas:12.08, pago_total:96000 } },
      { tipo:'trabajador.ingreso',  ts:'2025-08-21 07:10:00',
        payload:{ alquiler_ref:'logiq360:alquiler:17', trabajador_ref:'logiq360:trabajador:201',
                  hora_ingreso:'2025-08-21T07:10:00-05:00', lat:4.6801, lon:-74.0521 } },
      { tipo:'trabajador.egreso',   ts:'2025-08-21 17:15:00',
        payload:{ alquiler_ref:'logiq360:alquiler:17', trabajador_ref:'logiq360:trabajador:201',
                  hora_egreso:'2025-08-21T17:15:00-05:00', horas_trabajadas:10.08, pago_total:80000 } },
      { tipo:'trabajador.ingreso',  ts:'2025-11-13 06:02:00',
        payload:{ alquiler_ref:'logiq360:alquiler:20', trabajador_ref:'logiq360:trabajador:201',
                  hora_ingreso:'2025-11-13T06:02:00-05:00', lat:5.0690, lon:-75.5172 } },
      { tipo:'trabajador.egreso',   ts:'2025-11-13 18:05:00',
        payload:{ alquiler_ref:'logiq360:alquiler:20', trabajador_ref:'logiq360:trabajador:201',
                  hora_egreso:'2025-11-13T18:05:00-05:00', horas_trabajadas:12.05, pago_total:96000 } },
      { tipo:'contrato.completado', ts:'2025-12-05 16:29:00',
        payload:{ alquiler_ref:'logiq360:alquiler:22', numero_contrato:'CD-2025-021',
                  trabajador_ref:'logiq360:trabajador:201', valor_dia:75000 } },
    ];

    for (const ev of evOut) {
      const [[dup]] = await pool.query(
        `SELECT id FROM integration_events_out WHERE empresa_id=? AND tipo_evento=? AND created_at=?`,
        [eId, ev.tipo, ev.ts]
      );
      if (dup) { skip(`evento_out ${ev.tipo} @${ev.ts}`); continue; }

      await pool.query(
        `INSERT INTO integration_events_out
           (empresa_id,event_id,tipo_evento,payload,estado,intentos,enviado_at,created_at)
         VALUES (?,?,?,?,?,?,?,?)`,
        [eId, randomUUID(), ev.tipo, JSON.stringify(ev.payload),
         'enviado', 1, ev.ts, ev.ts]
      );
      ok(`evento_out ${ev.tipo}`);
    }
  }

  // ── Resumen ──────────────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   Resumen                                            ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log('║  10 ofertas de turno (8 completadas + 2 canceladas)  ║');
  console.log('║  22 asignaciones completadas con ingreso/egreso GPS  ║');
  console.log('║  22 contratos diarios firmados                       ║');
  console.log('║  22 calificaciones (rankings actualizados)           ║');
  console.log('║  10 eventos integración entrantes (órdenes logiq360) ║');
  console.log('║  10 eventos integración salientes (ingreso/egreso)   ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  await pool.end();
  process.exit(0);
}

main().catch(e => { console.error('❌ Error fatal:', e); process.exit(1); });
