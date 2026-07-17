/**
 * seed.js — Datos de prueba para AppTurnos
 *
 * Crea una empresa demo con usuarios, trabajadores y turnos en todos los
 * estados posibles para revisar los cambios de la interfaz turno/[id].tsx.
 *
 * Uso: node backend/seeds/seed.js
 *
 * Usuarios creados (contraseña: Demo1234! para todos):
 *   admin@demo.co          — admin_empresa
 *   jefe@demo.co           — jefe_turnos  (recibe notificaciones de ingreso)
 *   juan.garcia@demo.co    — trabajador_turnos
 *   maria.lopez@demo.co    — trabajador_turnos
 *   pedro.ramirez@demo.co  — trabajador_nomina (período quincenal abierto, 5 días registrados)
 *
 * Turnos de Juan García:
 *   1. pendiente   — Corferias en 3 días
 *   2. confirmado  — Zona Franca mañana (geofence 1 km)
 *   3. en_progreso — Parque 93 hoy, ingreso hace 2 h (timer vivo)
 *   4. completado  — CEDI Cota ayer, 7.9 h, $113.850
 *
 * Turnos de María López:
 *   5. confirmado    — Teletrabajo en 2 días (sin geofence)
 *   6. no_presentado — Plaza Américas hace 2 días
 *   7. cancelado     — CityPark hace 3 días
 */
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const bcrypt = require('bcrypt');
const mysql  = require('mysql2/promise');

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 3306,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'app_turnos',
  waitForConnections: true,
  connectionLimit: 5,
});

// ── Helpers ───────────────────────────────────────────────────────────────

