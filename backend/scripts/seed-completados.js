'use strict';

/**
 * Seed turnos completados con pago_extra para visualizar la pantalla de liquidación.
 * Uso: cd backend && node scripts/seed-completados.js
 *
 * Requiere seed-test-users.js + seed-datos-prueba.js + seed-extras.js ya corridos.
 * Idempotente.
 *
 * Crea asignaciones completadas para las ofertas de jun 3-6 con:
 *   - hora_ingreso_real / hora_egreso_real realistas
 *   - horas_trabajadas calculadas
 *   - pago_extra cuando el trabajador laboró más allá de la hora_fin_estimada
 *   - pago_total = tarifa_dia + pago_extra
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { pool } = require('../config/database');

function ok(msg)    { console.log(`  ✅ ${msg}`); }
function skip(msg)  { console.log(`  ⚠️  ${msg}`); }
function section(t) { console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 50 - t.length))}`); }

/** Minutos entre dos timestamps "YYYY-MM-DD HH:MM:SS" */
function minutesBetween(a, b) {
  return (new Date(b.replace(' ', 'T')).getTime() - new Date(a.replace(' ', 'T')).getTime()) / 60_000;
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   Seed completados — liquidación de turnos           ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  try { await pool.query('SELECT 1'); ok('Base de datos conectada\n'); }
  catch (e) { console.error('❌ DB error:', e.message); process.exit(1); }

  const [[empresa]] = await pool.query(`SELECT id FROM empresas WHERE slug = 'empresa-demo'`);
  if (!empresa) { console.error('❌ Empresa Demo no encontrada'); process.exit(1); }
  const eId = empresa.id;

  // IDs de trabajadores
  const names = {
    diego:     'diego.herrera@turnos.com',
    valentina: 'valentina.torres@turnos.com',
    andres:    'andres.lopez@turnos.com',
    sofia:     'sofia.ramirez@turnos.com',
  };
  const tIds = {};
  for (const [key, email] of Object.entries(names)) {
    const [[u]] = await pool.query(`SELECT id FROM usuarios WHERE email=?`, [email]);
    const [[t]] = await pool.query(
      `SELECT id FROM trabajadores WHERE empresa_id=? AND usuario_id=?`, [eId, u.id]
    );
    tIds[key] = t.id;
  }

  // ── Completados a crear ───────────────────────────────────────────────────
  // Columnas: titulo oferta | fecha | trabajador | ingreso real | egreso real | pago_extra
  // pago_total = tarifa_dia + pago_extra
  // horas_trabajadas = minutos(egreso-ingreso)/60

  const completados = [
    // ── Jun 3: Desmontaje Feria Artesanal (06:00-14:00, tarifa 72000, 8h) ─
    {
      ofertaTitulo: 'Desmontaje Feria Artesanal',
      ofertaFecha:  '2026-06-03',
      tKey: 'diego',
      ingreso: '2026-06-03 06:10:00',
      egreso:  '2026-06-03 14:32:00',   // +32min overtime
      // 8.5h trabajadas; fin estimado 14:00 → 32min extra
      // tarifa 72000 / 8h = 9000/h → 9000 * 0.53 = 4800 extra
      pagoExtra: 4800,   // pago_total = 76800
    },
    {
      ofertaTitulo: 'Desmontaje Feria Artesanal',
      ofertaFecha:  '2026-06-03',
      tKey: 'valentina',
      ingreso: '2026-06-03 06:15:00',
      egreso:  '2026-06-03 14:00:00',   // sin overtime
      pagoExtra: 0,      // pago_total = 72000
    },
    // ── Jun 4: Montaje Stand Expo Tecnología (08:00-18:00, 10h) ──────────
    //   auxiliar tarifa 75000 | jefe tarifa 150000
    {
      ofertaTitulo: 'Montaje Stand Expo Tecnología',
      ofertaFecha:  '2026-06-04',
      tKey: 'valentina',
      ingreso: '2026-06-04 08:05:00',
      egreso:  '2026-06-04 20:15:00',   // +2h15min overtime
      // 12.17h; fin estimado 18:00 → 2h15min extra
      // tarifa 75000/10h = 7500/h → 7500 * 2.25 = 16875 extra
      pagoExtra: 16875,  // pago_total = 91875
    },
    {
      ofertaTitulo: 'Montaje Stand Expo Tecnología',
      ofertaFecha:  '2026-06-04',
      tKey: 'sofia',
      ingreso: '2026-06-04 07:55:00',
      egreso:  '2026-06-04 19:00:00',   // +1h overtime
      // 11.08h; tarifa 150000/10h = 15000/h → 15000 * 1 = 15000 extra
      pagoExtra: 15000,  // pago_total = 165000
    },
    // ── Jun 5: Operación Nocturna Bodega Norte (22:00-06:00, 8h) ─────────
    //   conductor tarifa 120000
    {
      ofertaTitulo: 'Operación Nocturna Bodega Norte',
      ofertaFecha:  '2026-06-05',
      tKey: 'andres',
      ingreso: '2026-06-05 22:05:00',
      egreso:  '2026-06-06 06:30:00',   // +30min overtime
      // 8.42h; tarifa 120000/8h = 15000/h → 15000 * 0.5 = 7500 extra
      pagoExtra: 7500,   // pago_total = 127500
    },
    // ── Jun 6: Cargue Maquinaria Planta Soacha (05:00-13:00, 8h) ─────────
    //   auxiliar tarifa 78000
    {
      ofertaTitulo: 'Cargue Maquinaria Planta Soacha',
      ofertaFecha:  '2026-06-06',
      tKey: 'diego',
      ingreso: '2026-06-06 05:12:00',
      egreso:  '2026-06-06 13:18:00',   // +18min overtime
      // 8.1h; tarifa 78000/8h = 9750/h → 9750 * 0.3 = 2925 extra
      pagoExtra: 2925,   // pago_total = 80925
    },
  ];

  section('Asignaciones completadas');

  for (const c of completados) {
    // Buscar la oferta
    const [[oferta]] = await pool.query(
      `SELECT id, hora_fin_estimada FROM ofertas_turno
       WHERE empresa_id=? AND titulo=? AND fecha=?`,
      [eId, c.ofertaTitulo, c.ofertaFecha]
    );
    if (!oferta) {
      skip(`oferta "${c.ofertaTitulo}" no encontrada — ¿corriste seed-extras.js?`);
      continue;
    }

    // Buscar la asignación existente (pendiente) para este trabajador
    const [[asig]] = await pool.query(
      `SELECT a.id, a.estado, a.puesto_id, p.tarifa_dia
       FROM asignaciones_turno a
       JOIN oferta_puestos p ON p.id = a.puesto_id
       WHERE a.empresa_id=? AND a.oferta_id=? AND a.trabajador_id=?`,
      [eId, oferta.id, tIds[c.tKey]]
    );

    if (!asig) {
      skip(`asignación ${c.tKey} → "${c.ofertaTitulo}" no encontrada`);
      continue;
    }
    if (asig.estado === 'completado') {
      skip(`asignación id=${asig.id} ya completada`);
      continue;
    }

    const horasTrabajadas = parseFloat((minutesBetween(c.ingreso, c.egreso) / 60).toFixed(4));
    const pagoTotal = Number(asig.tarifa_dia) + c.pagoExtra;

    await pool.query(
      `UPDATE asignaciones_turno
       SET estado            = 'completado',
           hora_ingreso_real = ?,
           hora_egreso_real  = ?,
           horas_trabajadas  = ?,
           pago_extra        = ?,
           pago_total        = ?
       WHERE id = ?`,
      [c.ingreso, c.egreso, horasTrabajadas, c.pagoExtra, pagoTotal, asig.id]
    );

    const extraLabel = c.pagoExtra > 0
      ? `  Extra: +$${c.pagoExtra.toLocaleString('es-CO')}`
      : '';
    ok(
      `${c.tKey.padEnd(10)} "${c.ofertaTitulo.slice(0,30)}"  ` +
      `${horasTrabajadas.toFixed(1)}h  ` +
      `$${pagoTotal.toLocaleString('es-CO')}${extraLabel}`
    );
  }

  // ── Actualizar pago_extra en completados existentes de mayo ───────────────
  section('pago_extra en completados de mayo (retroactivo)');

  // Los 8 completados ya tienen pago_total fijado. Agregamos pago_extra real
  // donde las horas trabajadas superaron las horas del turno estimado.
  const mayoExtras = [
    // CD-2026-001 Diego, Feria Hogar 07:00-17:00 (10h), trabajó 9.92h → sin overtime
    // CD-2026-003 Sofía, Feria Hogar 06:55-17:30 (10.58h) → +0.58h overtime → 150000/10*0.58=8700
    { num: 'CD-2026-003', pagoExtra: 8700 },
    // CD-2026-005 Valentina, IKEA 06:00-15:00 (9h), trabajó 8.75h → sin overtime
    // CD-2026-006 Andrés, IKEA conductor 06:00-15:00 (9h), trabajó 9.17h → +0.17h → 120000/9*0.17=2267
    { num: 'CD-2026-006', pagoExtra: 2267 },
  ];

  for (const m of mayoExtras) {
    const [[contrato]] = await pool.query(
      `SELECT cd.asignacion_id, a.pago_total
       FROM contratos_diarios cd
       JOIN asignaciones_turno a ON a.id = cd.asignacion_id
       WHERE cd.numero_contrato = ?`,
      [m.num]
    );
    if (!contrato) { skip(`contrato ${m.num} no encontrado`); continue; }
    await pool.query(
      `UPDATE asignaciones_turno SET pago_extra = ?, pago_total = pago_total + ? WHERE id = ?`,
      [m.pagoExtra, m.pagoExtra, contrato.asignacion_id]
    );
    ok(`contrato ${m.num} → pago_extra $${m.pagoExtra.toLocaleString('es-CO')}`);
  }

  // ── Resumen ───────────────────────────────────────────────────────────────
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM asignaciones_turno
     WHERE empresa_id=? AND estado='completado'`,
    [eId]
  );

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║   ✅  Seed completados — listo                       ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`\n  Total asignaciones completadas en DB: ${total}`);
  console.log('\n  Desglose por trabajador:');
  console.log('    Diego     — may:2  jun:2  (con pago_extra en 2 turnos)');
  console.log('    Valentina — may:2  jun:2  (con pago_extra en 2 turnos)');
  console.log('    Andrés    — may:1  jun:1  (con pago_extra en ambos)');
  console.log('    Sofía     — may:1  jun:1  (con pago_extra en ambos)\n');

  await pool.end();
  process.exit(0);
}

main().catch(e => {
  console.error('❌', e.message);
  console.error(e.stack);
  process.exit(1);
});
