/**
 * Integración de reportes contra MySQL 8 real (el resto de la suite mockea la DB,
 * así que aquí es donde se ejecuta el SQL de verdad: ONLY_FULL_GROUP_BY, índices…).
 * Se salta si no hay base: corre en CI (job "MySQL") o con RUN_DB_TESTS=1 y DB_* en el entorno.
 */
const corre = process.env.RUN_DB_TESTS === '1';
const d = corre ? describe : describe.skip;

d('reportes con MySQL real', () => {
  let pool, ReportesService, ctrl;
  let empresaId, obreroId, turnistaId;

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
    await pool.query(
      `INSERT INTO registros_diarios (empresa_id, trabajador_id, periodo_id, fecha, horas_ordinarias, horas_extra_diurnas)
       VALUES (?,?,?,'2026-03-02',8,2), (?,?,?,'2026-03-03',8,0), (?,?,?,'2026-03-04',8,0)`,
      [empresaId, obreroId, p.insertId, empresaId, obreroId, p.insertId, empresaId, obreroId, p.insertId]);

    const [[cargo]] = await pool.query("SELECT id FROM cargos WHERE empresa_id IS NULL LIMIT 1");
    const [o] = await pool.query(
      "INSERT INTO ofertas_turno (empresa_id, titulo, fecha, hora_inicio, estado) VALUES (?, 'Evento', '2026-03-05', '08:00:00', 'completada')", [empresaId]);
    const [pu] = await pool.query('INSERT INTO oferta_puestos (oferta_id, cargo_id, plazas, plazas_cubiertas, tarifa_dia) VALUES (?,?,2,1,90000)', [o.insertId, cargo.id]);
    await pool.query(
      "INSERT INTO asignaciones_turno (empresa_id, oferta_id, puesto_id, trabajador_id, estado, pago_total, bono_monto) VALUES (?,?,?,?, 'completado', 100000, 10000)",
      [empresaId, o.insertId, pu.insertId, turnistaId]);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('DELETE FROM asignaciones_turno WHERE empresa_id = ?', [empresaId]);
    await pool.query('DELETE FROM oferta_puestos WHERE oferta_id IN (SELECT id FROM ofertas_turno WHERE empresa_id = ?)', [empresaId]);
    for (const t of ['registros_diarios', 'periodos_nomina', 'ofertas_turno', 'trabajadores']) {
      await pool.query(`DELETE FROM ${t} WHERE empresa_id = ?`, [empresaId]);
    }
    await pool.query('DELETE FROM empresas WHERE id = ?', [empresaId]);
    await pool.end();
  });

  const rango = { desde: '2026-03-01', hasta: '2026-03-15' };

  it('resumen con nómina: suma turnos, bonos y nómina', async () => {
    const r = await ReportesService.resumen(empresaId, rango, { verPagos: true });
    expect(r.costo.turnos).toBe(100000);
    expect(r.desglose.bonos).toBe(10000);
    expect(r.desglose.turnos).toBe(90000);
    expect(r.costo.nomina).toBeGreaterThan(0);
    expect(r.costo.total).toBeCloseTo(r.costo.turnos + r.costo.nomina, 2);
    expect(r.cobertura).toEqual({ plazas: 2, cubiertas: 1, pct: 50 });
    expect(r.turnos).toEqual({ convocados: 1, completados: 1, no_presentados: 0 });
    expect(r.insights.some((i) => i.id === 'cobertura_baja')).toBe(true);
  });

  it('resumen sin verPagos no trae nada de nómina', async () => {
    const r = await ReportesService.resumen(empresaId, rango, { verPagos: false });
    expect(r.costo.nomina).toBeNull();
    expect(r.costo.total).toBe(100000);
    expect(JSON.stringify(r)).not.toMatch(/horas_extra|Ana/);
  });

  it('período previo vacío no divide por cero', async () => {
    const r = await ReportesService.resumen(empresaId, rango, { verPagos: true });
    expect(r.costo.previo).toBe(0);
    expect(r.costo.delta_pct).toBeNull();
  });

  it('GET costos: jefe_turnos no recibe el detalle por trabajador, jefe_nomina sí', async () => {
    const llamar = async (rol) => {
      let body;
      await ctrl.costos({ empresa_id: empresaId, usuario: { rol }, query: rango }, { json: (b) => { body = b; } });
      return body.data;
    };
    expect((await llamar('jefe_turnos')).nomina).toBeNull();
    expect((await llamar('jefe_nomina')).nomina.detalle).toHaveLength(1);
    expect((await llamar('admin_empresa')).nomina.detalle).toHaveLength(1);
  });

  it('personas: horas promedio solo con verPagos y turnos agrupados por cargo', async () => {
    const con = await ReportesService.personas(empresaId, rango, { verPagos: true });
    expect(con.horas.ranking).toHaveLength(1);
    expect(con.horas.ranking[0]).toMatchObject({ horas: 26, dias: 3, prom_dia: 8.67 });
    expect(con.cargos).toHaveLength(1);
    expect(con.cargos[0]).toMatchObject({ total_turnos: 1, total_pago: 100000, rotable: false });
    expect(con.cargos[0].personas[0]).toMatchObject({ turnos: 1, pago: 100000 });

    const sin = await ReportesService.personas(empresaId, rango, { verPagos: false });
    expect(sin.horas).toBeNull();
    expect(sin.cargos).toHaveLength(1); // el reparto de turnos lo ven también los jefes de turnos
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
