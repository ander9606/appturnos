/**
 * Costos de un grupo contra MySQL real: lo pagado (completados y fallidos, con descuentos aceptados), lo comprometido
 * (confirmados y en curso), lo frenado por contratos sin firmar, y el aislamiento entre empresas.
 * Se salta si no hay base: corre en CI (job "MySQL") o con RUN_DB_TESTS=1 y DB_* en el entorno.
 */
const corre = process.env.RUN_DB_TESTS === '1';
const d = corre ? describe : describe.skip;

d('costos del grupo (MySQL real)', () => {
  let pool, Servicio, empresaA, empresaB, usuarioId, grupoId, cargoId;
  const trab = {};

  const crearEmpresa = async (m) => (await pool.query(
    "INSERT INTO empresas (nombre, slug, plan, usa_grupos_turno) VALUES (?, ?, 'basico', 1)", [`Test costos ${m}`, `t-cst-${m}-${Date.now()}`]))[0].insertId;
  const trabajador = async (nombre) => (await pool.query(
    "INSERT INTO trabajadores (empresa_id, nombre, apellido, tipo, activo) VALUES (?, ?, 'T', 'turnos', 1)", [empresaA, nombre]))[0].insertId;
  // Un turno con un puesto y una asignación.
  const turno = async ({ trabajadorId, estadoOferta = 'abierta', estado, tarifa = 80000, pago = 0, bono = 0, horas = 0, firmado = null, decision = null, gId = grupoId }) => {
    const [o] = await pool.query(
      `INSERT INTO ofertas_turno (empresa_id, grupo_id, titulo, fecha, hora_inicio, hora_fin_estimada, estado, visibilidad)
       VALUES (?, ?, 'T', '2030-01-10', '08:00:00', '17:00:00', ?, 'dirigida')`, [empresaA, gId, estadoOferta]);
    const [p] = await pool.query('INSERT INTO oferta_puestos (oferta_id, cargo_id, plazas, tarifa_dia) VALUES (?, ?, 1, ?)', [o.insertId, cargoId, tarifa]);
    const [a] = await pool.query(
      `INSERT INTO asignaciones_turno (empresa_id, oferta_id, puesto_id, trabajador_id, estado, pago_total, bono_monto, horas_trabajadas, compensacion_decision)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [empresaA, o.insertId, p.insertId, trabajadorId, estado, pago, bono, horas, decision]);
    if (firmado !== null) {
      // Sin .catch: si el contrato no se crea, la prueba debe fallar y no medir otra cosa.
      await pool.query('INSERT INTO contratos_diarios (empresa_id, asignacion_id, fecha, firmado_trabajador) VALUES (?, ?, ?, ?)',
        [empresaA, a.insertId, '2030-01-10', firmado]);
    }
    return a.insertId;
  };

  beforeAll(async () => {
    ({ pool } = require('../../config/database'));
    Servicio = require('../../modules/grupos-turno/grupos-turno.service');
    empresaA = await crearEmpresa('a');
    empresaB = await crearEmpresa('b');
    usuarioId = (await pool.query(
      "INSERT INTO usuarios (empresa_id, nombre, email, password_hash, rol) VALUES (?, 'Ger', ?, 'x', 'admin_empresa')", [empresaA, `t-cst-${Date.now()}@test.local`]))[0].insertId;
    [cargoId] = (await pool.query('SELECT id FROM cargos WHERE empresa_id IS NULL LIMIT 1'))[0].map((c) => c.id);
    for (const n of ['ana', 'beto', 'cami']) trab[n] = await trabajador(n);
    grupoId = (await pool.query("INSERT INTO grupos_turno (empresa_id, nombre) VALUES (?, 'Feria')", [empresaA]))[0].insertId;
  });

  afterAll(async () => {
    if (!pool) return;
    for (const id of [empresaA, empresaB]) {
      await pool.query('DELETE FROM descuentos_turno WHERE empresa_id = ?', [id]);
      await pool.query('DELETE FROM contratos_diarios WHERE empresa_id = ?', [id]);
      await pool.query('DELETE FROM asignaciones_turno WHERE empresa_id = ?', [id]);
      await pool.query('DELETE FROM oferta_puestos WHERE oferta_id IN (SELECT id FROM ofertas_turno WHERE empresa_id = ?)', [id]);
      await pool.query('DELETE FROM ofertas_turno WHERE empresa_id = ?', [id]);
      await pool.query('DELETE FROM grupos_turno WHERE empresa_id = ?', [id]);
      await pool.query('DELETE FROM trabajadores WHERE empresa_id = ?', [id]);
      await pool.query('DELETE FROM usuarios WHERE empresa_id = ?', [id]);
      await pool.query('DELETE FROM empresas WHERE id = ?', [id]);
    }
    await pool.end();
  });

  test('un grupo sin asignaciones da todo en cero', async () => {
    const r = await Servicio.costos(empresaA, grupoId);
    expect(r).toMatchObject({ proyectado: 0, trabajadores: 0, real: { total: 0 }, estimado: { total: 0 } });
  });

  test('suma lo pagado (con descuentos aceptados y bonos), lo comprometido y lo frenado por falta de firma', async () => {
    // Completado firmado: 100.000 con bono de 15.000 (ya sumado en pago_total) y un descuento aceptado de 5.000.
    const a1 = await turno({ trabajadorId: trab.ana, estado: 'completado', pago: 115000, bono: 15000, horas: 8, firmado: 1 });
    await pool.query("INSERT INTO descuentos_turno (empresa_id, asignacion_id, trabajador_id, monto, motivo, estado, creado_por) VALUES (?,?,?,5000,'Uniforme','aceptado',?), (?,?,?,9000,'Tarde','pendiente',?)",
      [empresaA, a1, trab.ana, usuarioId, empresaA, a1, trab.ana, usuarioId]);
    // Completado sin firmar: 60.000.
    await turno({ trabajadorId: trab.beto, estado: 'completado', pago: 60000, horas: 4, firmado: 0 });
    // En espera: compensación propuesta que el trabajador no ha respondido (no suma ni resta).
    await turno({ trabajadorId: trab.cami, estado: 'completado', pago: 45000, firmado: 1, decision: 'pendiente' });
    // Fallido (compensación): 30.000.
    await turno({ trabajadorId: trab.cami, estado: 'fallido', pago: 30000, estadoOferta: 'cancelada' });
    // Comprometidos: confirmado 80.000 y en curso 90.000.
    await turno({ trabajadorId: trab.ana, estado: 'confirmado', tarifa: 80000 });
    await turno({ trabajadorId: trab.beto, estado: 'en_progreso', tarifa: 90000 });
    // No cuentan: postulación pendiente, cancelado, y un confirmado en un turno cancelado.
    await turno({ trabajadorId: trab.cami, estado: 'pendiente', tarifa: 70000 });
    await turno({ trabajadorId: trab.cami, estado: 'cancelado', tarifa: 70000 });
    await turno({ trabajadorId: trab.cami, estado: 'confirmado', tarifa: 70000, estadoOferta: 'cancelada' });

    const r = await Servicio.costos(empresaA, grupoId);
    // Para pagar = lo firmado (110.000) + el fallido (30.000); lo sin firmar (60.000) va aparte; lo en espera no cuenta.
    expect(r.real).toMatchObject({ total: 110000 + 30000, tarifas: 100000 + 30000, bonos: 15000, descuentos: 5000, turnos_pagados: 2 });
    expect(r.sin_firmar).toEqual({ cantidad: 1, monto: 60000 });
    expect(r.en_espera).toEqual({ cantidad: 1 });
    expect(r.estimado).toEqual({ total: 170000, turnos: 2 });
    expect(r.proyectado).toBe(140000 + 60000 + 170000);
    expect(r.trabajadores).toBe(3);
    expect(r.horas).toBe(12);
  });

  test('otra empresa no ve los costos de este grupo (404), y los grupos de otra empresa no se mezclan', async () => {
    await expect(Servicio.costos(empresaB, grupoId)).rejects.toMatchObject({ statusCode: 404 });
    const otro = (await pool.query("INSERT INTO grupos_turno (empresa_id, nombre) VALUES (?, 'Otro')", [empresaA]))[0].insertId;
    await turno({ trabajadorId: trab.ana, estado: 'completado', pago: 999999, firmado: 1, gId: otro });
    expect((await Servicio.costos(empresaA, grupoId)).real.total).toBe(140000); // sin cambios por el otro grupo
    expect((await Servicio.costos(empresaA, otro)).real.total).toBe(999999);
  });

  test('un grupo que no existe da 404', async () => {
    await expect(Servicio.costos(empresaA, 99999999)).rejects.toMatchObject({ statusCode: 404 });
  });
});
