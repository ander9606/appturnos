/**
 * Duplicar un turno dentro de un grupo, contra MySQL real: la copia conserva el grupo,
 * y la consulta de una oferta devuelve el nombre y el estado de su grupo.
 * Se salta si no hay base: corre en CI (job "MySQL") o con RUN_DB_TESTS=1 y DB_* en el entorno.
 */
const corre = process.env.RUN_DB_TESTS === '1';
const d = corre ? describe : describe.skip;

d('duplicar turno con grupo (MySQL real)', () => {
  let pool, OfertasModel, empresaId, grupoId;

  const crearTurno = async (grupo) => (await pool.query(
    `INSERT INTO ofertas_turno (empresa_id, grupo_id, titulo, fecha, hora_inicio, hora_fin_estimada, lugar, estado)
     VALUES (?, ?, 'Montaje', '2026-11-09', '08:00:00', '17:00:00', 'Corferias', 'abierta')`,
    [empresaId, grupo]
  ))[0].insertId;

  beforeAll(async () => {
    ({ pool } = require('../../config/database'));
    OfertasModel = require('../../modules/turnos/ofertas/ofertas.model');
    empresaId = (await pool.query(
      "INSERT INTO empresas (nombre, slug, plan) VALUES ('Test dup grupo', ?, 'basico')", [`t-dupg-${Date.now()}`]
    ))[0].insertId;
    grupoId = (await pool.query(
      "INSERT INTO grupos_turno (empresa_id, nombre) VALUES (?, 'Feria del Libro')", [empresaId]
    ))[0].insertId;
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('DELETE FROM oferta_puestos WHERE oferta_id IN (SELECT id FROM ofertas_turno WHERE empresa_id = ?)', [empresaId]);
    await pool.query('DELETE FROM ofertas_turno WHERE empresa_id = ?', [empresaId]);
    await pool.query('DELETE FROM grupos_turno WHERE empresa_id = ?', [empresaId]);
    await pool.query('DELETE FROM empresas WHERE id = ?', [empresaId]);
    await pool.end();
  });

  test('la copia queda en el mismo grupo y el original no cambia', async () => {
    const original = await crearTurno(grupoId);
    const copiaId = await OfertasModel.duplicar(empresaId, original, '2026-11-10', null, null);

    const copia = await OfertasModel.obtenerPorId(empresaId, copiaId);
    expect(copia).toMatchObject({ grupo_id: grupoId, grupo_nombre: 'Feria del Libro', grupo_estado: 'activo', fecha: expect.anything() });
    const viejo = await OfertasModel.obtenerPorId(empresaId, original);
    expect(viejo.grupo_id).toBe(grupoId);
  });

  test('un turno sin grupo se duplica sin grupo, como siempre', async () => {
    const original = await crearTurno(null);
    const copiaId = await OfertasModel.duplicar(empresaId, original, '2026-11-10', null, null);

    const copia = await OfertasModel.obtenerPorId(empresaId, copiaId);
    expect(copia).toMatchObject({ grupo_id: null, grupo_nombre: null, grupo_estado: null });
  });

  test('obtenerPorId refleja el estado del grupo cuando se cierra', async () => {
    const turno = await crearTurno(grupoId);
    await pool.query("UPDATE grupos_turno SET estado = 'cerrado' WHERE id = ?", [grupoId]);
    expect((await OfertasModel.obtenerPorId(empresaId, turno)).grupo_estado).toBe('cerrado');
    await pool.query("UPDATE grupos_turno SET estado = 'activo' WHERE id = ?", [grupoId]);
  });
});
