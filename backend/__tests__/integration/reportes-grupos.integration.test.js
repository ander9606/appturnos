/**
 * Reporte por grupo contra MySQL real: costo, asistencia y cobertura de cada grupo en el rango, lo que queda sin grupo
 * y el aislamiento entre empresas. Se salta si no hay base: corre en CI (job "MySQL") o con RUN_DB_TESTS=1.
 */
const corre = process.env.RUN_DB_TESTS === '1';
const d = corre ? describe : describe.skip;

d('reporte por grupo (MySQL real)', () => {
  let pool, Servicio, empresaA, empresaB, cargoId, feria, obra;
  const RANGO = { desde: '2031-03-01', hasta: '2031-03-31' };

  const turno = async ({ grupo = null, fecha = '2031-03-10', estadoOferta = 'completada', plazas = 2, cubiertas = 1, asign = [] }) => {
    const [o] = await pool.query(
      `INSERT INTO ofertas_turno (empresa_id, grupo_id, titulo, fecha, hora_inicio, hora_fin_estimada, estado, visibilidad)
       VALUES (?, ?, 'T', ?, '08:00:00', '17:00:00', ?, 'dirigida')`, [empresaA, grupo, fecha, estadoOferta]);
    const [p] = await pool.query('INSERT INTO oferta_puestos (oferta_id, cargo_id, plazas, plazas_cubiertas, tarifa_dia) VALUES (?, ?, ?, ?, 80000)', [o.insertId, cargoId, plazas, cubiertas]);
    for (const [estado, pago] of asign) {
      // Un trabajador por asignación: la base no admite el mismo trabajador dos veces en un turno.
      const trab = (await pool.query("INSERT INTO trabajadores (empresa_id, nombre, apellido, tipo, activo) VALUES (?, 'Ana', 'T', 'turnos', 1)", [empresaA]))[0].insertId;
      await pool.query(
        'INSERT INTO asignaciones_turno (empresa_id, oferta_id, puesto_id, trabajador_id, estado, pago_total) VALUES (?, ?, ?, ?, ?, ?)',
        [empresaA, o.insertId, p.insertId, trab, estado, pago]);
    }
  };

  beforeAll(async () => {
    ({ pool } = require('../../config/database'));
    Servicio = require('../../modules/reportes/reportes.service');
    const mk = async (m) => (await pool.query(
      "INSERT INTO empresas (nombre, slug, plan, usa_grupos_turno) VALUES (?, ?, 'basico', 1)", [`Test rep-grupos ${m}`, `t-rg-${m}-${Date.now()}`]))[0].insertId;
    empresaA = await mk('a');
    empresaB = await mk('b');
    [cargoId] = (await pool.query('SELECT id FROM cargos WHERE empresa_id IS NULL LIMIT 1'))[0].map((c) => c.id);
    feria = (await pool.query("INSERT INTO grupos_turno (empresa_id, nombre) VALUES (?, 'Feria')", [empresaA]))[0].insertId;
    obra = (await pool.query("INSERT INTO grupos_turno (empresa_id, nombre) VALUES (?, 'Obra')", [empresaA]))[0].insertId;

    // Feria: dos turnos en el rango (3 completados, 1 ausente) y uno FUERA del rango que no debe contar.
    await turno({ grupo: feria, asign: [['completado', 100000], ['completado', 100000]] });
    await turno({ grupo: feria, fecha: '2031-03-11', asign: [['completado', 50000], ['no_presentado', 0]] });
    await turno({ grupo: feria, fecha: '2031-05-01', asign: [['completado', 999999]] });
    // Obra: un turno abierto sin nadie asignado (aparece con costo 0) y uno cancelado (no cuenta).
    await turno({ grupo: obra, estadoOferta: 'abierta', plazas: 3, cubiertas: 0 });
    await turno({ grupo: obra, estadoOferta: 'cancelada', plazas: 9, cubiertas: 0 });
    // Sin grupo: cuenta en el total pero no en ningún grupo.
    await turno({ asign: [['completado', 250000]] });
  });

  afterAll(async () => {
    if (!pool) return;
    for (const id of [empresaA, empresaB]) {
      await pool.query('DELETE FROM asignaciones_turno WHERE empresa_id = ?', [id]);
      await pool.query('DELETE FROM oferta_puestos WHERE oferta_id IN (SELECT id FROM ofertas_turno WHERE empresa_id = ?)', [id]);
      await pool.query('DELETE FROM ofertas_turno WHERE empresa_id = ?', [id]);
      await pool.query('DELETE FROM grupos_turno WHERE empresa_id = ?', [id]);
      await pool.query('DELETE FROM trabajadores WHERE empresa_id = ?', [id]);
      await pool.query('DELETE FROM empresas WHERE id = ?', [id]);
    }
    await pool.end();
  });

  test('costo, asistencia y cobertura por grupo dentro del rango, ordenados por costo', async () => {
    const r = await Servicio.porGrupo(empresaA, RANGO);
    expect(r.grupos.map((g) => g.nombre)).toEqual(['Feria', 'Obra']);
    expect(r.grupos[0]).toMatchObject({ grupo_id: feria, turnos: 2, convocados: 4, completados: 3, no_presentados: 1, costo: 250000, plazas: 4, cubiertas: 2 });
    expect(r.grupos[1]).toMatchObject({ grupo_id: obra, turnos: 1, convocados: 0, costo: 0, plazas: 3, cubiertas: 0 });
  });

  test('lo que no tiene grupo cuenta en el total y en el porcentaje', async () => {
    const r = await Servicio.porGrupo(empresaA, RANGO);
    expect(r.sin_grupo).toEqual({ completados: 1, costo: 250000 });
    expect(r.costo_total).toBe(500000);
    expect(r.grupos[0].pct).toBe(50);
  });

  test('el costo total coincide con el costo de turnos del resumen', async () => {
    const r = await Servicio.porGrupo(empresaA, RANGO);
    const resumen = await Servicio.resumen(empresaA, RANGO, { verPagos: false });
    expect(r.costo_total).toBe(resumen.turnos.costo.total);
  });

  test('otra empresa no ve nada de este', async () => {
    expect(await Servicio.porGrupo(empresaB, RANGO)).toMatchObject({ costo_total: 0, grupos: [] });
  });
});
