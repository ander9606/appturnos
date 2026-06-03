/**
 * seed.js — Datos de prueba para AppTurnos
 *
 * Crea una empresa demo con usuarios, trabajadores y turnos en todos los
 * estados posibles para revisar los cambios de la interfaz turno/[id].tsx.
 *
 * Uso: node backend/seeds/seed.js
 *
 * Usuarios creados (contraseña: Demo1234! para todos):
 *   admin@demo.co         — admin_empresa
 *   jefe@demo.co          — jefe_turnos  (recibe notificaciones de ingreso)
 *   juan.garcia@demo.co   — trabajador_turnos
 *   maria.lopez@demo.co   — trabajador_turnos
 *
 * Turnos creados (relativas a hoy):
 *   1. pendiente   — postulado, sin confirmar
 *   2. confirmado  — listo para marcar ingreso (geofence 1 km activo)
 *   3. en_progreso — ingreso marcado hace 2 h, timer en vivo
 *   4. completado  — ayer, con pago calculado
 *   5. no_presentado — hace 2 días
 *   6. cancelado   — hace 3 días
 */
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const bcrypt  = require('bcrypt');
const mysql   = require('mysql2/promise');

// ── Conexión ──────────────────────────────────────────────────────────────────

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'app_turnos',
  waitForConnections: true,
  connectionLimit: 5,
  multipleStatements: false,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** yyyy-MM-dd */
function dateStr(d) {
  return d.toISOString().slice(0, 10);
}