function dateStr(d)     { return d.toISOString().slice(0, 10); }
function datetimeStr(d) { return d.toISOString().slice(0, 19).replace('T', ' '); }
function addDays(d, n)  { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function addHours(d, h) { return new Date(d.getTime() + h * 3_600_000); }

async function ins(conn, table, row) {
  const cols = Object.keys(row).join(', ');
  const vals = Object.values(row);
  const ph   = vals.map(() => '?').join(', ');
  const [res] = await conn.execute(
    `INSERT INTO ${table} (${cols}) VALUES (${ph})`, vals,
  );
  return res.insertId;
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const conn = await pool.getConnection();
  const now  = new Date();
  const hoy  = dateStr(now);

  console.log('🌱 Iniciando seed de datos de prueba…');

  try {
    // ── 0. Limpiar datos demo anteriores (sin chequeo de FK temporalmente) ─
    await conn.execute('SET FOREIGN_KEY_CHECKS = 0');
    const [[{ empresaDemoId }]] = await conn.execute(
      `SELECT COALESCE((SELECT id FROM empresas WHERE slug='logistica-demo' LIMIT 1), 0)
       AS empresaDemoId`
    );
    if (empresaDemoId) {
      await conn.execute(`DELETE FROM calificaciones_turno   WHERE empresa_id = ?`, [empresaDemoId]);
      await conn.execute(`DELETE FROM contratos_diarios      WHERE empresa_id = ?`, [empresaDemoId]);
      await conn.execute(`DELETE FROM asignaciones_turno     WHERE empresa_id = ?`, [empresaDemoId]);
      await conn.execute(`DELETE FROM oferta_puestos         WHERE oferta_id IN (SELECT id FROM ofertas_turno WHERE empresa_id = ?)`, [empresaDemoId]);
      await conn.execute(`DELETE FROM ofertas_turno          WHERE empresa_id = ?`, [empresaDemoId]);
      await conn.execute(`DELETE FROM registros_diarios      WHERE empresa_id = ?`, [empresaDemoId]);
      await conn.execute(`DELETE FROM periodos_nomina        WHERE empresa_id = ?`, [empresaDemoId]);
      await conn.execute(`DELETE FROM trabajador_cargos      WHERE trabajador_empresa_id IN (SELECT id FROM trabajador_empresa WHERE empresa_id = ?)`, [empresaDemoId]);
      await conn.execute(`DELETE FROM trabajador_empresa     WHERE empresa_id = ?`, [empresaDemoId]);
      await conn.execute(`DELETE FROM puntos_marcaje         WHERE empresa_id = ?`, [empresaDemoId]);
      await conn.execute(`DELETE FROM cargos                 WHERE empresa_id = ?`, [empresaDemoId]);
      await conn.execute(`DELETE FROM trabajadores WHERE empresa_id = ?`, [empresaDemoId]);
      await conn.execute(`DELETE FROM usuarios     WHERE empresa_id = ?`, [empresaDemoId]);
      // Usuarios trabajadores (empresa_id=NULL) — eliminar por email
      await conn.execute(
        `DELETE FROM usuarios WHERE email IN ('juan.garcia@demo.co','maria.lopez@demo.co')`
      );
      await conn.execute(`DELETE FROM empresas WHERE id = ?`, [empresaDemoId]);
    }
    await conn.execute('SET FOREIGN_KEY_CHECKS = 1');
    console.log('  ✓ Datos anteriores eliminados');

    // ── 1. Empresa ────────────────────────────────────────────────────────
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

    // ── 2. Usuarios de gestión ────────────────────────────────────────────
    const hashPwd = await bcrypt.hash('Demo1234!', 10);

    const adminId = await ins(conn, 'usuarios', {
      empresa_id: empresaId, nombre: 'Carlos', apellido: 'Mendoza',
      email: 'admin@demo.co', password_hash: hashPwd, rol: 'admin_empresa',
    });
    const jefeId = await ins(conn, 'usuarios', {
      empresa_id: empresaId, nombre: 'Laura', apellido: 'Pinzón',
      email: 'jefe@demo.co', password_hash: hashPwd, rol: 'jefe_turnos',
    });
    console.log(`  ✓ Usuarios gestión: admin=${adminId}, jefe=${jefeId}`);

    // ── 3. Usuarios trabajadores (empresa_id=NULL — marketplace) ─────────
    const uJuanId = await ins(conn, 'usuarios', {
      empresa_id: null, nombre: 'Juan', apellido: 'García',
      email: 'juan.garcia@demo.co', password_hash: hashPwd, rol: 'trabajador_turnos',
    });
    const uMariaId = await ins(conn, 'usuarios', {
      empresa_id: null, nombre: 'María', apellido: 'López',
      email: 'maria.lopez@demo.co', password_hash: hashPwd, rol: 'trabajador_turnos',
    });
    console.log(`  ✓ Usuarios trabajadores: juan=${uJuanId}, maria=${uMariaId}`);

    // Trabajador de nómina — empresa_id fijo (no es marketplace, es planta).
    const uPedroId = await ins(conn, 'usuarios', {
      empresa_id: empresaId, nombre: 'Pedro', apellido: 'Ramírez',
      email: 'pedro.ramirez@demo.co', password_hash: hashPwd, rol: 'trabajador_nomina',
    });
    console.log(`  ✓ Usuario nómina: pedro=${uPedroId}`);

    // ── 4. Trabajadores ───────────────────────────────────────────────────
    const tJuanId = await ins(conn, 'trabajadores', {
      empresa_id: empresaId, usuario_id: uJuanId,
      nombre: 'Juan', apellido: 'García', cedula: '1020304050',
      telefono: '3101234567', email: 'juan.garcia@demo.co',
      tipo: 'turnos', cargo: 'Auxiliar', tarifa_hora: 15625,
    });
    const tMariaId = await ins(conn, 'trabajadores', {
      empresa_id: empresaId, usuario_id: uMariaId,
      nombre: 'María', apellido: 'López', cedula: '1030405060',
      telefono: '3209876543', email: 'maria.lopez@demo.co',
      tipo: 'turnos', cargo: 'Auxiliar', tarifa_hora: 15625,
    });
    console.log(`  ✓ Trabajadores: juan=${tJuanId}, maria=${tMariaId}`);

    const tPedroId = await ins(conn, 'trabajadores', {
      empresa_id: empresaId, usuario_id: uPedroId,
      nombre: 'Pedro', apellido: 'Ramírez', cedula: '1040506070',
      telefono: '3157654321', email: 'pedro.ramirez@demo.co',
      tipo: 'nomina', cargo: 'Operario de bodega', salario_base: 1800000,
    });
    console.log(`  ✓ Trabajador nómina: pedro=${tPedroId}`);

    // ── 5. Vínculos trabajador_empresa ────────────────────────────────────
    const teJuanId = await ins(conn, 'trabajador_empresa', {
      usuario_id: uJuanId, empresa_id: empresaId, trabajador_id: tJuanId,
      estado: 'activo', iniciado_por: 'empresa',
      fecha_resuelto: datetimeStr(addDays(now, -30)),
    });
    await ins(conn, 'trabajador_empresa', {
      usuario_id: uMariaId, empresa_id: empresaId, trabajador_id: tMariaId,
      estado: 'activo', iniciado_por: 'empresa',
      fecha_resuelto: datetimeStr(addDays(now, -25)),
    });
    await ins(conn, 'trabajador_empresa', {
      usuario_id: uPedroId, empresa_id: empresaId, trabajador_id: tPedroId,
      estado: 'activo', iniciado_por: 'empresa',
      fecha_resuelto: datetimeStr(addDays(now, -60)),
    });
    console.log('  ✓ Vínculos trabajador_empresa');

    // ── 6. Punto de marcaje fijo ──────────────────────────────────────────
    const puntoId = await ins(conn, 'puntos_marcaje', {
      empresa_id: empresaId, nombre: 'Bodega Central Fontibón',
      descripcion: 'Sede principal — Cra 106 #22D-55, Bogotá',
      latitud: 4.67901, longitud: -74.14803, radio_metros: 150, tipo: 'fijo',
    });
    console.log(`  ✓ Punto de marcaje: id=${puntoId}`);

    // ── 7. Cargos del sistema (empresa_id=NULL, ya existen por migración) ─
    const [[{ cargoAuxiliarId }]] = await conn.execute(
      `SELECT id AS cargoAuxiliarId FROM cargos
       WHERE empresa_id IS NULL AND codigo = 'auxiliar' LIMIT 1`
    );
    const [[{ cargoConductorId }]] = await conn.execute(
      `SELECT id AS cargoConductorId FROM cargos
       WHERE empresa_id IS NULL AND codigo = 'conductor' LIMIT 1`
    );

    // Cargo empresa custom: 'bodeguero' (geofence fijo → Bodega Fontibón)
    const cargoBodegueroId = await ins(conn, 'cargos', {
      empresa_id: empresaId, codigo: 'bodeguero', nombre: 'Bodeguero',
      descripcion: 'Manejo de inventario y logística interna',
      tipo_geofence: 'fijo', punto_marcaje_id: puntoId,
    });
    console.log(`  ✓ Cargos: auxiliar=${cargoAuxiliarId}, conductor=${cargoConductorId}, bodeguero=${cargoBodegueroId}`);

    // ── 8. Ofertas de turno + puestos ─────────────────────────────────────
    // Nota: desde migración 013, `ofertas_turno` ya NO tiene plazas/tarifa.
    //       Esos campos viven en `oferta_puestos`.

    // (a) Pendiente — Corferias en 3 días
    const ofertaPendienteId = await ins(conn, 'ofertas_turno', {
      empresa_id: empresaId,
      titulo: 'Montaje feria Corferias',
      descripcion: 'Apoyo en montaje de stands. Lleva ropa cómoda.',
      fecha: dateStr(addDays(now, 3)),
      hora_inicio: '07:00:00', hora_fin_estimada: '15:00:00',
      lugar: 'Corferias, Cra 37 #24-67, Bogotá',
      latitud: 4.6280, longitud: -74.0905,
      estado: 'abierta', creado_por: jefeId,
    });
    const puestoPendienteId = await ins(conn, 'oferta_puestos', {
      oferta_id: ofertaPendienteId, cargo_id: cargoAuxiliarId,
      plazas: 5, plazas_cubiertas: 1, tarifa_dia: 120000,
    });

    // (b) Confirmado — Zona Franca mañana (geofence oferta 1 km)
    const ofertaConfirmadaId = await ins(conn, 'ofertas_turno', {
      empresa_id: empresaId,
      titulo: 'Descargue contenedor — Zona Franca Bogotá',
      descripcion: 'Descargue de mercancía pesada.',
      fecha: dateStr(addDays(now, 1)),
      hora_inicio: '06:00:00', hora_fin_estimada: '14:00:00',
      lugar: 'Zona Franca Bogotá — Av. Calle 26 #82-70',
      latitud: 4.6890, longitud: -74.1220,
      estado: 'abierta', creado_por: jefeId,
    });
    const puestoConfirmadoId = await ins(conn, 'oferta_puestos', {
      oferta_id: ofertaConfirmadaId, cargo_id: cargoConductorId,
      plazas: 3, plazas_cubiertas: 1, tarifa_dia: 150000,
    });

    // (c) En progreso — Parque 93 hoy, ingresó hace 2 h
    const ofertaEnProgresoId = await ins(conn, 'ofertas_turno', {
      empresa_id: empresaId,
      titulo: 'Evento Parque 93 — bodeguero',
      descripcion: 'Apoyo logístico en evento corporativo.',
      fecha: hoy,
      hora_inicio: '08:00:00', hora_fin_estimada: '17:00:00',
      lugar: 'Parque 93 — Cl. 93 #13-33, Bogotá',
      latitud: 4.6665, longitud: -74.0536,
      estado: 'en_proceso', creado_por: jefeId,
    });
    const puestoEnProgresoId = await ins(conn, 'oferta_puestos', {
      oferta_id: ofertaEnProgresoId, cargo_id: cargoAuxiliarId,
      plazas: 2, plazas_cubiertas: 1, tarifa_dia: 130000,
    });

    // (d) Completado — CEDI Cota ayer, 7.9 h
    const ofertaCompletadaId = await ins(conn, 'ofertas_turno', {
      empresa_id: empresaId,
      titulo: 'Inventario almacén — CEDI Cota',
      descripcion: 'Conteo y organización de inventario.',
      fecha: dateStr(addDays(now, -1)),
      hora_inicio: '07:00:00', hora_fin_estimada: '15:00:00',
      lugar: 'CEDI Cota — Vía Cota-Siberia km 2',
      latitud: 4.8115, longitud: -74.1084,
      estado: 'completada', creado_por: jefeId,
    });
    const puestoCompletadoId = await ins(conn, 'oferta_puestos', {
      oferta_id: ofertaCompletadaId, cargo_id: cargoAuxiliarId,
      plazas: 4, plazas_cubiertas: 2, tarifa_dia: 115000,
    });

    // (e) No presentado — Plaza Américas hace 2 días (María)
    const ofertaNoPresentadoId = await ins(conn, 'ofertas_turno', {
      empresa_id: empresaId,
      titulo: 'Apoyo fuerza de ventas — Plaza Américas',
      fecha: dateStr(addDays(now, -2)),
      hora_inicio: '09:00:00', hora_fin_estimada: '17:00:00',
      lugar: 'Plaza de las Américas — Av. Boyacá 63-99',
      latitud: 4.6095, longitud: -74.1223,
      estado: 'completada', creado_por: jefeId,
    });
    const puestoNoPresentadoId = await ins(conn, 'oferta_puestos', {
      oferta_id: ofertaNoPresentadoId, cargo_id: cargoAuxiliarId,
      plazas: 2, plazas_cubiertas: 0, tarifa_dia: 110000,
    });

    // (f) Cancelado — CityPark hace 3 días (María)
    const ofertaCanceladaId = await ins(conn, 'ofertas_turno', {
      empresa_id: empresaId,
      titulo: 'Soporte logístico — CityPark',
      fecha: dateStr(addDays(now, -3)),
      hora_inicio: '08:00:00', hora_fin_estimada: '16:00:00',
      lugar: 'CityPark — Av. El Dorado, Bogotá',
      latitud: 4.6596, longitud: -74.0815,
      estado: 'cancelada', creado_por: jefeId,
    });
    const puestoCanceladoId = await ins(conn, 'oferta_puestos', {
      oferta_id: ofertaCanceladaId, cargo_id: cargoAuxiliarId,
      plazas: 3, plazas_cubiertas: 0, tarifa_dia: 105000,
    });

    // (g) Confirmado — Teletrabajo en 2 días (María, sin geofence)
    const ofertaLibreId = await ins(conn, 'ofertas_turno', {
      empresa_id: empresaId,
      titulo: 'Atención call center — teletrabajo',
      descripcion: 'Turno remoto, sin requisito de ubicación.',
      fecha: dateStr(addDays(now, 2)),
      hora_inicio: '14:00:00', hora_fin_estimada: '22:00:00',
      lugar: 'Remoto (teletrabajo)',
      latitud: null, longitud: null,
      estado: 'abierta', creado_por: jefeId,
    });
    const puestoLibreId = await ins(conn, 'oferta_puestos', {
      oferta_id: ofertaLibreId, cargo_id: cargoAuxiliarId,
      plazas: 10, plazas_cubiertas: 1, tarifa_dia: 95000,
    });

    console.log('  ✓ Ofertas y puestos creados');

    // ── 9. Asignaciones ───────────────────────────────────────────────────
    const ingresoReal  = addHours(now, -2);
    const ingresoAyer  = new Date(`${dateStr(addDays(now, -1))}T07:05:00`);
    const egresoAyer   = addHours(ingresoAyer, 8);

    // Juan → pendiente
    await ins(conn, 'asignaciones_turno', {
      empresa_id: empresaId, oferta_id: ofertaPendienteId,
      puesto_id: puestoPendienteId, trabajador_id: tJuanId, estado: 'pendiente',
    });

    // Juan → confirmado (geofence activo — habilita "Marcar Ingreso")
    await ins(conn, 'asignaciones_turno', {
      empresa_id: empresaId, oferta_id: ofertaConfirmadaId,
      puesto_id: puestoConfirmadoId, trabajador_id: tJuanId, estado: 'confirmado',
    });

    // Juan → en_progreso (timer corre desde hace 2 h)
    await ins(conn, 'asignaciones_turno', {
      empresa_id: empresaId, oferta_id: ofertaEnProgresoId,
      puesto_id: puestoEnProgresoId, trabajador_id: tJuanId,
      estado: 'en_progreso',
      hora_ingreso_real: datetimeStr(ingresoReal),
      latitud_ingreso: 4.6665, longitud_ingreso: -74.0536,
    });

    // Juan → completado (ayer, 7.9 h, $113.850)
    await ins(conn, 'asignaciones_turno', {
      empresa_id: empresaId, oferta_id: ofertaCompletadaId,
      puesto_id: puestoCompletadoId, trabajador_id: tJuanId,
      estado: 'completado',
      hora_ingreso_real: datetimeStr(ingresoAyer),
      hora_egreso_real:  datetimeStr(egresoAyer),
      latitud_ingreso: 4.8115, longitud_ingreso: -74.1084,
      horas_trabajadas: 7.9, pago_total: 113850, pago_extra: 0,
    });

    // María → no_presentado
    await ins(conn, 'asignaciones_turno', {
      empresa_id: empresaId, oferta_id: ofertaNoPresentadoId,
      puesto_id: puestoNoPresentadoId, trabajador_id: tMariaId,
      estado: 'no_presentado',
    });

    // María → cancelado
    await ins(conn, 'asignaciones_turno', {
      empresa_id: empresaId, oferta_id: ofertaCanceladaId,
      puesto_id: puestoCanceladoId, trabajador_id: tMariaId,
      estado: 'cancelado',
    });

    // María → confirmado sin coords (tipo libre — botón siempre activo)
    await ins(conn, 'asignaciones_turno', {
      empresa_id: empresaId, oferta_id: ofertaLibreId,
      puesto_id: puestoLibreId, trabajador_id: tMariaId,
      estado: 'confirmado',
    });

    console.log('  ✓ Asignaciones creadas');

    // ── 10. Cargos trabajador (requerido por trabajador_cargos) ───────────
    await ins(conn, 'trabajador_cargos', {
      trabajador_empresa_id: teJuanId, cargo_id: cargoAuxiliarId,
      asignado_por: adminId,
    });
    console.log('  ✓ Cargos de trabajadores asignados');

    // ── 11. Nómina de Pedro — período quincenal abierto + 5 días registrados ─
    const periodoId = await ins(conn, 'periodos_nomina', {
      empresa_id: empresaId,
      fecha_inicio: dateStr(addDays(now, -10)),
      fecha_fin: dateStr(addDays(now, 5)),
      tipo: 'quincenal', estado: 'abierto',
    });
    for (let i = 5; i >= 1; i--) {
      const esFestivo = i === 3; // un día con recargo festivo para variedad
      await ins(conn, 'registros_diarios', {
        empresa_id: empresaId, trabajador_id: tPedroId, periodo_id: periodoId,
        fecha: dateStr(addDays(now, -i)),
        hora_entrada: '07:00:00', hora_salida: '15:00:00',
        horas_ordinarias: 8, es_festivo: esFestivo ? 1 : 0,
        horas_festivo: esFestivo ? 8 : 0,
      });
    }
    console.log(`  ✓ Nómina Pedro: período=${periodoId}, 5 registros diarios`);

    // ── Resumen ────────────────────────────────────────────────────────────
    console.log('\n✅ Seed completado.\n');
    console.log('─────────────────────────────────────────────────────');
    console.log('  URL backend:   http://localhost:3001');
    console.log('  Contraseña:    Demo1234!');
    console.log('');
    console.log('  admin@demo.co          → admin_empresa');
    console.log('  jefe@demo.co           → jefe_turnos');
    console.log('  juan.garcia@demo.co    → trabajador_turnos');
    console.log('  maria.lopez@demo.co    → trabajador_turnos');
    console.log('  pedro.ramirez@demo.co  → trabajador_nomina (período abierto, 5 días registrados)');
    console.log('');
    console.log('  Turnos de Juan García:');
    console.log('    • pendiente    — Corferias (en 3 días)');
    console.log('    • confirmado   — Zona Franca (mañana, geofence oferta)');
    console.log('    • en_progreso  — Parque 93 (hoy, ingreso hace 2 h) ← timer vivo');
    console.log('    • completado   — CEDI Cota (ayer, $113.850, 7.9 h)');
    console.log('');
    console.log('  Turnos de María López:');
    console.log('    • confirmado     — Teletrabajo (en 2 días, sin geofence)');
    console.log('    • no_presentado  — Plaza Américas (hace 2 días)');
    console.log('    • cancelado      — CityPark (hace 3 días)');
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
