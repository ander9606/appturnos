/**
 * Opciones de grupos de turnos contra MySQL real: cada admin enciende la función solo para su
 * empresa (las demás siguen apagadas) y el middleware que protege las rutas responde según eso.
 * Se salta si no hay base: corre en CI (job "MySQL") o con RUN_DB_TESTS=1 y DB_* en el entorno.
 */
const corre = process.env.RUN_DB_TESTS === '1';
const d = corre ? describe : describe.skip;

d('opciones de grupos de turnos por empresa (MySQL real)', () => {
  let pool, EmpresasService, requiereGruposTurno, empresaA, empresaB;
  const auditoria = { usuario_id: 1, usuario_nombre: 'Ana', usuario_rol: 'admin_empresa', ip: '127.0.0.1' };

  const crearEmpresa = async (m) => (await pool.query(
    "INSERT INTO empresas (nombre, slug, plan) VALUES (?, ?, 'basico')", [`Test opciones ${m}`, `t-opc-${m}-${Date.now()}`]
  ))[0].insertId;
  // Lo que ve el middleware para una empresa: next() sin error = pasa; con error = lo corta.
  const gate = (empresaId) => new Promise((resolve) => requiereGruposTurno({ empresa_id: empresaId }, {}, resolve));

  beforeAll(async () => {
    ({ pool } = require('../../config/database'));
    EmpresasService = require('../../modules/empresas/empresas.service');
    requiereGruposTurno = require('../../middleware/requiereGruposTurno');
    empresaA = await crearEmpresa('a');
    empresaB = await crearEmpresa('b');
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('DELETE FROM empresas WHERE id IN (?, ?)', [empresaA, empresaB]);
    await pool.end();
  });

  test('una empresa nueva nace con los grupos apagados y sin etiqueta', async () => {
    expect(await EmpresasService.opcionesGruposTurno(empresaA)).toEqual({ usa_grupos_turno: false, etiqueta_grupo: null });
    expect(await EmpresasService.miEmpresa(empresaA)).toMatchObject({ usa_grupos_turno: 0, etiqueta_grupo: null });
    expect((await gate(empresaA)).statusCode).toBe(403);
  });

  test('el admin enciende los grupos de SU empresa: abre el middleware y las demás siguen apagadas', async () => {
    const empresa = await EmpresasService.actualizarMiEmpresa(empresaA, { usa_grupos_turno: 1, etiqueta_grupo: 'Evento' }, auditoria);
    expect(empresa).toMatchObject({ usa_grupos_turno: 1, etiqueta_grupo: 'Evento' });
    expect(await EmpresasService.opcionesGruposTurno(empresaA)).toEqual({ usa_grupos_turno: true, etiqueta_grupo: 'Evento' });
    expect(await gate(empresaA)).toBeUndefined(); // pasa
    // la otra empresa no cambió
    expect(await EmpresasService.opcionesGruposTurno(empresaB)).toEqual({ usa_grupos_turno: false, etiqueta_grupo: null });
    expect((await gate(empresaB)).statusCode).toBe(403);
  });

  test('cambiar otras opciones de la empresa no toca la de grupos', async () => {
    await EmpresasService.actualizarMiEmpresa(empresaA, { ciudad: 'Bogotá' }, auditoria);
    expect(await EmpresasService.opcionesGruposTurno(empresaA)).toEqual({ usa_grupos_turno: true, etiqueta_grupo: 'Evento' });
  });

  test('apagarlos cierra el middleware de inmediato y conserva la etiqueta; null la borra', async () => {
    await EmpresasService.actualizarMiEmpresa(empresaA, { usa_grupos_turno: 0 }, auditoria);
    expect((await gate(empresaA)).statusCode).toBe(403);
    expect(await EmpresasService.opcionesGruposTurno(empresaA)).toEqual({ usa_grupos_turno: false, etiqueta_grupo: 'Evento' });
    await EmpresasService.actualizarMiEmpresa(empresaA, { etiqueta_grupo: null }, auditoria);
    expect((await EmpresasService.opcionesGruposTurno(empresaA)).etiqueta_grupo).toBeNull();
  });

  test('sin empresa activa (trabajador multi-empresa) o empresa inexistente: apagado, sin error', async () => {
    expect(await EmpresasService.opcionesGruposTurno(null)).toEqual({ usa_grupos_turno: false, etiqueta_grupo: null });
    expect(await EmpresasService.opcionesGruposTurno(999999999)).toEqual({ usa_grupos_turno: false, etiqueta_grupo: null });
  });
});
