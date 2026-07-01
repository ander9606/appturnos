/**
 * seed-plataforma-turnos.js
 *
 * Agrega trabajadores_turnos a "Plataforma de Prueba S.A.S" (empresa_id=3)
 * con ofertas y asignaciones en todos los estados posibles.
 *
 * Uso: node backend/seeds/seed-plataforma-turnos.js
 *
 * Usuarios creados (contraseña: Demo1234!):
 *   luis.herrera@plataforma-prueba.co   — trabajador_turnos
 *   sofia.reyes@plataforma-prueba.co    — trabajador_turnos
 *   camilo.torres@plataforma-prueba.co  — trabajador_turnos
 *
 * Asignaciones de Luis Herrera:
 *   1. pendiente    — Bodega Norte (en 4 días)
 *   2. confirmado   — Terminal de Carga (mañana, geofence)
 *   3. en_progreso  — Plaza Mayor hoy (ingreso hace 2h, timer vivo)
 *   4. completado   — CEDI Siberia ayer (8.2h, $131.200)
 *
 * Asignaciones de Sofía Reyes:
 *   5. confirmado     — Evento Ágora (en 2 días, sin geofence)
 *   6. no_presentado  — Almacén 7 (hace 2 días)
 *
 * Asignaciones de Camilo Torres:
 *   7. cancelado    — Feria Expo (hace 3 días)
 *   8. confirmado   — Descargue El Dorado (en 3 días)
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

function dateStr(d)     { return d.toISOString().slice(0, 10); }
function datetimeStr(d) { return d.toISOString().slice(0, 19).replace('T', ' '); }
function addDays(d, n)  { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function addHours(d, h) { return new Date(d.getTime() + h * 3_600_000); }

async function ins(conn, table, row) {
  const cols = Object.keys(row).join(', ');
  const vals = Object.values(row);
  const ph   = vals.map(() => '?').join(', ');
  const [res] = await conn.execute(`INSERT INTO ${table} (${cols}) VALUES (${ph})`, vals);
  return res.insertId;
}

async function main() {
  const conn = await pool.getConnection();
  const now  = new Date();
  const hoy  = dateStr(now);

  console.log('🌱 Seed trabajadores_turnos → Plataforma de Prueba S.A.S…');

  try {
    // ── 0. Empresa y jefe ────────────────────────────────────────────────
    const [[empresa]] = await conn.execute(
      `SELECT id FROM empresas WHERE nombre LIKE '%Plataforma de Prueba%' LIMIT 1`
    );
    if (!empresa) throw new Error('Empresa "Plataforma de Prueba S.A.S" no encontrada. Ejecutá las migraciones primero.');
    const empresaId = empresa.id;

    const [[jefe]] = await conn.execute(
      `SELECT id FROM usuarios WHERE empresa_id = ? AND rol = 'jefe_turnos' LIMIT 1`, [empresaId]
    );
    if (!jefe) throw new Error('No hay jefe_turnos en esa empresa.');
    const jefeId = jefe.id;

    // ── 1. Limpiar runs anteriores de este seed ──────────────────────────
    await conn.execute('SET FOREIGN_KEY_CHECKS = 0');
    const emails = [
      'luis.herrera@plataforma-prueba.co',
      'sofia.reyes@plataforma-prueba.co',
      'camilo.torres@plataforma-prueba.co',
    ];
    const placeholders = emails.map(() => '?').join(',');
    const [[{ cnt }]] = await conn.execute(
      `SELECT COUNT(*) AS cnt FROM usuarios WHERE email IN (${placeholders})`, emails
    );
    if (cnt > 0) {
      const [urows] = await conn.execute(
        `SELECT id FROM usuarios WHERE email IN (${placeholders})`, emails
      );
      const uIds = urows.map((r) => r.id);
      const uPh  = uIds.map(() => '?').join(',');
      const [trows] = await conn.execute(
        `SELECT id FROM trabajadores WHERE usuario_id IN (${uPh}) AND empresa_id = ?`,
        [...uIds, empresaId]
      );
      if (trows.length) {
        const tIds = trows.map((r) => r.id);
        const tPh  = tIds.map(() => '?').join(',');
        const [terows] = await conn.execute(
          `SELECT id FROM trabajador_empresa WHERE trabajador_id IN (${tPh})`, tIds
        );
        if (terows.length) {
          const tePh = terows.map(() => '?').join(',');
          await conn.execute(
            `DELETE FROM trabajador_cargos WHERE trabajador_empresa_id IN (${tePh})`,
            terows.map((r) => r.id)
          );
        }
        await conn.execute(`DELETE FROM asignaciones_turno WHERE trabajador_id IN (${tPh})`, tIds);
        await conn.execute(`DELETE FROM trabajador_empresa  WHERE trabajador_id IN (${tPh})`, tIds);
        await conn.execute(`DELETE FROM trabajadores        WHERE id            IN (${tPh})`, tIds);
      }
      await conn.execute(`DELETE FROM usuarios WHERE email IN (${placeholders})`, emails);
      console.log('  ✓ Datos anteriores eliminados');
    }
    await conn.execute('SET FOREIGN_KEY_CHECKS = 1');

    // ── 2. Cargos del sistema ────────────────────────────────────────────
    const [[{ cargoAuxId }]] = await conn.execute(
      `SELECT id AS cargoAuxId FROM cargos WHERE empresa_id IS NULL AND codigo = 'auxiliar' LIMIT 1`
    );
    const [[{ cargoConductorId }]] = await conn.execute(
      `SELECT id AS cargoConductorId FROM cargos WHERE empresa_id IS NULL AND codigo = 'conductor' LIMIT 1`
    );

    // ── 3. Punto de marcaje ──────────────────────────────────────────────
    const puntoId = await ins(conn, 'puntos_marcaje', {
      empresa_id: empresaId, nombre: 'Bodega Norte Plataforma',
      descripcion: 'Bodega logística norte — Cra 68 #80-40, Bogotá',
      latitud: 4.7120, longitud: -74.0833, radio_metros: 200, tipo: 'fijo',
    });

    // ── 4. Usuarios y trabajadores ───────────────────────────────────────
    const hashPwd = await bcrypt.hash('Demo1234!', 10);

    const uLuisId = await ins(conn, 'usuarios', {
      empresa_id: empresaId, nombre: 'Luis', apellido: 'Herrera',
      email: 'luis.herrera@plataforma-prueba.co',
      password_hash: hashPwd, rol: 'trabajador_turnos',
    });
    const uSofiaId = await ins(conn, 'usuarios', {
      empresa_id: empresaId, nombre: 'Sofía', apellido: 'Reyes',
      email: 'sofia.reyes@plataforma-prueba.co',
      password_hash: hashPwd, rol: 'trabajador_turnos',
    });
    const uCamiloId = await ins(conn, 'usuarios', {
      empresa_id: empresaId, nombre: 'Camilo', apellido: 'Torres',
      email: 'camilo.torres@plataforma-prueba.co',
      password_hash: hashPwd, rol: 'trabajador_turnos',
    });

    const tLuisId = await ins(conn, 'trabajadores', {
      empresa_id: empresaId, usuario_id: uLuisId,
      nombre: 'Luis', apellido: 'Herrera', cedula: '1075432198',
      telefono: '3156781234', email: 'luis.herrera@plataforma-prueba.co',
      tipo: 'turnos', cargo: 'Auxiliar logístico', tarifa_hora: 16000, ranking: 4.5,
    });
    const tSofiaId = await ins(conn, 'trabajadores', {
      empresa_id: empresaId, usuario_id: uSofiaId,
      nombre: 'Sofía', apellido: 'Reyes', cedula: '1023456789',
      telefono: '3189876543', email: 'sofia.reyes@plataforma-prueba.co',
      tipo: 'turnos', cargo: 'Auxiliar logístico', tarifa_hora: 16000, ranking: 3.8,
    });
    const tCamiloId = await ins(conn, 'trabajadores', {
      empresa_id: empresaId, usuario_id: uCamiloId,
      nombre: 'Camilo', apellido: 'Torres', cedula: '1098765432',
      telefono: '3142345678', email: 'camilo.torres@plataforma-prueba.co',
      tipo: 'turnos', cargo: 'Conductor', tarifa_hora: 18000, ranking: 4.0,
    });
    console.log(`  ✓ Trabajadores: luis=${tLuisId}, sofia=${tSofiaId}, camilo=${tCamiloId}`);

    // ── 5. Vínculos trabajador_empresa ───────────────────────────────────
    const teLuisId = await ins(conn, 'trabajador_empresa', {
      usuario_id: uLuisId, empresa_id: empresaId, trabajador_id: tLuisId,
      estado: 'activo', iniciado_por: 'empresa',
      fecha_resuelto: datetimeStr(addDays(now, -60)),
    });
    await ins(conn, 'trabajador_empresa', {
      usuario_id: uSofiaId, empresa_id: empresaId, trabajador_id: tSofiaId,
      estado: 'activo', iniciado_por: 'empresa',
      fecha_resuelto: datetimeStr(addDays(now, -30)),
    });
    await ins(conn, 'trabajador_empresa', {
      usuario_id: uCamiloId, empresa_id: empresaId, trabajador_id: tCamiloId,
      estado: 'activo', iniciado_por: 'empresa',
      fecha_resuelto: datetimeStr(addDays(now, -45)),
    });

    // Cargo asignado a Luis
    await ins(conn, 'trabajador_cargos', {
      trabajador_empresa_id: teLuisId, cargo_id: cargoAuxId,
      asignado_por: jefeId,
    });

    // ── 6. Ofertas ───────────────────────────────────────────────────────

    // (a) pendiente — Bodega Norte en 4 días
    const oBodegaId = await ins(conn, 'ofertas_turno', {
      empresa_id: empresaId, creado_por: jefeId,
      titulo: 'Descargue Bodega Norte',
      descripcion: 'Descargue y clasificación de mercancía.',
      fecha: dateStr(addDays(now, 4)),
      hora_inicio: '06:00:00', hora_fin_estimada: '14:00:00',
      lugar: 'Bodega Norte — Cra 68 #80-40, Bogotá',
      latitud: 4.7120, longitud: -74.0833, estado: 'abierta',
    });
    const pBodegaId = await ins(conn, 'oferta_puestos', {
      oferta_id: oBodegaId, cargo_id: cargoAuxId,
      plazas: 4, plazas_cubiertas: 1, tarifa_dia: 128000,
    });

    // (b) confirmado — Terminal de Carga mañana (geofence fijo)
    const oTerminalId = await ins(conn, 'ofertas_turno', {
      empresa_id: empresaId, creado_por: jefeId,
      titulo: 'Cargue Terminal Puente Aéreo',
      descripcion: 'Cargue de mercancía en terminal aérea.',
      fecha: dateStr(addDays(now, 1)),
      hora_inicio: '05:00:00', hora_fin_estimada: '13:00:00',
      lugar: 'Terminal de Carga Puente Aéreo — Av. El Dorado',
      latitud: 4.7016, longitud: -74.1469, estado: 'abierta',
    });
    const pTerminalId = await ins(conn, 'oferta_puestos', {
      oferta_id: oTerminalId, cargo_id: cargoConductorId,
      plazas: 2, plazas_cubiertas: 1, tarifa_dia: 144000,
    });

    // (c) en_progreso — Plaza Mayor hoy, Luis ingresó hace 2h
    const oPlazaId = await ins(conn, 'ofertas_turno', {
      empresa_id: empresaId, creado_por: jefeId,
      titulo: 'Montaje evento Plaza Mayor',
      descripcion: 'Apoyo en montaje de stands para feria.',
      fecha: hoy,
      hora_inicio: '07:00:00', hora_fin_estimada: '15:00:00',
      lugar: 'Plaza Mayor Bogotá — Cra 69 #98-68',
      latitud: 4.7028, longitud: -74.0913, estado: 'en_proceso',
    });
    const pPlazaId = await ins(conn, 'oferta_puestos', {
      oferta_id: oPlazaId, cargo_id: cargoAuxId,
      plazas: 3, plazas_cubiertas: 1, tarifa_dia: 120000,
    });

    // (d) completado — CEDI Siberia ayer, Luis 8.2h
    const oCediId = await ins(conn, 'ofertas_turno', {
      empresa_id: empresaId, creado_por: jefeId,
      titulo: 'Inventario CEDI Siberia',
      descripcion: 'Conteo físico de inventario.',
      fecha: dateStr(addDays(now, -1)),
      hora_inicio: '06:00:00', hora_fin_estimada: '14:00:00',
      lugar: 'CEDI Siberia — Autopista Medellín km 4',
      latitud: 4.7268, longitud: -74.1502, estado: 'completada',
    });
    const pCediId = await ins(conn, 'oferta_puestos', {
      oferta_id: oCediId, cargo_id: cargoAuxId,
      plazas: 5, plazas_cubiertas: 2, tarifa_dia: 128000,
    });

    // (e) confirmado — Evento Ágora en 2 días, Sofía (sin geofence)
    const oAgoraId = await ins(conn, 'ofertas_turno', {
      empresa_id: empresaId, creado_por: jefeId,
      titulo: 'Soporte logístico Ágora Bogotá',
      descripcion: 'Apoyo en evento corporativo. Sin requisito de ubicación.',
      fecha: dateStr(addDays(now, 2)),
      hora_inicio: '13:00:00', hora_fin_estimada: '21:00:00',
      lugar: 'Ágora Bogotá Convention Center — Cl. 24 #38-47',
      latitud: null, longitud: null, estado: 'abierta',
    });
    const pAgoraId = await ins(conn, 'oferta_puestos', {
      oferta_id: oAgoraId, cargo_id: cargoAuxId,
      plazas: 8, plazas_cubiertas: 1, tarifa_dia: 110000,
    });

    // (f) no_presentado — Almacén 7 hace 2 días, Sofía
    const oAlmacenId = await ins(conn, 'ofertas_turno', {
      empresa_id: empresaId, creado_por: jefeId,
      titulo: 'Apoyo Almacén 7 — Zona Industrial',
      fecha: dateStr(addDays(now, -2)),
      hora_inicio: '08:00:00', hora_fin_estimada: '16:00:00',
      lugar: 'Zona Industrial Puente Aranda — Cl. 13 #50-50',
      latitud: 4.6258, longitud: -74.1022, estado: 'completada',
    });
    const pAlmacenId = await ins(conn, 'oferta_puestos', {
      oferta_id: oAlmacenId, cargo_id: cargoAuxId,
      plazas: 2, plazas_cubiertas: 0, tarifa_dia: 112000,
    });

    // (g) cancelado — Feria Expo hace 3 días, Camilo
    const oFeriaId = await ins(conn, 'ofertas_turno', {
      empresa_id: empresaId, creado_por: jefeId,
      titulo: 'Feria Expo Logística',
      fecha: dateStr(addDays(now, -3)),
      hora_inicio: '08:00:00', hora_fin_estimada: '17:00:00',
      lugar: 'Corferias — Cra 37 #24-67',
      latitud: 4.6280, longitud: -74.0905, estado: 'cancelada',
    });
    const pFeriaId = await ins(conn, 'oferta_puestos', {
      oferta_id: oFeriaId, cargo_id: cargoConductorId,
      plazas: 2, plazas_cubiertas: 0, tarifa_dia: 144000,
    });

    // (h) confirmado — Descargue El Dorado en 3 días, Camilo
    const oEldoradoId = await ins(conn, 'ofertas_turno', {
      empresa_id: empresaId, creado_por: jefeId,
      titulo: 'Descargue mercancía — El Dorado',
      descripcion: 'Transporte y descargue de carga liviana.',
      fecha: dateStr(addDays(now, 3)),
      hora_inicio: '04:00:00', hora_fin_estimada: '12:00:00',
      lugar: 'Aeropuerto El Dorado — Área de carga',
      latitud: 4.7016, longitud: -74.1469, estado: 'abierta',
    });
    const pEldoradoId = await ins(conn, 'oferta_puestos', {
      oferta_id: oEldoradoId, cargo_id: cargoConductorId,
      plazas: 1, plazas_cubiertas: 1, tarifa_dia: 144000,
    });

    console.log('  ✓ Ofertas y puestos creados');

    // ── 7. Asignaciones ──────────────────────────────────────────────────
    const ingresoHoy  = addHours(now, -2);
    const ingresoAyer = new Date(`${dateStr(addDays(now, -1))}T06:05:00`);
    const egresoAyer  = addHours(ingresoAyer, 8.2);

    // Luis
    await ins(conn, 'asignaciones_turno', {
      empresa_id: empresaId, oferta_id: oBodegaId,   puesto_id: pBodegaId,
      trabajador_id: tLuisId, estado: 'pendiente',
    });
    await ins(conn, 'asignaciones_turno', {
      empresa_id: empresaId, oferta_id: oTerminalId, puesto_id: pTerminalId,
      trabajador_id: tLuisId, estado: 'confirmado',
    });
    await ins(conn, 'asignaciones_turno', {
      empresa_id: empresaId, oferta_id: oPlazaId,    puesto_id: pPlazaId,
      trabajador_id: tLuisId, estado: 'en_progreso',
      hora_ingreso_real: datetimeStr(ingresoHoy),
      latitud_ingreso: 4.7028, longitud_ingreso: -74.0913,
    });
    await ins(conn, 'asignaciones_turno', {
      empresa_id: empresaId, oferta_id: oCediId,     puesto_id: pCediId,
      trabajador_id: tLuisId, estado: 'completado',
      hora_ingreso_real: datetimeStr(ingresoAyer),
      hora_egreso_real:  datetimeStr(egresoAyer),
      latitud_ingreso: 4.7268, longitud_ingreso: -74.1502,
      horas_trabajadas: 8.2, pago_total: 131200, pago_extra: 0,
    });

    // Sofía
    await ins(conn, 'asignaciones_turno', {
      empresa_id: empresaId, oferta_id: oAgoraId,   puesto_id: pAgoraId,
      trabajador_id: tSofiaId, estado: 'confirmado',
    });
    await ins(conn, 'asignaciones_turno', {
      empresa_id: empresaId, oferta_id: oAlmacenId, puesto_id: pAlmacenId,
      trabajador_id: tSofiaId, estado: 'no_presentado',
    });

    // Camilo
    await ins(conn, 'asignaciones_turno', {
      empresa_id: empresaId, oferta_id: oFeriaId,    puesto_id: pFeriaId,
      trabajador_id: tCamiloId, estado: 'cancelado',
    });
    await ins(conn, 'asignaciones_turno', {
      empresa_id: empresaId, oferta_id: oEldoradoId, puesto_id: pEldoradoId,
      trabajador_id: tCamiloId, estado: 'confirmado',
    });

    console.log('  ✓ Asignaciones creadas');

    console.log('\n✅ Seed completado.\n');
    console.log('─────────────────────────────────────────────────────────────────');
    console.log('  Empresa: Plataforma de Prueba S.A.S   Contraseña: Demo1234!');
    console.log('');
    console.log('  luis.herrera@plataforma-prueba.co   → trabajador_turnos');
    console.log('    • pendiente    — Bodega Norte (en 4 días)');
    console.log('    • confirmado   — Terminal Puente Aéreo (mañana, geofence)');
    console.log('    • en_progreso  — Plaza Mayor (hoy, ingreso hace 2h) ← timer vivo');
    console.log('    • completado   — CEDI Siberia (ayer, 8.2h, $131.200)');
    console.log('');
    console.log('  sofia.reyes@plataforma-prueba.co    → trabajador_turnos');
    console.log('    • confirmado     — Evento Ágora (en 2 días, sin geofence)');
    console.log('    • no_presentado  — Almacén 7 (hace 2 días)');
    console.log('');
    console.log('  camilo.torres@plataforma-prueba.co  → trabajador_turnos');
    console.log('    • cancelado   — Feria Expo (hace 3 días)');
    console.log('    • confirmado  — Descargue El Dorado (en 3 días)');
    console.log('─────────────────────────────────────────────────────────────────\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    throw err;
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch(() => process.exit(1));
