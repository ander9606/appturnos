/**
 * Migración 120 (grupos de turnos) contra MySQL real: es aditiva, así que lo que más
 * importa es que un turno y una empresa "de siempre" no cambien, y que las reglas de la
 * tabla nueva (nombre único por empresa, coordenadas completas, no borrar con turnos) se
 * cumplan en la base y no solo en el código.
 * Se salta si no hay base: corre en CI (job "MySQL") o con RUN_DB_TESTS=1 y DB_* en el entorno.
 */
const corre = process.env.RUN_DB_TESTS === '1';
const d = corre ? describe : describe.skip;

d('migración 120: grupos de turnos', () => {
  let pool, empresaA, empresaB;

  const crearEmpresa = async (marca) => (await pool.query(
    "INSERT INTO empresas (nombre, slug, plan) VALUES (?, ?, 'basico')", [`Test grupos ${marca}`, `t-grp-${marca}-${Date.now()}`]
  ))[0].insertId;
  const crearGrupo = (empresaId, nombre, extra = {}) => pool.query(
    'INSERT INTO grupos_turno (empresa_id, nombre, lugar, latitud, longitud) VALUES (?,?,?,?,?)',
    [empresaId, nombre, extra.lugar ?? null, extra.lat ?? null, extra.lng ?? null]
  );
  // Misma forma que el INSERT de producción (ofertas.model.js): lista de columnas explícita, sin grupo_id.
  const crearTurno = async (empresaId) => (await pool.query(
    "INSERT INTO ofertas_turno (empresa_id, titulo, fecha, hora_inicio, estado) VALUES (?, 'Turno', '2026-11-02', '08:00:00', 'abierta')",
    [empresaId]
  ))[0].insertId;

  beforeAll(async () => {
    ({ pool } = require('../../config/database'));
    empresaA = await crearEmpresa('a');
    empresaB = await crearEmpresa('b');
  });

  afterAll(async () => {
    if (!pool) return;
    for (const id of [empresaA, empresaB]) {
      await pool.query('DELETE FROM ofertas_turno WHERE empresa_id = ?', [id]);
      await pool.query('DELETE FROM grupos_turno WHERE empresa_id = ?', [id]);
      await pool.query('DELETE FROM empresas WHERE id = ?', [id]);
    }
    await pool.end();
  });

  test('lo existente no cambia: turno sin grupo y empresa con la función apagada', async () => {
    const turnoId = await crearTurno(empresaA);
    const [[turno]] = await pool.query('SELECT grupo_id FROM ofertas_turno WHERE id = ?', [turnoId]);
    const [[empresa]] = await pool.query('SELECT usa_grupos_turno, etiqueta_grupo FROM empresas WHERE id = ?', [empresaA]);
    expect(turno.grupo_id).toBeNull();
    expect(empresa.usa_grupos_turno).toBe(0);
    expect(empresa.etiqueta_grupo).toBeNull();
  });

  test('el nombre es único por empresa (sin importar mayúsculas), pero se puede repetir entre empresas', async () => {
    await crearGrupo(empresaA, 'Feria del Libro');
    await expect(crearGrupo(empresaA, 'Feria del Libro')).rejects.toMatchObject({ errno: 1062 });
    await expect(crearGrupo(empresaA, 'feria del libro')).rejects.toMatchObject({ errno: 1062 });
    await expect(crearGrupo(empresaB, 'Feria del Libro')).resolves.toBeDefined();
  });

  test('las coordenadas van juntas: una latitud sin longitud se rechaza', async () => {
    await expect(crearGrupo(empresaA, 'Sin longitud', { lugar: 'Corferias', lat: 4.63 })).rejects.toThrow();
    await expect(crearGrupo(empresaA, 'Con lugar', { lugar: 'Corferias', lat: 4.63, lng: -74.09 })).resolves.toBeDefined();
  });

  test('un turno solo se vincula a un grupo que existe', async () => {
    const turnoId = await crearTurno(empresaA);
    const [[grupo]] = await pool.query("SELECT id FROM grupos_turno WHERE empresa_id = ? AND nombre = 'Feria del Libro'", [empresaA]);
    await expect(pool.query('UPDATE ofertas_turno SET grupo_id = ? WHERE id = ?', [grupo.id, turnoId])).resolves.toBeDefined();
    await expect(pool.query('UPDATE ofertas_turno SET grupo_id = 99999999 WHERE id = ?', [turnoId])).rejects.toMatchObject({ errno: 1452 });
  });

  test('no se puede borrar un grupo que todavía tiene turnos', async () => {
    const [[grupo]] = await pool.query("SELECT id FROM grupos_turno WHERE empresa_id = ? AND nombre = 'Feria del Libro'", [empresaA]);
    await expect(pool.query('DELETE FROM grupos_turno WHERE id = ?', [grupo.id])).rejects.toMatchObject({ errno: 1451 });
  });
});
