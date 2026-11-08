/**
 * El nombre del grupo sale en los listados de turnos (etiqueta de las tarjetas), contra MySQL real:
 * ofertas (gestor y trabajador multi-empresa) y asignaciones del trabajador. Un turno sin grupo
 * sigue saliendo igual, con grupo_nombre en NULL.
 * Se salta si no hay base: corre en CI (job "MySQL") o con RUN_DB_TESTS=1 y DB_* en el entorno.
 */
const corre = process.env.RUN_DB_TESTS === '1';
const d = corre ? describe : describe.skip;

d('grupo en los listados de turnos (MySQL real)', () => {
  let pool, OfertasModel, AsignacionesModel;
  let empresaId, usuarioId, trabajadorId, conGrupo, sinGrupo, asigConGrupo, asigSinGrupo;

  const turno = async (titulo, grupoId) => {
    const [o] = await pool.query(
      `INSERT INTO ofertas_turno (empresa_id, grupo_id, titulo, fecha, hora_inicio, hora_fin_estimada, estado, visibilidad)
       VALUES (?, ?, ?, '2026-11-09', '08:00:00', '17:00:00', 'abierta', 'dirigida')`, [empresaId, grupoId, titulo]);
    const [[cargo]] = await pool.query('SELECT id FROM cargos WHERE empresa_id IS NULL LIMIT 1');
    const [p] = await pool.query('INSERT INTO oferta_puestos (oferta_id, cargo_id, plazas, tarifa_dia) VALUES (?, ?, 1, 50000)', [o.insertId, cargo.id]);
    await pool.query('INSERT INTO oferta_destinatarios (oferta_id, trabajador_id) VALUES (?, ?)', [o.insertId, trabajadorId]);
    const [a] = await pool.query(
      "INSERT INTO asignaciones_turno (empresa_id, oferta_id, puesto_id, trabajador_id, estado) VALUES (?, ?, ?, ?, 'confirmado')",
      [empresaId, o.insertId, p.insertId, trabajadorId]);
    return { ofertaId: o.insertId, asignacionId: a.insertId };
  };
  const porTitulo = (filas, titulo) => filas.find((f) => (f.titulo ?? f.oferta_titulo) === titulo);

  beforeAll(async () => {
    ({ pool } = require('../../config/database'));
    OfertasModel = require('../../modules/turnos/ofertas/ofertas.model');
    AsignacionesModel = require('../../modules/turnos/asignaciones/asignaciones.model');
    const marca = Date.now();
    empresaId = (await pool.query("INSERT INTO empresas (nombre, slug, plan) VALUES ('Test listados', ?, 'basico')", [`t-lst-${marca}`]))[0].insertId;
    usuarioId = (await pool.query(
      "INSERT INTO usuarios (empresa_id, nombre, email, password_hash, rol) VALUES (?, 'Ana', ?, 'x', 'trabajador_turnos')", [empresaId, `t-lst-${marca}@test.local`]))[0].insertId;
    trabajadorId = (await pool.query(
      "INSERT INTO trabajadores (empresa_id, usuario_id, nombre, apellido, tipo, activo) VALUES (?, ?, 'Ana', 'Test', 'turnos', 1)", [empresaId, usuarioId]))[0].insertId;
    await pool.query("INSERT INTO trabajador_empresa (trabajador_id, usuario_id, empresa_id, estado, iniciado_por) VALUES (?, ?, ?, 'activo', 'empresa')", [trabajadorId, usuarioId, empresaId]);
    const grupoId = (await pool.query("INSERT INTO grupos_turno (empresa_id, nombre) VALUES (?, 'Feria del Libro')", [empresaId]))[0].insertId;
    ({ ofertaId: conGrupo, asignacionId: asigConGrupo } = await turno('Con grupo', grupoId));
    ({ ofertaId: sinGrupo, asignacionId: asigSinGrupo } = await turno('Sin grupo', null));
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

  const verifica = (filas, tituloConGrupo = 'Con grupo', tituloSinGrupo = 'Sin grupo') => {
    expect(porTitulo(filas, tituloConGrupo)).toMatchObject({ grupo_nombre: 'Feria del Libro', grupo_id: expect.any(Number) });
    expect(porTitulo(filas, tituloSinGrupo)).toMatchObject({ grupo_nombre: null, grupo_id: null });
  };

  test('ofertas: listar (gestor)', async () => {
    const { data } = await OfertasModel.listar(empresaId, { limit: 50, offset: 0 });
    expect(data).toHaveLength(2);
    verifica(data);
  });

  test('ofertas: listarMultiEmpresa (trabajador)', async () => {
    const { data } = await OfertasModel.listarMultiEmpresa(usuarioId, [empresaId], { limit: 50, offset: 0 });
    expect(data).toHaveLength(2);
    verifica(data);
  });

  test('asignaciones: listar (gestor)', async () => {
    const { data } = await AsignacionesModel.listar(empresaId, { limit: 50, offset: 0 });
    expect(data).toHaveLength(2);
    verifica(data);
  });

  test('asignaciones: listarPorTrabajador y listarPorUsuario ("mis turnos")', async () => {
    const porTrabajador = await AsignacionesModel.listarPorTrabajador(empresaId, trabajadorId);
    const porUsuario = await AsignacionesModel.listarPorUsuario(usuarioId);
    expect(porTrabajador).toHaveLength(2);
    expect(porUsuario).toHaveLength(2);
    verifica(porTrabajador);
    verifica(porUsuario);
  });

  test('«mis turnos» trae cómo llama cada empresa a sus grupos (un trabajador en dos empresas ve dos nombres)', async () => {
    // Sin nombre propio → NULL (la app dice «Grupo»); con nombre propio → el de la empresa del turno. Sin grupo → siempre NULL.
    let porUsuario = await AsignacionesModel.listarPorUsuario(usuarioId);
    expect(porTitulo(porUsuario, 'Con grupo').grupo_etiqueta).toBeNull();
    await pool.query("UPDATE empresas SET etiqueta_grupo = 'Evento' WHERE id = ?", [empresaId]);
    porUsuario = await AsignacionesModel.listarPorUsuario(usuarioId);
    expect(porTitulo(porUsuario, 'Con grupo').grupo_etiqueta).toBe('Evento');
    expect(porTitulo(porUsuario, 'Sin grupo').grupo_etiqueta).toBeNull();
    const porTrabajador = await AsignacionesModel.listarPorTrabajador(empresaId, trabajadorId);
    expect(porTitulo(porTrabajador, 'Con grupo').grupo_etiqueta).toBe('Evento');
    await pool.query('UPDATE empresas SET etiqueta_grupo = NULL WHERE id = ?', [empresaId]);
  });

  test('asignaciones: obtenerConDetalles (detalle de un turno)', async () => {
    expect(await AsignacionesModel.obtenerConDetalles(empresaId, asigConGrupo)).toMatchObject({ grupo_nombre: 'Feria del Libro' });
    expect(await AsignacionesModel.obtenerConDetalles(empresaId, asigSinGrupo)).toMatchObject({ grupo_nombre: null, grupo_id: null });
  });

  test('liquidación: cada turno trae su grupo (alimenta la cuenta de cobro agrupada)', async () => {
    // La liquidación solo cuenta turnos completados.
    await pool.query("UPDATE asignaciones_turno SET estado = 'completado', horas_trabajadas = 8, pago_total = 50000 WHERE empresa_id = ?", [empresaId]);
    const [w] = await AsignacionesModel.liquidacion(empresaId, { fechaInicio: '2026-11-01', fechaFin: '2026-11-30' });
    expect(w.turnos).toHaveLength(2);
    expect(w.turnos.find((t) => t.oferta_titulo === 'Con grupo')).toMatchObject({ grupo_nombre: 'Feria del Libro', grupo_id: expect.any(Number) });
    expect(w.turnos.find((t) => t.oferta_titulo === 'Sin grupo')).toMatchObject({ grupo_nombre: null, grupo_id: null });
  });

  test('renombrar el grupo se refleja en los listados (el turno apunta al id, no al texto)', async () => {
    await pool.query("UPDATE grupos_turno SET nombre = 'Feria 2026' WHERE empresa_id = ?", [empresaId]);
    const { data } = await OfertasModel.listar(empresaId, { limit: 50, offset: 0 });
    expect(porTitulo(data, 'Con grupo').grupo_nombre).toBe('Feria 2026');
  });
});
