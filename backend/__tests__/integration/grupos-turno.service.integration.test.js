/**
 * Servicio de grupos de turnos contra MySQL real: nombre único, lugar completo, fechas y fase
 * calculadas, cierre/reapertura y aislamiento entre empresas.
 * Se salta si no hay base: corre en CI (job "MySQL") o con RUN_DB_TESTS=1 y DB_* en el entorno.
 */
const corre = process.env.RUN_DB_TESTS === '1';
const d = corre ? describe : describe.skip;

const sumarDias = (n) => new Date(Date.now() - 5 * 3_600_000 + n * 86_400_000).toISOString().slice(0, 10);

d('grupos de turnos (MySQL real)', () => {
  let pool, Servicio, empresaA, empresaB;

  const crearEmpresa = async (m) => (await pool.query(
    "INSERT INTO empresas (nombre, slug, plan, usa_grupos_turno) VALUES (?, ?, 'basico', 1)", [`Test grupos ${m}`, `t-gsv-${m}-${Date.now()}`]
  ))[0].insertId;
  const turno = async (grupoId, fecha, estado = 'abierta', empresaId = empresaA) => (await pool.query(
    `INSERT INTO ofertas_turno (empresa_id, grupo_id, titulo, fecha, hora_inicio, hora_fin_estimada, estado)
     VALUES (?, ?, 'T', ?, '08:00:00', '17:00:00', ?)`, [empresaId, grupoId, fecha, estado]
  ))[0].insertId;
  const falla = async (promesa, status) => {
    const err = await promesa.then(() => null, (e) => e);
    expect(err).not.toBeNull();
    expect(err.statusCode).toBe(status);
    return err;
  };

  beforeAll(async () => {
    ({ pool } = require('../../config/database'));
    Servicio = require('../../modules/grupos-turno/grupos-turno.service');
    empresaA = await crearEmpresa('a');
    empresaB = await crearEmpresa('b');
  });

  afterAll(async () => {
    if (!pool) return;
    for (const id of [empresaA, empresaB]) {
      await pool.query('DELETE FROM asignaciones_turno WHERE empresa_id = ?', [id]);
      await pool.query('DELETE FROM trabajadores WHERE empresa_id = ?', [id]);
      await pool.query('DELETE FROM oferta_puestos WHERE oferta_id IN (SELECT id FROM ofertas_turno WHERE empresa_id = ?)', [id]);
      await pool.query('DELETE FROM ofertas_turno WHERE empresa_id = ?', [id]);
      await pool.query('DELETE FROM grupos_turno WHERE empresa_id = ?', [id]);
      await pool.query('DELETE FROM empresas WHERE id = ?', [id]);
    }
    await pool.end();
  });

  test('crear: queda activo, sin turnos y con la fase "sin_turnos"', async () => {
    const g = await Servicio.crear(empresaA, { nombre: 'Feria del Libro' }, null);
    expect(g).toMatchObject({ nombre: 'Feria del Libro', estado: 'activo', total_turnos: 0, fecha_inicio: null, fase: 'sin_turnos' });
  });

  test('nombre repetido: 409 con el id del grupo existente; en otra empresa sí se permite', async () => {
    const existente = await Servicio.crear(empresaA, { nombre: 'Obra Norte' }, null);
    const err = await falla(Servicio.crear(empresaA, { nombre: 'obra norte' }, null), 409);
    expect(err.detalles[0]).toMatchObject({ campo: 'nombre', grupo_id: existente.id });
    await expect(Servicio.crear(empresaB, { nombre: 'Obra Norte' }, null)).resolves.toMatchObject({ nombre: 'Obra Norte' });
  });

  test('el lugar va completo (dirección + coordenadas) o no va', async () => {
    await falla(Servicio.crear(empresaA, { nombre: 'Sin coords', lugar: 'Corferias' }, null), 422);
    await falla(Servicio.crear(empresaA, { nombre: 'Solo lat', latitud: 4.6, longitud: null }, null), 422);
    const g = await Servicio.crear(empresaA, { nombre: 'Con lugar', lugar: 'Corferias', latitud: 4.63, longitud: -74.09 }, null);
    expect(g).toMatchObject({ lugar: 'Corferias', latitud: 4.63, longitud: -74.09 });
    // PATCH con solo una parte se valida contra lo guardado
    await falla(Servicio.actualizar(empresaA, g.id, { lugar: null }), 422);
    const sinLugar = await Servicio.actualizar(empresaA, g.id, { lugar: null, latitud: null, longitud: null });
    expect(sinLugar).toMatchObject({ lugar: null, latitud: null, longitud: null });
  });

  test('renombrar: cambia el nombre, y chocar con otro grupo da 409', async () => {
    const a = await Servicio.crear(empresaA, { nombre: 'Montaje' }, null);
    await Servicio.crear(empresaA, { nombre: 'Desmontaje' }, null);
    expect((await Servicio.actualizar(empresaA, a.id, { nombre: 'Montaje v2' })).nombre).toBe('Montaje v2');
    await falla(Servicio.actualizar(empresaA, a.id, { nombre: 'Desmontaje' }), 409);
  });

  test('fechas, conteo y fase se calculan con los turnos (los cancelados no cuentan)', async () => {
    const futuro = await Servicio.crear(empresaA, { nombre: 'Futuro' }, null);
    await turno(futuro.id, sumarDias(10)); await turno(futuro.id, sumarDias(12)); await turno(futuro.id, sumarDias(40), 'cancelada');
    const detalle = await Servicio.obtener(empresaA, futuro.id);
    expect(detalle).toMatchObject({ total_turnos: 2, fecha_inicio: sumarDias(10), fecha_fin: sumarDias(12), fase: 'proximo' });
    expect(detalle.turnos).toHaveLength(3); // el detalle sí muestra el cancelado
    expect(detalle.turnos.map((t) => t.fecha)).toEqual([sumarDias(10), sumarDias(12), sumarDias(40)]);

    const curso = await Servicio.crear(empresaA, { nombre: 'En curso' }, null);
    await turno(curso.id, sumarDias(-1), 'completada'); await turno(curso.id, sumarDias(1));
    expect((await Servicio.obtener(empresaA, curso.id)).fase).toBe('en_curso');

    const pasado = await Servicio.crear(empresaA, { nombre: 'Pasado' }, null);
    await turno(pasado.id, sumarDias(-9), 'completada');
    expect((await Servicio.obtener(empresaA, pasado.id)).fase).toBe('terminado');
  });

  test('cerrar: no con turnos sin terminar ni con alguien trabajando; sí cuando todo terminó. Reabrir lo deja activo', async () => {
    const g = await Servicio.crear(empresaA, { nombre: 'Para cerrar' }, null);
    const abierto = await turno(g.id, sumarDias(3));
    const err = await falla(Servicio.cerrar(empresaA, g.id), 409);
    expect(err.message).toContain('1 turno sin terminar');

    await pool.query("UPDATE ofertas_turno SET estado = 'cancelada' WHERE id = ?", [abierto]);
    const pasado = await turno(g.id, sumarDias(-2), 'completada');
    const [t] = await pool.query("INSERT INTO trabajadores (empresa_id, nombre, apellido, tipo, activo) VALUES (?, 'Ana', 'Test', 'turnos', 1)", [empresaA]);
    const [[cargo]] = await pool.query('SELECT id FROM cargos WHERE empresa_id IS NULL LIMIT 1');
    const [pu] = await pool.query('INSERT INTO oferta_puestos (oferta_id, cargo_id, plazas, tarifa_dia) VALUES (?, ?, 1, 50000)', [pasado, cargo.id]);
    await pool.query("INSERT INTO asignaciones_turno (empresa_id, oferta_id, puesto_id, trabajador_id, estado) VALUES (?, ?, ?, ?, 'en_progreso')", [empresaA, pasado, pu.insertId, t.insertId]);
    await falla(Servicio.cerrar(empresaA, g.id), 409); // alguien sigue marcado como trabajando

    await pool.query("UPDATE asignaciones_turno SET estado = 'completado' WHERE oferta_id = ?", [pasado]);
    const cerrado = await Servicio.cerrar(empresaA, g.id);
    expect(cerrado).toMatchObject({ estado: 'cerrado', fase: 'cerrado' });
    expect(cerrado.cerrado_at).not.toBeNull();
    await falla(Servicio.cerrar(empresaA, g.id), 409);

    const reabierto = await Servicio.reabrir(empresaA, g.id);
    expect(reabierto).toMatchObject({ estado: 'activo', cerrado_at: null });
    await falla(Servicio.reabrir(empresaA, g.id), 409);
  });

  test('listar filtra por estado y obtener respeta la empresa', async () => {
    const g = await Servicio.crear(empresaA, { nombre: 'Archivado' }, null);
    await Servicio.cerrar(empresaA, g.id);
    const activos = (await Servicio.listar(empresaA)).map((x) => x.nombre);
    const cerrados = (await Servicio.listar(empresaA, 'cerrado')).map((x) => x.nombre);
    const todos = (await Servicio.listar(empresaA, 'todos')).map((x) => x.nombre);
    expect(activos).not.toContain('Archivado');
    expect(cerrados).toContain('Archivado');
    expect(todos).toEqual(expect.arrayContaining(['Archivado', 'Feria del Libro']));
    // la empresa B no ve ni alcanza los grupos de A
    expect((await Servicio.listar(empresaB, 'todos')).map((x) => x.nombre)).not.toContain('Archivado');
    await falla(Servicio.obtener(empresaB, g.id), 404);
    await falla(Servicio.cerrar(empresaB, g.id), 404);
    await falla(Servicio.actualizar(empresaB, g.id, { nombre: 'Robado' }), 404);
  });
});
