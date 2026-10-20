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
 *   - calificaciones: la mayoría de los turnos completados calificados (algunos sin calificar), 3 personas con promedio bajo
 *   - turnos de 3 cargos: auxiliares (2 acaparan, 2 casi sin turnos), conductores (3) y jefe de montaje (1)
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
  let adminId = null;
  for (const [nombre, email, rol] of [['Admin', 'admin', 'admin_empresa'], ['Jefe', 'jturnos', 'jefe_turnos'], ['Jefe', 'jnomina', 'jefe_nomina']]) {
    const [u] = await pool.query(
      'INSERT INTO usuarios (empresa_id, nombre, apellido, email, password_hash, rol, activo) VALUES (?,?,?,?,?,?,1)',
      [eId, nombre, 'Demo', `${email}@reportes-demo.co`, hash, rol]);
    if (rol === 'admin_empresa') adminId = u.insertId;
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
      [eId, NOMBRES[(i + 4) % 10], `${APELLIDOS[(i * 7) % 10]} T${i + 1}`, 'turnos', i < 8 ? 'Auxiliar' : i < 11 ? 'Conductor' : 'Jefe de montaje']);
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
      let tipo = 'ordinario', ord = 7, ext = 0, entrada = '07:00:00', salida = '15:00:00'; // 7 h x 6 días = 42 h
      if (idx === 4 && azar() < 0.22) { tipo = 'ausencia'; ord = 0; entrada = salida = null; }
      else if (idx < 4 && azar() < (reciente ? 0.7 : 0.45)) { ext = 1 + Math.floor(azar() * 3); salida = `${15 + ext}:00:00`; }
      else if (azar() < 0.04) { ext = 1; salida = '16:00:00'; }
      if (tipo === 'ordinario' && ext === 0 && azar() < 0.05) { ord = 4; salida = '11:00:00'; } // medio día
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

  // Turnos: ~3 ofertas por semana con puestos de varios cargos y cobertura imperfecta.
  // Auxiliares (8 personas, 2 de ellas casi acaparan los turnos y 2 casi no entran),
  // conductores (3) y jefe de montaje (1): estos dos últimos son cargos con pocas personas.
  const cargos = {};
  for (const codigo of ['auxiliar', 'conductor', 'jefe_montaje']) {
    const [[c]] = await pool.query('SELECT id FROM cargos WHERE empresa_id IS NULL AND codigo = ?', [codigo]);
    cargos[codigo] = c.id;
  }
  const pool_cargo = {
    auxiliar: turnistas.slice(0, 8),
    conductor: turnistas.slice(8, 11),
    jefe_montaje: turnistas.slice(11, 12),
  };
  const elegir = (codigo) => {
    const g = pool_cargo[codigo];
    if (codigo !== 'auxiliar') return g[Math.floor(azar() * g.length)];
    const r = azar();
    if (r < 0.5) return g[Math.floor(azar() * 2)];       // 2 acaparadores
    if (r < 0.96) return g[2 + Math.floor(azar() * 4)];  // 4 intermedios
    return g[6 + Math.floor(azar() * 2)];                // 2 casi sin turnos
  };
  const tarifas = { auxiliar: 90000, conductor: 130000, jefe_montaje: 160000 };
  let ofertas = 0, asignaciones = 0;
  for (let f = new Date(ini); f <= fin; f = sumarDias(f, 1)) {
    if (azar() > 3 / 7) continue;
    const pasada = f < fin;
    const [{ insertId: oid }] = await pool.query(
      `INSERT INTO ofertas_turno (empresa_id, titulo, fecha, hora_inicio, lugar, ciudad, estado)
       VALUES (?,?,?,?,?,?,?)`,
      [eId, `Evento ${iso(f)}`, iso(f), '08:00:00', 'Bodega central', 'Bogotá D.C.', pasada ? 'completada' : 'abierta']);
    ofertas++;
    for (const [codigo, plazasMax] of [['auxiliar', 3], ['conductor', 1], ['jefe_montaje', 1]]) {
      if (codigo !== 'auxiliar' && azar() < 0.3) continue;
      const plazas = codigo === 'auxiliar' ? 2 + Math.floor(azar() * (plazasMax - 1)) : plazasMax;
      const cubiertas = Math.min(plazas, Math.round(plazas * (0.6 + azar() * 0.5)));
      const [{ insertId: pid }] = await pool.query(
        'INSERT INTO oferta_puestos (oferta_id, cargo_id, plazas, plazas_cubiertas, tarifa_dia) VALUES (?,?,?,?,?)',
        [oid, cargos[codigo], plazas, cubiertas, tarifas[codigo]]);
      const ya = new Set();
      for (let k = 0; k < cubiertas; k++) {
        let t = elegir(codigo);
        for (let i = 0; ya.has(t) && i < 10; i++) t = elegir(codigo);
        if (ya.has(t)) continue;
        ya.add(t);
        const falta = t === turnistas[0] ? azar() < 0.3 : azar() < 0.03;
        const bono = !falta && azar() < 0.1 ? 20000 : 0;
        const [{ insertId: asigId }] = await pool.query(
          `INSERT INTO asignaciones_turno (empresa_id, oferta_id, puesto_id, trabajador_id, estado, pago_total, bono_monto, horas_trabajadas)
           VALUES (?,?,?,?,?,?,?,?)`,
          [eId, oid, pid, t, !pasada ? 'confirmado' : falta ? 'no_presentado' : 'completado', falta || !pasada ? null : tarifas[codigo] + bono, bono, falta || !pasada ? null : 5 + Math.floor(azar() * 8)]); // turnos de 5 a 12 h
        asignaciones++;
        // Calificaciones: el gestor califica la mayoría de los completados (se le quedan sin calificar ~15 %);
        // el no se presentó lleva un 0 automático (calificado_por NULL). Las personas 6 y 7 (casi sin turnos) y la 5 salen mal.
        if (pasada && falta) {
          await pool.query('INSERT INTO calificaciones_turno (empresa_id, asignacion_id, trabajador_id, calificacion, calificado_por) VALUES (?,?,?,0,NULL)', [eId, asigId, t]);
        } else if (pasada && azar() > 0.15) {
          const base = [4.8, 4.6, 4.2, 4.0, 3.9, 2.4, 2.1, 2.3, 4.4, 4.0, 3.8, 4.7][turnistas.indexOf(t)] ?? 4;
          const cal = Math.max(1, Math.min(5, Math.round(base + (azar() - 0.5) * 2)));
          await pool.query('INSERT INTO calificaciones_turno (empresa_id, asignacion_id, trabajador_id, calificacion, calificado_por) VALUES (?,?,?,?,?)', [eId, asigId, t, cal, adminId]);
        }
      }
    }
  }

  console.log(`✅ Empresa ${eId}: ${nomina.length + turnistas.length} trabajadores, ${filas.length} registros diarios, ${ofertas} ofertas, ${asignaciones} asignaciones`);
  await pool.end();
}

async function borrarEmpresa(id) {
  const tablas = ['registros_diarios', 'periodos_nomina', 'trabajadores', 'usuarios'];
  await pool.query('DELETE FROM calificaciones_turno WHERE empresa_id = ?', [id]);
  await pool.query('DELETE FROM asignaciones_turno WHERE empresa_id = ?', [id]);
  await pool.query('DELETE FROM oferta_puestos WHERE oferta_id IN (SELECT id FROM ofertas_turno WHERE empresa_id = ?)', [id]);
  await pool.query('DELETE FROM ofertas_turno WHERE empresa_id = ?', [id]);
  for (const t of tablas) await pool.query(`DELETE FROM ${t} WHERE empresa_id = ?`, [id]);
  await pool.query('DELETE FROM empresas WHERE id = ?', [id]);
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
