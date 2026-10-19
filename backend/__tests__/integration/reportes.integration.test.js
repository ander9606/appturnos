/**
 * Integración de reportes contra MySQL 8 real (el resto de la suite mockea la DB,
 * así que aquí es donde se ejecuta el SQL de verdad: ONLY_FULL_GROUP_BY, índices…).
 * Se salta si no hay base: corre en CI (job "MySQL") o con RUN_DB_TESTS=1 y DB_* en el entorno.
 */
const corre = process.env.RUN_DB_TESTS === '1';
const d = corre ? describe : describe.skip;

d('reportes con MySQL real', () => {
  let pool, ReportesService, ctrl;
  let empresaId, obreroId, turnistaId, ofertaId, puestoId, periodoId;

  beforeAll(async () => {
    ({ pool } = require('../../config/database'));
    ReportesService = require('../../modules/reportes/reportes.service');
    ctrl = require('../../modules/reportes/reportes.controller');

    const [e] = await pool.query("INSERT INTO empresas (nombre, slug, plan) VALUES ('Test reportes', ?, 'basico')", [`t-rep-${Date.now()}`]);
    empresaId = e.insertId;
    const mk = async (tipo, extra = {}) => (await pool.query(
      'INSERT INTO trabajadores (empresa_id, nombre, apellido, tipo, tarifa_hora, activo) VALUES (?,?,?,?,?,1)',
      [empresaId, 'Ana', tipo, tipo, extra.tarifa ?? null]))[0].insertId;
    obreroId = await mk('nomina', { tarifa: 10000 });
    turnistaId = await mk('turnos');

    const [p] = await pool.query("INSERT INTO periodos_nomina (empresa_id, fecha_inicio, fecha_fin) VALUES (?, '2026-03-01', '2026-03-15')", [empresaId]);
    periodoId = p.insertId;
    await pool.query(
      `INSERT INTO registros_diarios (empresa_id, trabajador_id, periodo_id, fecha, horas_ordinarias, horas_extra_diurnas)
       VALUES (?,?,?,'2026-03-02',8,2), (?,?,?,'2026-03-03',8,0), (?,?,?,'2026-03-04',8,0)`,
      [empresaId, obreroId, p.insertId, empresaId, obreroId, p.insertId, empresaId, obreroId, p.insertId]);

    const [[cargo]] = await pool.query("SELECT id FROM cargos WHERE empresa_id IS NULL LIMIT 1");
    const [o] = await pool.query(
      "INSERT INTO ofertas_turno (empresa_id, titulo, fecha, hora_inicio, estado) VALUES (?, 'Evento', '2026-03-05', '08:00:00', 'completada')", [empresaId]);
    ofertaId = o.insertId;
    const [pu] = await pool.query('INSERT INTO oferta_puestos (oferta_id, cargo_id, plazas, plazas_cubiertas, tarifa_dia) VALUES (?,?,2,1,90000)', [o.insertId, cargo.id]);
    puestoId = pu.insertId;
    await pool.query(
      "INSERT INTO asignaciones_turno (empresa_id, oferta_id, puesto_id, trabajador_id, estado, pago_total, bono_monto) VALUES (?,?,?,?, 'completado', 100000, 10000)",
      [empresaId, o.insertId, pu.insertId, turnistaId]);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('DELETE FROM calificaciones_turno WHERE empresa_id = ?', [empresaId]);
    await pool.query('DELETE FROM asignaciones_turno WHERE empresa_id = ?', [empresaId]);
    await pool.query('DELETE FROM oferta_puestos WHERE oferta_id IN (SELECT id FROM ofertas_turno WHERE empresa_id = ?)', [empresaId]);
    for (const t of ['registros_diarios', 'periodos_nomina', 'ofertas_turno', 'trabajadores']) {
      await pool.query(`DELETE FROM ${t} WHERE empresa_id = ?`, [empresaId]);
    }
    await pool.query('DELETE FROM empresas WHERE id = ?', [empresaId]);
    await pool.end();
  });

  const rango = { desde: '2026-03-01', hasta: '2026-03-15' };

  it('resumen: turnos y nómina por separado, sin total combinado', async () => {
    const r = await ReportesService.resumen(empresaId, rango, { verPagos: true });
    expect(r.turnos.costo.total).toBe(100000);
    expect(r.turnos.desglose).toEqual({ tarifas: 90000, bonos: 10000 });
    expect(r.nomina.costo.total).toBeGreaterThan(0);
    expect(r.nomina.desglose.ordinario).toBeGreaterThan(0);
    expect(r).not.toHaveProperty('costo');
    expect(r.turnos.cobertura).toEqual({ plazas: 2, cubiertas: 1, pct: 50 });
    expect([r.turnos.convocados, r.turnos.completados, r.turnos.no_presentados]).toEqual([1, 1, 0]);
    expect(r.turnos.insights.some((i) => i.id === 'turnos_cobertura_baja')).toBe(true);
    expect(r.nomina.insights.every((i) => i.id.startsWith('nomina_'))).toBe(true);
  });

  it('resumen sin verPagos no trae nada de nómina', async () => {
    const r = await ReportesService.resumen(empresaId, rango, { verPagos: false });
    expect(r.nomina).toBeNull();
    expect(r.turnos.costo.total).toBe(100000);
    expect(JSON.stringify(r)).not.toMatch(/horas_extra|Ana/);
  });

  it('período previo vacío no divide por cero', async () => {
    const r = await ReportesService.resumen(empresaId, rango, { verPagos: true });
    expect(r.turnos.costo.previo).toBe(0);
    expect(r.turnos.costo.delta_pct).toBeNull();
    expect(r.nomina.costo.delta_pct).toBeNull();
  });

  it('GET costos: jefe_turnos no recibe el detalle por trabajador; jefe_nomina y nomina sí', async () => {
    const llamar = async (rol) => {
      let body;
      await ctrl.costos({ empresa_id: empresaId, usuario: { rol }, query: rango }, { json: (b) => { body = b; } });
      return body.data;
    };
    expect((await llamar('jefe_turnos')).nomina).toBeNull();
    expect((await llamar('jefe_nomina')).nomina.detalle).toHaveLength(1);
    expect((await llamar('nomina')).nomina.detalle).toHaveLength(1);
    expect((await llamar('admin_empresa')).nomina.detalle).toHaveLength(1);
  });

  it('personas: bloques de turnos y de nómina separados', async () => {
    const con = await ReportesService.personas(empresaId, rango, { verPagos: true });
    expect(con.nomina.horas.ranking).toHaveLength(1);
    expect(con.nomina.horas.ranking[0]).toMatchObject({ horas: 26, dias: 3, prom_dia: 8.67 });
    expect(con.nomina.jornadas).toMatchObject({ jornadas: 3, promedio: 8.67 });
    expect(con.nomina.jornadas.mas_larga).toMatchObject({ horas: 10, fecha: '2026-03-02' });
    expect(con.nomina.jornadas.mas_corta.horas).toBe(8);
    expect(con.turnos.jornadas).toBeNull(); // el turno de prueba no tiene horas_trabajadas
    expect(con.turnos.cargos).toHaveLength(1);
    expect(con.turnos.cargos[0]).toMatchObject({ total_turnos: 1, total_pago: 100000, rotable: false });
    expect(con.turnos.cargos[0].personas[0]).toMatchObject({ turnos: 1, pago: 100000 });
    // el obrero de nómina no aparece en el análisis de turnos, ni el turnista en el de nómina
    expect(JSON.stringify(con.turnos)).not.toMatch(new RegExp(`"trabajador_id":${obreroId}[,}]`));
    expect(JSON.stringify(con.nomina)).not.toMatch(new RegExp(`"trabajador_id":${turnistaId}[,}]`));

    const sin = await ReportesService.personas(empresaId, rango, { verPagos: false });
    expect(sin.nomina).toBeNull();
    expect(sin.turnos.cargos).toHaveLength(1); // el reparto de turnos lo ven también los jefes de turnos
  });

  it('el tipo del trabajador decide a qué lado cuenta (datos cruzados no se mezclan)', async () => {
    const antesT = await ReportesService.resumen(empresaId, rango, { verPagos: true });
    const antesP = await ReportesService.personas(empresaId, rango, { verPagos: true });

    // Un trabajador de nómina con un turno completado y uno de turnos con registros diarios
    const mk = async (tipo) => (await pool.query(
      'INSERT INTO trabajadores (empresa_id, nombre, apellido, tipo, tarifa_hora, activo) VALUES (?,?,?,?,?,1)',
      [empresaId, 'Cruzado', tipo, tipo, tipo === 'nomina' ? 10000 : null]))[0].insertId;
    const nominaConTurno = await mk('nomina');
    const turnosConRegistro = await mk('turnos');
    await pool.query(
      "INSERT INTO asignaciones_turno (empresa_id, oferta_id, puesto_id, trabajador_id, estado, pago_total, horas_trabajadas) VALUES (?,?,?,?, 'completado', 70000, 12)",
      [empresaId, ofertaId, puestoId, nominaConTurno]);
    await pool.query(
      `INSERT INTO registros_diarios (empresa_id, trabajador_id, periodo_id, fecha, horas_ordinarias, horas_extra_diurnas)
       VALUES (?,?,?,'2026-03-05',8,4)`, [empresaId, turnosConRegistro, periodoId]);

    const t = await ReportesService.resumen(empresaId, rango, { verPagos: true });
    const p = await ReportesService.personas(empresaId, rango, { verPagos: true });
    expect(t.turnos).toEqual(antesT.turnos);
    expect(t.nomina).toEqual(antesT.nomina);
    expect(p.turnos).toEqual(antesP.turnos);
    expect(p.nomina).toEqual(antesP.nomina);
    const asis = await ReportesService.asistencia(empresaId, rango);
    expect(JSON.stringify(asis.turnos)).not.toMatch(/Cruzado/);
    expect(JSON.stringify(asis.nomina)).not.toMatch(/Cruzado/);
  });

  it('calificaciones: cuenta solo las manuales de trabajadores de turnos y detecta lo que falta calificar', async () => {
    const abril = { desde: '2026-04-01', hasta: '2026-04-15' };
    const [[cargo]] = await pool.query('SELECT id FROM cargos WHERE empresa_id IS NULL LIMIT 1');
    const [o] = await pool.query("INSERT INTO ofertas_turno (empresa_id, titulo, fecha, hora_inicio, estado) VALUES (?, 'Cal', '2026-04-05', '08:00:00', 'completada')", [empresaId]);
    const [pu] = await pool.query('INSERT INTO oferta_puestos (oferta_id, cargo_id, plazas, plazas_cubiertas, tarifa_dia) VALUES (?,?,5,5,90000)', [o.insertId, cargo.id]);
    const mk = async (tipo) => (await pool.query('INSERT INTO trabajadores (empresa_id, nombre, apellido, tipo, activo) VALUES (?,?,?,?,1)', [empresaId, 'Cal', tipo, tipo]))[0].insertId;
    const asig = async (trab, estado) => (await pool.query(
      'INSERT INTO asignaciones_turno (empresa_id, oferta_id, puesto_id, trabajador_id, estado, pago_total) VALUES (?,?,?,?,?,90000)',
      [empresaId, o.insertId, pu.insertId, trab, estado]))[0].insertId;
    const cal = (a, trab, c, por) => pool.query('INSERT INTO calificaciones_turno (empresa_id, asignacion_id, trabajador_id, calificacion, calificado_por) VALUES (?,?,?,?,?)', [empresaId, a, trab, c, por]);
    const [ta, tb, tc, td] = [await mk('turnos'), await mk('turnos'), await mk('turnos'), await mk('turnos')];
    const nom = await mk('nomina');
    await cal(await asig(ta, 'completado'), ta, 5, 1);
    await cal(await asig(tb, 'completado'), tb, 3, 1);
    await asig(tc, 'completado');                                  // completado sin calificar
    await cal(await asig(td, 'no_presentado'), td, 0, null);       // 0 automático: no cuenta
    await cal(await asig(nom, 'completado'), nom, 1, 1);           // trabajador de nómina: no cuenta

    const r = await ReportesService.resumen(empresaId, abril, { verPagos: false });
    expect(r.turnos.calificaciones).toMatchObject({ promedio: 4, calificadas: 2, sin_calificar: 1, delta: null, distribucion: { 1: 0, 3: 1, 5: 1 } });
    const p = await ReportesService.personas(empresaId, abril, { verPagos: false });
    const persona = p.turnos.cargos[0].personas.find((x) => x.trabajador_id === ta);
    expect(persona.calificacion).toEqual({ promedio: 5, n: 1 });
    expect(p.turnos.calificaciones).toEqual({ mejores: [], peores: [] }); // con 1 calificación no se juzga a nadie
  });

  it('el índice (empresa_id, fecha) existe (migración 113)', async () => {
    const [idx] = await pool.query("SHOW INDEX FROM registros_diarios WHERE Key_name = 'idx_rd_empresa_fecha'");
    expect(idx.map((i) => i.Column_name)).toEqual(['empresa_id', 'fecha']);
  });

  it('asistencia e historial también corren con ONLY_FULL_GROUP_BY', async () => {
    await expect(ReportesService.asistencia(empresaId, rango)).resolves.toBeDefined();
    await expect(ReportesService.historialTrabajador(empresaId, obreroId, rango)).resolves.toBeDefined();
  });
});