/** 'yyyy-MM-dd HH:mm:ss' */
function datetimeStr(d) {
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function addHours(d, h) {
  return new Date(d.getTime() + h * 3_600_000);
}

async function ins(conn, table, row) {
  const cols = Object.keys(row).join(', ');
  const vals = Object.values(row);
  const ph   = vals.map(() => '?').join(', ');
  const [res] = await conn.execute(
    `INSERT INTO ${table} (${cols}) VALUES (${ph})`,
    vals,
  );
  return res.insertId;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const conn = await pool.getConnection();
  const now  = new Date();
  const hoy  = dateStr(now);

  console.log('🌱 Iniciando seed de datos de prueba…');

  try {
    // ── 0. Limpiar datos de demo anteriores (idempotente) ─────────────────────

    await conn.execute(
      `DELETE FROM empresas WHERE slug = 'logistica-demo'`
    );
    console.log('  ✓ Datos anteriores eliminados');

    // ── 1. Empresa ────────────────────────────────────────────────────────────

    const empresaId = await ins(conn, 'empresas', {
      nombre:               'Logística Demo S.A.S',
      slug:                 'logistica-demo',
      nit:                  '900123456-7',
      ciudad:               'Bogotá D.C.',
      plan:                 'profesional',
      acepta_postulaciones: 1,
      descripcion:          'Empresa demo para pruebas de AppTurnos',
    });
    console.log(`  ✓ Empresa creada: id=${empresaId}`);

    // ── 2. Usuarios de gestión (con empresa_id) ────────────────────────────────

    const hashPwd = await bcrypt.hash('Demo1234!', 10);

    const adminId = await ins(conn, 'usuarios', {
      empresa_id:    empresaId,
      nombre:        'Carlos',
      apellido:      'Mendoza',
      email:         'admin@demo.co',
      password_hash: hashPwd,
      rol:           'admin_empresa',
    });

    const jefeId = await ins(conn, 'usuarios', {
      empresa_id:    empresaId,
      nombre:        'Laura',
      apellido:      'Pinzón',
      email:         'jefe@demo.co',
      password_hash: hashPwd,
      rol:           'jefe_turnos',
    });
    console.log(`  ✓ Usuarios gestión: admin=${adminId}, jefe=${jefeId}`);

    // ── 3. Usuarios trabajadores (empresa_id=NULL — modelo marketplace) ───────

    const uJuanId = await ins(conn, 'usuarios', {
      empresa_id:    null,
      nombre:        'Juan',
      apellido:      'García',
      email:         'juan.garcia@demo.co',
      password_hash: hashPwd,
      rol:           'trabajador_turnos',
    });

    const uMariaId = await ins(conn, 'usuarios', {
      empresa_id:    null,
      nombre:        'María',
      apellido:      'López',
      email:         'maria.lopez@demo.co',
      password_hash: hashPwd,
      rol:           'trabajador_turnos',
    });
    console.log(`  ✓ Usuarios trabajadores: juan=${uJuanId}, maria=${uMariaId}`);

    // ── 4. Trabajadores ────────────────────────────────────────────────────────

    const tJuanId = await ins(conn, 'trabajadores', {
      empresa_id:   empresaId,
      usuario_id:   uJuanId,
      nombre:       'Juan',
      apellido:     'García',
      cedula:       '1020304050',
      telefono:     '3101234567',
      email:        'juan.garcia@demo.co',
      tipo:         'turnos',
      cargo:        'Auxiliar',
      tarifa_hora:  15625,  // ~$3.750.000 / 240 h
    });

    const tMariaId = await ins(conn, 'trabajadores', {
      empresa_id:   empresaId,
      usuario_id:   uMariaId,
      nombre:       'María',
      apellido:     'López',
      cedula:       '1030405060',
      telefono:     '3209876543',
      email:        'maria.lopez@demo.co',
      tipo:         'turnos',
      cargo:        'Auxiliar',
      tarifa_hora:  15625,
    });
    console.log(`  ✓ Trabajadores: juan=${tJuanId}, maria=${tMariaId}`);

    // ── 5. Vínculos trabajador_empresa ─────────────────────────────────────────

    const teJuanId = await ins(conn, 'trabajador_empresa', {
      usuario_id:     uJuanId,
      empresa_id:     empresaId,
      trabajador_id:  tJuanId,
      estado:         'activo',
      iniciado_por:   'empresa',
      fecha_resuelto: datetimeStr(addDays(now, -30)),
    });

    await ins(conn, 'trabajador_empresa', {
      usuario_id:     uMariaId,
      empresa_id:     empresaId,
      trabajador_id:  tMariaId,
      estado:         'activo',
      iniciado_por:   'empresa',
      fecha_resuelto: datetimeStr(addDays(now, -25)),
    });
    console.log('  ✓ Vínculos trabajador_empresa');

    // ── 6. Punto de marcaje fijo ───────────────────────────────────────────────
    //    Bodega Central en Fontibón, Bogotá (zona industrial)

    const puntoId = await ins(conn, 'puntos_marcaje', {
      empresa_id:   empresaId,
      nombre:       'Bodega Central Fontibón',
      descripcion:  'Sede principal — Cra 106 #22D-55, Bogotá',
      latitud:      4.67901,
      longitud:     -74.14803,
      radio_metros: 150,
      tipo:         'fijo',
    });
    console.log(`  ✓ Punto de marcaje: id=${puntoId}`);

    // ── 7. Ofertas de turno ────────────────────────────────────────────────────

    /*
     * Coordenadas usadas:
     *   Oferta Parque 93 (zona rosa): 4.6665, -74.0536
     *   Oferta Bodega Fontibón:       4.6790, -74.1480
     *   Oferta sin coords (libre):    null
     *
     * radio_metros del geofence para tipo 'oferta' = 1000 m (nuevo default)
     */

    // (a) Oferta futura — asignacion PENDIENTE (Juan)
    const ofertaPendienteId = await ins(conn, 'ofertas_turno', {
      empresa_id:        empresaId,
      titulo:            'Montaje feria Corferias — pendiente',
      descripcion:       'Apoyo en montaje de stands. Lleva ropa cómoda.',
      fecha:             dateStr(addDays(now, 3)),
      hora_inicio:       '07:00:00',
      hora_fin_estimada: '15:00:00',
      lugar:             'Corferias, Cra 37 #24-67, Bogotá',
      latitud:           4.6280,
      longitud:          -74.0905,
      plazas_disponibles: 5,
      plazas_cubiertas:   1,
      tarifa_dia:        120000,
      estado:            'abierta',
      creado_por:        jefeId,
    });

    // (b) Oferta mañana — asignacion CONFIRMADA (Juan) — para probar Marcar Ingreso
    const ofertaConfirmadaId = await ins(conn, 'ofertas_turno', {
      empresa_id:        empresaId,
      titulo:            'Descargue contenedor — Zona Franca Bogotá',
      descripcion:       'Descargue de mercancía pesada. Se requiere certificado de alturas.',
      fecha:             dateStr(addDays(now, 1)),
      hora_inicio:       '06:00:00',
      hora_fin_estimada: '14:00:00',
      lugar:             'Zona Franca Bogotá — Av. Calle 26 #82-70',
      latitud:           4.6890,
      longitud:          -74.1220,
      plazas_disponibles: 3,
      plazas_cubiertas:   1,
      tarifa_dia:        150000,
      estado:            'abierta',
      creado_por:        jefeId,
    });

    // (c) Oferta hoy — asignacion EN PROGRESO (Juan) — para probar timer en vivo
    const ofertaEnProgresoId = await ins(conn, 'ofertas_turno', {
      empresa_id:        empresaId,
      titulo:            'Evento Parque 93 — bodeguero',
      descripcion:       'Apoyo logístico en evento corporativo.',
      fecha:             hoy,
      hora_inicio:       '08:00:00',
      hora_fin_estimada: '17:00:00',
      lugar:             'Parque 93 — Cl. 93 #13-33, Bogotá',
      latitud:           4.6665,
      longitud:          -74.0536,
      plazas_disponibles: 2,
      plazas_cubiertas:   1,
      tarifa_dia:        130000,
      estado:            'en_proceso',
      creado_por:        jefeId,
    });

    // (d) Oferta ayer — asignacion COMPLETADA (Juan)
    const ofertaCompletadaId = await ins(conn, 'ofertas_turno', {
      empresa_id:        empresaId,
      titulo:            'Inventario almacén — CEDI Cota',
      descripcion:       'Conteo y organización de inventario.',
      fecha:             dateStr(addDays(now, -1)),
      hora_inicio:       '07:00:00',
      hora_fin_estimada: '15:00:00',
      lugar:             'CEDI Cota — Vía Cota-Siberia km 2',
      latitud:           4.8115,
      longitud:          -74.1084,
      plazas_disponibles: 4,
      plazas_cubiertas:   2,
      tarifa_dia:        115000,
      estado:            'completada',
      creado_por:        jefeId,
    });

    // (e) Oferta hace 2 días — asignacion NO_PRESENTADO (María)
    const ofertaNoPresentadoId = await ins(conn, 'ofertas_turno', {
      empresa_id:        empresaId,
      titulo:            'Apoyo fuerza de ventas — Plaza Américas',
      fecha:             dateStr(addDays(now, -2)),
      hora_inicio:       '09:00:00',
      hora_fin_estimada: '17:00:00',
      lugar:             'Plaza de las Américas — Av. Boyacá 63-99, Bogotá',
      latitud:           4.6095,
      longitud:          -74.1223,
      plazas_disponibles: 2,
      plazas_cubiertas:   0,
      tarifa_dia:        110000,
      estado:            'completada',
      creado_por:        jefeId,
    });

    // (f) Oferta hace 3 días — asignacion CANCELADA (María)
    const ofertaCanceladaId = await ins(conn, 'ofertas_turno', {
      empresa_id:        empresaId,
      titulo:            'Soporte logístico — CityPark',
      fecha:             dateStr(addDays(now, -3)),
      hora_inicio:       '08:00:00',
      hora_fin_estimada: '16:00:00',
      lugar:             'CityPark — Av. El Dorado, Bogotá',
      latitud:           4.6596,
      longitud:          -74.0815,
      plazas_disponibles: 3,
      plazas_cubiertas:   0,
      tarifa_dia:        105000,
      estado:            'cancelada',
      creado_por:        jefeId,
    });

    // (g) Oferta futura — asignacion CONFIRMADA (María) — sin coords (libre)
    const ofertaLibreId = await ins(conn, 'ofertas_turno', {
      empresa_id:        empresaId,
      titulo:            'Atención call center — teletrabajo',
      descripcion:       'Turno remoto, sin requisito de ubicación.',
      fecha:             dateStr(addDays(now, 2)),
      hora_inicio:       '14:00:00',
      hora_fin_estimada: '22:00:00',
      lugar:             'Remoto (teletrabajo)',
      latitud:           null,
      longitud:          null,
      plazas_disponibles: 10,
      plazas_cubiertas:   1,
      tarifa_dia:        95000,
      estado:            'abierta',
      creado_por:        jefeId,
    });

    console.log('  ✓ Ofertas de turno creadas');

    // ── 8. Asignaciones ────────────────────────────────────────────────────────

    const ingresoReal = addHours(now, -2);  // ingresó hace 2 horas

    const egresoReal  = addHours(new Date(dateStr(addDays(now, -1)) + 'T07:00:00'), 8);
    const ingresoAyer = new Date(dateStr(addDays(now, -1)) + 'T07:05:00');

    // Juan → pendiente
    await ins(conn, 'asignaciones_turno', {
      empresa_id:    empresaId,
      oferta_id:     ofertaPendienteId,
      trabajador_id: tJuanId,
      estado:        'pendiente',
    });

    // Juan → confirmado (geofence activo — habilita "Marcar Ingreso")
    await ins(conn, 'asignaciones_turno', {
      empresa_id:    empresaId,
      oferta_id:     ofertaConfirmadaId,
      trabajador_id: tJuanId,
      estado:        'confirmado',
    });

    // Juan → en_progreso (timer corre desde hace 2 h)
    await ins(conn, 'asignaciones_turno', {
      empresa_id:         empresaId,
      oferta_id:          ofertaEnProgresoId,
      trabajador_id:      tJuanId,
      estado:             'en_progreso',
      hora_ingreso_real:  datetimeStr(ingresoReal),
      latitud_ingreso:    4.6665,
      longitud_ingreso:   -74.0536,
    });

    // Juan → completado (ayer, 8 h trabajadas)
    await ins(conn, 'asignaciones_turno', {
      empresa_id:        empresaId,
      oferta_id:         ofertaCompletadaId,
      trabajador_id:     tJuanId,
      estado:            'completado',
      hora_ingreso_real: datetimeStr(ingresoAyer),
      hora_egreso_real:  datetimeStr(egresoReal),
      latitud_ingreso:   4.8115,
      longitud_ingreso:  -74.1084,
      horas_trabajadas:  7.9,
      pago_total:        113850,     // 115000 * (7.9/8) ≈ 113 k
    });

    // María → no_presentado
    await ins(conn, 'asignaciones_turno', {
      empresa_id:    empresaId,
      oferta_id:     ofertaNoPresentadoId,
      trabajador_id: tMariaId,
      estado:        'no_presentado',
    });

    // María → cancelado
    await ins(conn, 'asignaciones_turno', {
      empresa_id:    empresaId,
      oferta_id:     ofertaCanceladaId,
      trabajador_id: tMariaId,
      estado:        'cancelado',
    });

    // María → confirmado sin coords (tipo libre — botón siempre activo)
    await ins(conn, 'asignaciones_turno', {
      empresa_id:    empresaId,
      oferta_id:     ofertaLibreId,
      trabajador_id: tMariaId,
      estado:        'confirmado',
    });

    console.log('  ✓ Asignaciones creadas');

    // ── Resumen ────────────────────────────────────────────────────────────────

    console.log('\n✅ Seed completado.\n');
    console.log('─────────────────────────────────────────────────────');
    console.log('  URL backend:   http://localhost:3001');
    console.log('─────────────────────────────────────────────────────');
    console.log('  Contraseña de todos los usuarios: Demo1234!');
    console.log('');
    console.log('  admin@demo.co          → admin_empresa');
    console.log('  jefe@demo.co           → jefe_turnos');
    console.log('  juan.garcia@demo.co    → trabajador_turnos');
    console.log('  maria.lopez@demo.co    → trabajador_turnos');
    console.log('');
    console.log('  Turnos de Juan García:');
    console.log('    • pendiente    — Montaje Corferias (en 3 días)');
    console.log('    • confirmado   — Zona Franca (mañana) — geofence 1 km');
    console.log('    • en_progreso  — Parque 93 (hoy, ingreso hace 2 h) — timer vivo');
    console.log('    • completado   — CEDI Cota (ayer, $113.850, 7.9 h)');
    console.log('');
    console.log('  Turnos de María López:');
    console.log('    • confirmado   — Teletrabajo (en 2 días) — sin geofence');
    console.log('    • no_presentado — Plaza Américas (hace 2 días)');
    console.log('    • cancelado    — CityPark (hace 3 días)');
    console.log('─────────────────────────────────────────────────────\n');

  } catch (err) {
    console.error('❌ Error en seed:', err.message);
    throw err;
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch(() => process.exit(1));
