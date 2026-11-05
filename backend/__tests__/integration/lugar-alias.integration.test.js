/**
 * Nombre corto del lugar (migración 121) contra MySQL real: se guarda al crear y al editar (y se quita con vacío),
 * la copia de un turno lo conserva, lo traen las consultas que alimentan tarjetas y la cuenta de cobro, y un turno
 * sin nombre corto sigue funcionando igual. Los grupos también lo guardan (se copia a sus turnos).
 * Se salta si no hay base: corre en CI (job "MySQL") o con RUN_DB_TESTS=1 y DB_* en el entorno.
 */
const corre = process.env.RUN_DB_TESTS === '1';
const d = corre ? describe : describe.skip;

d('lugar_alias (MySQL real)', () => {
  let pool, OfertasModel, OfertasService, GruposService, AsignacionesModel;
  let empresaId, usuarioId, trabajadorId;
  const creados = [];

  const LARGA = 'Corferias, Carrera 37, Quinta Paredes, Teusaquillo, Bogotá, Bogotá Distrito Capital, Colombia';
  const datosTurno = (extra = {}) => ({
    titulo: 'Montaje', fecha: '2030-01-14', hora_inicio: '08:00:00', hora_fin_estimada: '17:00:00', lugar: LARGA,
    latitud: 4.63, longitud: -74.09, puestos: [], ...extra,
  });

  beforeAll(async () => {
    ({ pool } = require('../../config/database'));
    OfertasModel = require('../../modules/turnos/ofertas/ofertas.model');
    OfertasService = require('../../modules/turnos/ofertas/ofertas.gestion.service');
    GruposService = require('../../modules/grupos-turno/grupos-turno.service');
    AsignacionesModel = require('../../modules/turnos/asignaciones/asignaciones.model');
    const marca = Date.now();
    empresaId = (await pool.query("INSERT INTO empresas (nombre, slug, plan, usa_grupos_turno) VALUES ('Test alias', ?, 'basico', 1)", [`t-alias-${marca}`]))[0].insertId;
    usuarioId = (await pool.query("INSERT INTO usuarios (empresa_id, nombre, email, password_hash, rol) VALUES (?, 'Ana', ?, 'x', 'trabajador_turnos')", [empresaId, `t-alias-${marca}@test.local`]))[0].insertId;
    trabajadorId = (await pool.query("INSERT INTO trabajadores (empresa_id, usuario_id, nombre, apellido, tipo, activo) VALUES (?, ?, 'Ana', 'Test', 'turnos', 1)", [empresaId, usuarioId]))[0].insertId;
    await pool.query("INSERT INTO trabajador_empresa (trabajador_id, usuario_id, empresa_id, estado, iniciado_por) VALUES (?, ?, ?, 'activo', 'empresa')", [trabajadorId, usuarioId, empresaId]);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('DELETE FROM asignaciones_turno WHERE empresa_id = ?', [empresaId]);
    await pool.query('DELETE FROM oferta_destinatarios WHERE oferta_id IN (SELECT id FROM ofertas_turno WHERE empresa_id = ?)', [empresaId]);
    await pool.query('DELETE FROM oferta_puestos WHERE oferta_id IN (SELECT id FROM ofertas_turno WHERE empresa_id = ?)', [empresaId]);
    await pool.query('DELETE FROM ofertas_turno WHERE empresa_id = ?', [empresaId]);
    await pool.query('DELETE FROM grupos_turno WHERE empresa_id = ?', [empresaId]);
    await pool.query('DELETE FROM trabajador_empresa WHERE empresa_id = ?', [empresaId]);
    await pool.query('DELETE FROM trabajadores WHERE empresa_id = ?', [empresaId]);
    await pool.query('DELETE FROM usuarios WHERE empresa_id = ?', [empresaId]);
    await pool.query('DELETE FROM empresas WHERE id = ?', [empresaId]);
    await pool.end();
  });

  test('la migración deja las dos columnas, NULL en lo que ya existía', async () => {
    const [cols] = await pool.query(
      "SELECT TABLE_NAME, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH AS largo FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'lugar_alias' ORDER BY TABLE_NAME"
    );
    expect(cols.map((c) => [c.TABLE_NAME, c.IS_NULLABLE, Number(c.largo)])).toEqual([['grupos_turno', 'YES', 80], ['ofertas_turno', 'YES', 80]]);
  });

  test('crear: sin nombre corto queda NULL (como siempre); con él se guarda', async () => {
    const sin = await OfertasModel.crear(empresaId, datosTurno(), null);
    const con = await OfertasModel.crear(empresaId, datosTurno({ lugar_alias: 'Corferias' }), null);
    creados.push(sin, con);
    expect((await OfertasModel.obtenerPorId(empresaId, sin)).lugar_alias).toBeNull();
    expect(await OfertasModel.obtenerPorId(empresaId, con)).toMatchObject({ lugar_alias: 'Corferias', lugar: LARGA });
  });

  test('editar: cambia el nombre corto y con vacío lo quita, sin tocar la dirección', async () => {
    const id = await OfertasModel.crear(empresaId, datosTurno({ lugar_alias: 'Corferias' }), null);
    await OfertasService.actualizar(empresaId, id, { lugar_alias: 'Feria' });
    expect(await OfertasModel.obtenerPorId(empresaId, id)).toMatchObject({ lugar_alias: 'Feria', lugar: LARGA });
    await OfertasService.actualizar(empresaId, id, { lugar_alias: '   ' });
    expect((await OfertasModel.obtenerPorId(empresaId, id)).lugar_alias).toBeNull();
  });

  test('duplicar conserva el nombre corto', async () => {
    const id = await OfertasModel.crear(empresaId, datosTurno({ lugar_alias: 'Corferias' }), null);
    const copia = await OfertasModel.duplicar(empresaId, id, '2030-01-15', null, null);
    expect(await OfertasModel.obtenerPorId(empresaId, copia)).toMatchObject({ lugar_alias: 'Corferias', lugar: LARGA });
  });

  test('un grupo guarda su nombre corto y se puede quitar', async () => {
    const g = await GruposService.crear(empresaId, { nombre: 'Feria 2030', lugar: LARGA, latitud: 4.63, longitud: -74.09, lugar_alias: 'Corferias' }, null);
    expect(g).toMatchObject({ lugar_alias: 'Corferias', lugar: LARGA });
    expect((await GruposService.actualizar(empresaId, g.id, { lugar_alias: '' })).lugar_alias).toBeNull();
    const sin = await GruposService.crear(empresaId, { nombre: 'Sin alias' }, null);
    expect(sin.lugar_alias).toBeNull();
  });

  test('las consultas de tarjetas y de la liquidación traen el nombre corto', async () => {
    const ofertaId = await OfertasModel.crear(empresaId, datosTurno({ lugar_alias: 'Corferias' }), null);
    const [[cargo]] = await pool.query('SELECT id FROM cargos WHERE empresa_id IS NULL LIMIT 1');
    const [p] = await pool.query('INSERT INTO oferta_puestos (oferta_id, cargo_id, plazas, tarifa_dia) VALUES (?, ?, 1, 50000)', [ofertaId, cargo.id]);
    await pool.query("INSERT INTO asignaciones_turno (empresa_id, oferta_id, puesto_id, trabajador_id, estado, horas_trabajadas, pago_total) VALUES (?, ?, ?, ?, 'completado', 8, 50000)", [empresaId, ofertaId, p.insertId, trabajadorId]);

    const { data } = await OfertasModel.listar(empresaId, { limit: 50, offset: 0 });
    expect(data.find((o) => o.id === ofertaId)).toMatchObject({ lugar_alias: 'Corferias' });
    const mias = await AsignacionesModel.listarPorTrabajador(empresaId, trabajadorId);
    expect(mias[0]).toMatchObject({ lugar_alias: 'Corferias' });
    const [w] = await AsignacionesModel.liquidacion(empresaId, { fechaInicio: '2030-01-01', fechaFin: '2030-01-31' });
    expect(w.turnos[0]).toMatchObject({ lugar_alias: 'Corferias', lugar: LARGA });
  });
});
