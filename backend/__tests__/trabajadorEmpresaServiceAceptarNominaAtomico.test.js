'use strict';

// aceptar() una invitación a nómina cambia 4 cosas que juntas sostienen la regla
// "nómina es exclusiva de una empresa": estado de la relación, tipo de la ficha,
// rol de la cuenta y archivado de las demás relaciones. Si algo falla a mitad,
// no puede quedar nada aplicado — antes quedaba la relación 'activo' y el
// trabajador atascado (aceptar() rechaza con 409 todo lo que ya no esté pendiente).
//
// Se simula SOLO el borde (pool) con una base en memoria que entiende
// transacciones (rollback restaura), para verificar el ESTADO final y no qué
// métodos se llamaron.
jest.mock('../config/database', () => ({ pool: { query: jest.fn(), getConnection: jest.fn() } }));
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/trabajadores/trabajadores.service');
jest.mock('../modules/empresas/empresas.model');
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificar: jest.fn().mockResolvedValue(undefined),
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const { pool } = require('../config/database');
const { ROLES, ESTADOS_TRABAJADOR_EMPRESA: E } = require('../config/constants');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const EmpresasModel = require('../modules/empresas/empresas.model');
const TrabajadorEmpresaModel = require('../modules/trabajador-empresa/trabajador-empresa.model');
const TrabajadorEmpresaService = require('../modules/trabajador-empresa/trabajador-empresa.service');

const USUARIO_ID = 42;
const RELACION_ID = 10;
const EMPRESA_NUEVA = 1;
const FICHA_ID = 5;

const estadoInicial = () => ({
  relaciones: {
    10: { estado: E.SOLICITADO_POR_EMPRESA },
    20: { estado: E.ACTIVO, empresa_id: 2, trabajador_id: 77 },
    21: { estado: E.SOLICITADO_POR_EMPRESA, empresa_id: 3, trabajador_id: null },
  },
  fichaTipo: 'turnos',
  usuario: { rol: ROLES.TRABAJADOR_TURNOS, empresa_id: null },
});

let db;
let falla; // regex: si el SQL la cumple, la sentencia lanza

/** Aplica una sentencia a la base en memoria (solo las que usa este flujo). */
function ejecutar(sql, params) {
  sql = sql.replace(/\s+/g, ' ').trim();
  if (falla && falla.test(sql)) throw new Error('conexión perdida');
  if (/^UPDATE trabajador_empresa SET estado = \?/.test(sql)) {
    db.relaciones[params[params.length - 1]].estado = params[0];
    return [{ affectedRows: 1 }];
  }
  if (/^UPDATE trabajadores SET tipo = \?/.test(sql)) {
    db.fichaTipo = params[0];
    return [{ affectedRows: 1 }];
  }
  if (/^UPDATE usuarios SET rol = \?, empresa_id = \?/.test(sql)) {
    db.usuario = { rol: params[0], empresa_id: params[1] };
    return [{ affectedRows: 1 }];
  }
  if (/^SELECT id, empresa_id, trabajador_id FROM trabajador_empresa/.test(sql)) {
    const filas = Object.entries(db.relaciones)
      .filter(([id, r]) => Number(id) !== params[1] && ['activo', 'solicitado_por_trabajador', 'solicitado_por_empresa'].includes(r.estado))
      .map(([id, r]) => ({ id: Number(id), empresa_id: r.empresa_id, trabajador_id: r.trabajador_id }));
    return [filas];
  }
  if (/^UPDATE trabajador_empresa SET estado = 'archivado'/.test(sql)) {
    params.forEach((id) => { db.relaciones[id].estado = 'archivado'; });
    return [{ affectedRows: params.length }];
  }
  throw new Error(`SQL no esperado en el test: ${sql}`);
}

beforeEach(() => {
  db = estadoInicial();
  falla = null;
  pool.query.mockImplementation(async (sql, params) => ejecutar(sql, params));
  pool.getConnection.mockImplementation(async () => {
    let foto = null;
    return {
      beginTransaction: async () => { foto = JSON.parse(JSON.stringify(db)); },
      query: async (sql, params) => ejecutar(sql, params),
      commit: async () => { foto = null; },
      rollback: async () => { if (foto) { Object.keys(db).forEach((k) => delete db[k]); Object.assign(db, foto); } },
      release: () => {},
    };
  });

  // lee el estado vigente de la base en memoria: así un reintento ve lo que de verdad quedó guardado
  jest.spyOn(TrabajadorEmpresaModel, 'obtenerPorId').mockImplementation(async () => ({
    id: RELACION_ID, usuario_id: USUARIO_ID, empresa_id: EMPRESA_NUEVA,
    estado: db.relaciones[RELACION_ID].estado, tipo_ofrecido: 'nomina', trabajador_id: FICHA_ID,
  }));
  jest.spyOn(TrabajadorEmpresaModel, 'obtenerUsuario').mockResolvedValue({ nombre: 'Ana', apellido: 'Pérez', rol: ROLES.TRABAJADOR_TURNOS });
  jest.spyOn(TrabajadorEmpresaModel, 'idsGestores').mockResolvedValue([501]);
  TrabajadoresModel.desactivar.mockResolvedValue(1);
  EmpresasModel.obtenerDetalle.mockResolvedValue({ id: EMPRESA_NUEVA, nombre: 'Empresa Nómina' });
});

describe('aceptar() nómina — todo o nada', () => {
  test('camino feliz: relación activa, ficha y cuenta en nómina, otras relaciones archivadas', async () => {
    await TrabajadorEmpresaService.aceptar(USUARIO_ID, RELACION_ID);

    expect(db.relaciones[10].estado).toBe(E.ACTIVO);
    expect(db.fichaTipo).toBe('nomina');
    expect(db.usuario).toEqual({ rol: ROLES.TRABAJADOR_NOMINA, empresa_id: EMPRESA_NUEVA });
    expect(db.relaciones[20].estado).toBe('archivado');
    expect(db.relaciones[21].estado).toBe('archivado');
    expect(TrabajadoresModel.desactivar).toHaveBeenCalledWith(2, 77);
  });

  test('si falla el cambio de rol de la cuenta: no queda nada aplicado y se puede reintentar', async () => {
    falla = /^UPDATE usuarios SET rol/;

    await expect(TrabajadorEmpresaService.aceptar(USUARIO_ID, RELACION_ID)).rejects.toThrow('conexión perdida');

    expect(db).toEqual(estadoInicial());
    expect(TrabajadoresModel.desactivar).not.toHaveBeenCalled();
  });

  test('si falla el archivado de las otras relaciones: tampoco queda nada aplicado', async () => {
    falla = /^UPDATE trabajador_empresa SET estado = 'archivado'/;

    await expect(TrabajadorEmpresaService.aceptar(USUARIO_ID, RELACION_ID)).rejects.toThrow('conexión perdida');

    expect(db).toEqual(estadoInicial());
    expect(TrabajadoresModel.desactivar).not.toHaveBeenCalled();
  });

  test('tras un fallo, reintentar aceptar() funciona', async () => {
    falla = /^UPDATE usuarios SET rol/;
    await expect(TrabajadorEmpresaService.aceptar(USUARIO_ID, RELACION_ID)).rejects.toThrow();

    falla = null;
    await TrabajadorEmpresaService.aceptar(USUARIO_ID, RELACION_ID);

    expect(db.relaciones[10].estado).toBe(E.ACTIVO);
    expect(db.usuario.rol).toBe(ROLES.TRABAJADOR_NOMINA);
  });
});
