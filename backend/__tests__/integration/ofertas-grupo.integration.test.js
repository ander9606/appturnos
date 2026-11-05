/**
 * Vincular turnos a grupos contra MySQL real: crear con grupo_id (el UPDATE va en la misma
 * transacción que el INSERT) y vincularGrupo con sus reglas (empresa, cerrado, función apagada).
 * Se salta si no hay base: corre en CI (job "MySQL") o con RUN_DB_TESTS=1 y DB_* en el entorno.
 */
const corre = process.env.RUN_DB_TESTS === '1';
const d = corre ? describe : describe.skip;

d('turnos y grupos (MySQL real)', () => {
  let pool, OfertasModel, OfertasService, empresaA, empresaB, grupoA, grupoB;

  const crearEmpresa = async (m, usaGrupos) => (await pool.query(
    "INSERT INTO empresas (nombre, slug, plan, usa_grupos_turno) VALUES (?, ?, 'basico', ?)", [`Test of-grupo ${m}`, `t-ofg-${m}-${Date.now()}`, usaGrupos]
  ))[0].insertId;
  const turno = async (empresaId, estado = 'abierta') => (await pool.query(
    "INSERT INTO ofertas_turno (empresa_id, titulo, fecha, hora_inicio, estado) VALUES (?, 'T', '2026-11-09', '08:00:00', ?)", [empresaId, estado]
  ))[0].insertId;
  const falla = async (promesa, status) => {
    const err = await promesa.then(() => null, (e) => e);
    expect(err?.statusCode).toBe(status);
  };

  beforeAll(async () => {
    ({ pool } = require('../../config/database'));
    OfertasModel = require('../../modules/turnos/ofertas/ofertas.model');
    OfertasService = require('../../modules/turnos/ofertas/ofertas.service');
    empresaA = await crearEmpresa('a', 1);
    empresaB = await crearEmpresa('b', 1);
    grupoA = (await pool.query("INSERT INTO grupos_turno (empresa_id, nombre) VALUES (?, 'Feria')", [empresaA]))[0].insertId;
    grupoB = (await pool.query("INSERT INTO grupos_turno (empresa_id, nombre) VALUES (?, 'Obra')", [empresaB]))[0].insertId;
  });

  afterAll(async () => {
    if (!pool) return;
    for (const id of [empresaA, empresaB]) {
      await pool.query('DELETE FROM oferta_puestos WHERE oferta_id IN (SELECT id FROM ofertas_turno WHERE empresa_id = ?)', [id]);
      await pool.query('DELETE FROM ofertas_turno WHERE empresa_id = ?', [id]);
      await pool.query('DELETE FROM grupos_turno WHERE empresa_id = ?', [id]);
      await pool.query('DELETE FROM empresas WHERE id = ?', [id]);
    }
    await pool.end();
  });

  test('OfertasModel.crear con grupo_id deja el turno en el grupo; sin grupo_id, sin grupo', async () => {
    const base = { titulo: 'Montaje', fecha: '2026-11-09', hora_inicio: '08:00:00' };
    const conGrupo = await OfertasModel.crear(empresaA, { ...base, grupo_id: grupoA }, null);
    const sinGrupo = await OfertasModel.crear(empresaA, base, null);
    expect(await OfertasModel.obtenerPorId(empresaA, conGrupo)).toMatchObject({ grupo_id: grupoA, grupo_nombre: 'Feria', grupo_estado: 'activo' });
    expect(await OfertasModel.obtenerPorId(empresaA, sinGrupo)).toMatchObject({ grupo_id: null, grupo_nombre: null });
  });

  test('vincularGrupo: vincula, cambia y saca del grupo (incluso un turno ya completado)', async () => {
    const t = await turno(empresaA, 'completada');
    expect(await OfertasService.vincularGrupo(empresaA, t, grupoA)).toMatchObject({ grupo_id: grupoA, grupo_nombre: 'Feria' });
    const otro = (await pool.query("INSERT INTO grupos_turno (empresa_id, nombre) VALUES (?, 'Otro')", [empresaA]))[0].insertId;
    expect((await OfertasService.vincularGrupo(empresaA, t, otro)).grupo_nombre).toBe('Otro');
    expect(await OfertasService.vincularGrupo(empresaA, t, null)).toMatchObject({ grupo_id: null, grupo_nombre: null });
  });

  test('un grupo de otra empresa no se puede usar (404) ni se alcanza un turno ajeno', async () => {
    const t = await turno(empresaA);
    await falla(OfertasService.vincularGrupo(empresaA, t, grupoB), 404);
    await falla(OfertasService.vincularGrupo(empresaB, t, grupoB), 404); // el turno es de A
    expect((await OfertasModel.obtenerPorId(empresaA, t)).grupo_id).toBeNull();
  });

  test('grupo cerrado: 409; al reabrirlo se puede', async () => {
    const t = await turno(empresaA);
    await pool.query("UPDATE grupos_turno SET estado = 'cerrado' WHERE id = ?", [grupoA]);
    await falla(OfertasService.vincularGrupo(empresaA, t, grupoA), 409);
    await pool.query("UPDATE grupos_turno SET estado = 'activo' WHERE id = ?", [grupoA]);
    await expect(OfertasService.vincularGrupo(empresaA, t, grupoA)).resolves.toMatchObject({ grupo_id: grupoA });
  });

  test('con la función apagada en la empresa: 403, pero sacar un turno del grupo sigue siendo posible', async () => {
    const t = await turno(empresaA);
    await OfertasService.vincularGrupo(empresaA, t, grupoA);
    await pool.query('UPDATE empresas SET usa_grupos_turno = 0 WHERE id = ?', [empresaA]);
    await falla(OfertasService.vincularGrupo(empresaA, t, grupoA), 403);
    await expect(OfertasService.vincularGrupo(empresaA, t, null)).resolves.toMatchObject({ grupo_id: null });
    await pool.query('UPDATE empresas SET usa_grupos_turno = 1 WHERE id = ?', [empresaA]);
  });
});
