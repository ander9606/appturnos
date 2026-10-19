'use strict';

/**
 * Datos sintéticos para probar los reportes (solo desarrollo, nunca producción).
 *
 * Uso: cd backend && node scripts/generar-datos-reportes.js [meses=6]
 *
 * Crea la empresa "Reportes Demo" (slug reportes-demo) con 28 trabajadores de
 * nómina y 12 de turnos, y `meses` de historia con patrones que los reportes
 * deben poder encontrar:
 *   - 4 personas concentran casi todas las horas extra
 *   - una persona con inasistencias frecuentes (nómina) y otra que no se presenta a turnos
 *   - cobertura de plazas por debajo del 100 % en algunos turnos
 *   - el último mes cuesta más que el anterior (más extras)
 * Idempotente: si la empresa ya existe, la borra y la regenera.
 * El generador es determinista (misma semilla → mismos datos) para comparar planes de consulta.
 *
 * Usuarios (clave Prueba1234!): admin@reportes-demo.co, jturnos@reportes-demo.co, jnomina@reportes-demo.co
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

if (process.env.NODE_ENV === 'production') {
  console.error('❌ No se ejecuta en producción');
  process.exit(1);
}

const bcrypt = require('bcrypt');
const { pool } = require('../config/database');

const SLUG = 'reportes-demo';
const MESES = Number(process.argv[2]) || 6;

// Generador pseudoaleatorio con semilla (mulberry32): no hace falta una librería.
let semilla = 20260101;
function azar() {
  semilla |= 0; semilla = (semilla + 0x6d2b79f5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const NOMBRES = ['Juan', 'María', 'Carlos', 'Laura', 'Andrés', 'Camila', 'Felipe', 'Daniela', 'Sebastián', 'Valentina'];
const APELLIDOS = ['García', 'Rodríguez', 'Martínez', 'López', 'Gómez', 'Díaz', 'Pérez', 'Torres', 'Ramírez', 'Castro'];

const iso = (d) => d.toISOString().slice(0, 10);
const sumarDias = (d, n) => new Date(d.getTime() + n * 86400000);

async function main() {
  const [[viejo]] = await pool.query('SELECT id FROM empresas WHERE slug = ?', [SLUG]);
  if (viejo) {
    await borrarEmpresa(viejo.id);
    console.log('♻️  empresa anterior borrada');
  }
  const [{ insertId: eId }] = await pool.query(
    `INSERT INTO empresas (nombre, slug, nit, ciudad, plan, acepta_postulaciones)
     VALUES ('Reportes Demo', ?, '900000100-1', 'Bogotá D.C.', 'empresarial', 1)`, [SLUG]);

  const hash = await bcrypt.hash('Prueba1234!', 10);
  for (const [nombre, email, rol] of [['Admin', 'admin', 'admin_empresa'], ['Jefe', 'jturnos', 'jefe_turnos'], ['Jefe', 'jnomina', 'jefe_nomina']]) {
    await pool.query(
      'INSERT INTO usuarios (empresa_id, nombre, apellido, email, password_hash, rol, activo) VALUES (?,?,?,?,?,?,1)',
      [eId, nombre, 'Demo', `${email}@reportes-demo.co`, hash, rol]);
  }

  // Trabajadores: 28 de nómina (los 4 primeros hacen casi todas las extras, el 5.º falta mucho) y 12 de turnos
  const nomina = [];
  for (let i = 0; i < 28; i++) {
    const asalariado = i % 3 !== 0;
    const [{ insertId }] = await pool.query(
      `INSERT INTO trabajadores (empresa_id, nombre, apellido, tipo, cargo, salario_base, tarifa_hora, activo)
       VALUES (?,?,?,?,?,?,?,1)`,
      [eId, NOMBRES[i % 10], `${APELLIDOS[(i * 3) % 10]} ${i + 1}`, 'nomina', 'Operario',
       asalariado ? 1750905 + (i % 5) * 150000 : null, asalariado ? null : 9500]);
    nomina.push({ id: insertId, salario: asalariado ? 1750905 + (i % 5) * 150000 : null, tarifa: asalariado ? null : 9500 });
  }
  const turnistas = [];
  for (let i = 0; i < 12; i++) {
    const [{ insertId }] = await pool.query(
      `INSERT INTO trabajadores (empresa_id, nombre, apellido, tipo, cargo, activo) VALUES (?,?,?,?,?,1)`,
      [eId, NOMBRES[(i + 4) % 10], `${APELLIDOS[(i * 7) % 10]} T${i + 1}`, 'turnos', 'Auxiliar']);
    turnistas.push(insertId);
  }

  // Períodos quincenales: todos cerrados menos el que contiene hoy
  const hoy = new Date();
  const fin = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));
  const ini = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth() - MESES, 1));
  const periodos = [];
  for (let d = new Date(ini); d <= fin; ) {
    const dia15 = d.getUTCDate() === 1;
    const hasta = dia15 ? sumarDias(d, 14) : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    const estado = hasta < fin ? 'cerrado' : 'abierto';
    const [{ insertId }] = await pool.query(
      'INSERT INTO periodos_nomina (empresa_id, fecha_inicio, fecha_fin, tipo, estado) VALUES (?,?,?,?,?)',
      [eId, iso(d), iso(hasta), 'quincenal', estado]);
    periodos.push({ id: insertId, desde: new Date(d), hasta });
    d = sumarDias(hasta, 1);
  }
  const periodoDe = (f) => periodos.find((p) => f >= p.desde && f <= p.hasta)?.id;

  // Registros diarios: lunes a sábado
  const filas = [];
  const mesReciente = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth() - 1, hoy.getDate()));
  for (let f = new Date(ini); f <= fin; f = sumarDias(f, 1)) {
    if (f.getUTCDay() === 0) continue;
    const pid = periodoDe(f);
    nomina.forEach((w, idx) => {
      const reciente = f >= mesReciente;
      let tipo = 'ordinario', ord = 8, ext = 0, entrada = '07:00:00', salida = '16:00:00';
      if (idx === 4 && azar() < 0.22) { tipo = 'ausencia'; ord = 0; entrada = salida = null; }
      else if (idx < 4 && azar() < (reciente ? 0.7 : 0.45)) { ext = 1 + Math.floor(azar() * 3); salida = `${16 + ext}:00:00`; }
      else if (azar() < 0.04) { ext = 1; salida = '17:00:00'; }
      if (tipo === 'ordinario' && azar() < 0.1) entrada = '07:25:00'; // llegada tarde
      const sem = 40 + ext * 3;
      filas.push([eId, w.id, pid, iso(f), entrada, salida, ord, ext, tipo, w.salario ? w.salario / 210 : w.tarifa, w.salario, sem]);
    });
  }
  for (let i = 0; i < filas.length; i += 1000) {
    await pool.query(
      `INSERT INTO registros_diarios (empresa_id, trabajador_id, periodo_id, fecha, hora_entrada, hora_salida,
         horas_ordinarias, horas_extra_diurnas, tipo_dia, valor_hora_snapshot, salario_base_snapshot, horas_acumuladas_semana)
       VALUES ?`, [filas.slice(i, i + 1000)]);
  }

  // Turnos: 3 ofertas por semana, 2–4 plazas, cobertura imperfecta; el turnista 0 falta con frecuencia
  const [[cargo]] = await pool.query("SELECT id FROM cargos WHERE empresa_id IS NULL AND codigo = 'auxiliar'");
  let ofertas = 0, asignaciones = 0;
  for (let f = new Date(ini); f <= fin; f = sumarDias(f, 1)) {
    if (azar() > 3 / 7) continue;
    const pasada = f < fin;
    const plazas = 2 + Math.floor(azar() * 3);
    const cubiertas = Math.min(plazas, Math.round(plazas * (0.6 + azar() * 0.5)));
    const [{ insertId: oid }] = await pool.query(
      `INSERT INTO ofertas_turno (empresa_id, titulo, fecha, hora_inicio, lugar, ciudad, estado)
       VALUES (?,?,?,?,?,?,?)`,
      [eId, `Evento ${iso(f)}`, iso(f), '08:00:00', 'Bodega central', 'Bogotá D.C.', pasada ? 'completada' : 'abierta']);
    const [{ insertId: pid }] = await pool.query(
      'INSERT INTO oferta_puestos (oferta_id, cargo_id, plazas, plazas_cubiertas, tarifa_dia) VALUES (?,?,?,?,90000)',
      [oid, cargo.id, plazas, cubiertas]);
    ofertas++;
    for (let k = 0; k < cubiertas; k++) {
      const t = turnistas[(ofertas + k) % turnistas.length];
      const falta = t === turnistas[0] ? azar() < 0.3 : azar() < 0.03;
      const bono = !falta && azar() < 0.1 ? 20000 : 0;
      await pool.query(
        `INSERT INTO asignaciones_turno (empresa_id, oferta_id, puesto_id, trabajador_id, estado, pago_total, bono_monto, horas_trabajadas)
         VALUES (?,?,?,?,?,?,?,?)`,
        [eId, oid, pid, t, !pasada ? 'confirmado' : falta ? 'no_presentado' : 'completado', falta || !pasada ? null : 90000 + bono, bono, falta || !pasada ? null : 9]);
      asignaciones++;
    }
  }

  console.log(`✅ Empresa ${eId}: ${nomina.length + turnistas.length} trabajadores, ${filas.length} registros diarios, ${ofertas} ofertas, ${asignaciones} asignaciones`);
  await pool.end();
}

async function borrarEmpresa(id) {
  const tablas = ['registros_diarios', 'periodos_nomina', 'trabajadores', 'usuarios'];
  await pool.query('DELETE FROM asignaciones_turno WHERE empresa_id = ?', [id]);
  await pool.query('DELETE FROM oferta_puestos WHERE oferta_id IN (SELECT id FROM ofertas_turno WHERE empresa_id = ?)', [id]);
  await pool.query('DELETE FROM ofertas_turno WHERE empresa_id = ?', [id]);
  for (const t of tablas) await pool.query(`DELETE FROM ${t} WHERE empresa_id = ?`, [id]);
  await pool.query('DELETE FROM empresas WHERE id = ?', [id]);
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
