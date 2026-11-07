/**
 * Un grupo que se parte entre dos quincenas: la liquidación de cada rango dice cuántos turnos del grupo caen dentro
 * («3 de 4») y cuántos quedan para después, contra MySQL real. Los turnos cancelados no cuentan.
 * Se salta si no hay base: corre en CI (job "MySQL") o con RUN_DB_TESTS=1 y DB_* en el entorno.
 */
const corre = process.env.RUN_DB_TESTS === '1';
const d = corre ? describe : describe.skip;

d('avance del grupo en la liquidación (MySQL real)', () => {
  let pool, AsignacionesModel, empresaId, trabajadorId, grupoId;

  const turno = async (fecha, estadoOferta, estadoAsig) => {
    const [o] = await pool.query(
      `INSERT INTO ofertas_turno (empresa_id, grupo_id, titulo, fecha, hora_inicio, hora_fin_estimada, estado, visibilidad)
       VALUES (?, ?, 'Evento', ?, '08:00:00', '17:00:00', ?, 'dirigida')`, [empresaId, grupoId, fecha, estadoOferta]);
    if (!estadoAsig) return;
    const [[cargo]] = await pool.query('SELECT id FROM cargos WHERE empresa_id IS NULL LIMIT 1');
    const [p] = await pool.query('INSERT INTO oferta_puestos (oferta_id, cargo_id, plazas, tarifa_dia) VALUES (?, ?, 1, 50000)', [o.insertId, cargo.id]);
    await pool.query(
      `INSERT INTO asignaciones_turno (empresa_id, oferta_id, puesto_id, trabajador_id, estado, horas_trabajadas, pago_total)
       VALUES (?, ?, ?, ?, ?, 8, 50000)`, [empresaId, o.insertId, p.insertId, trabajadorId, estadoAsig]);
  };

  const progreso = async (fechaInicio, fechaFin) => {
    const lista = await AsignacionesModel.liquidacion(empresaId, { fechaInicio, fechaFin });
    return lista[0].turnos.map((t) => t.grupo_progreso)[0];
  };

  beforeAll(async () => {
    ({ pool } = require('../../config/database'));
    AsignacionesModel = require('../../modules/turnos/asignaciones/asignaciones.model');
    const marca = Date.now();
    empresaId = (await pool.query("INSERT INTO empresas (nombre, slug, plan) VALUES ('Test parcial', ?, 'basico')", [`t-par-${marca}`]))[0].insertId;
    const usuarioId = (await pool.query(
      "INSERT INTO usuarios (empresa_id, nombre, email, password_hash, rol) VALUES (?, 'Ana', ?, 'x', 'trabajador_turnos')", [empresaId, `t-par-${marca}@test.local`]))[0].insertId;
    trabajadorId = (await pool.query(
      "INSERT INTO trabajadores (empresa_id, usuario_id, nombre, apellido, tipo, activo) VALUES (?, ?, 'Ana', 'Test', 'turnos', 1)", [empresaId, usuarioId]))[0].insertId;
    grupoId = (await pool.query("INSERT INTO grupos_turno (empresa_id, nombre) VALUES (?, 'Feria')", [empresaId]))[0].insertId;
    await turno('2030-01-05', 'completada', 'completado');
    await turno('2030-01-08', 'completada', 'completado');
    await turno('2030-01-12', 'completada', 'completado');
    await turno('2030-01-16', 'completada', 'completado');
    await turno('2030-01-20', 'cancelada', null); // no cuenta
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('DELETE FROM asignaciones_turno WHERE empresa_id = ?', [empresaId]);
    await pool.query('DELETE FROM oferta_puestos WHERE oferta_id IN (SELECT id FROM ofertas_turno WHERE empresa_id = ?)', [empresaId]);
    await pool.query('DELETE FROM ofertas_turno WHERE empresa_id = ?', [empresaId]);
    await pool.query('DELETE FROM grupos_turno WHERE empresa_id = ?', [empresaId]);
    await pool.query('DELETE FROM trabajadores WHERE empresa_id = ?', [empresaId]);
    await pool.query('DELETE FROM usuarios WHERE empresa_id = ?', [empresaId]);
    await pool.query('DELETE FROM empresas WHERE id = ?', [empresaId]);
    await pool.end();
  });

  test('primera quincena: 3 de 4, y el siguiente turno es el 16', async () => {
    expect(await progreso('2030-01-01', '2030-01-15')).toEqual({ total: 4, en_periodo: 3, despues: 1, proxima: '2030-01-16' });
  });

  test('segunda quincena: 1 de 4, nada pendiente después', async () => {
    expect(await progreso('2030-01-16', '2030-01-31')).toEqual({ total: 4, en_periodo: 1, despues: 0, proxima: null });
  });

  test('un rango libre sin fechas no calcula avance (null)', async () => {
    expect(await progreso(undefined, undefined)).toBeNull();
  });
});
