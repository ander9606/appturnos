'use strict';

// Vincular un turno a un grupo (al crear o después con vincularGrupo): el grupo debe existir,
// ser de la empresa y estar activo, y la empresa debe tener la función encendida. Sin grupo no
// se consulta nada: para quien no usa grupos el flujo de siempre no cambia.
jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../modules/turnos/ofertas/ofertas.model');
jest.mock('../modules/turnos/asignaciones/asignaciones.model');
jest.mock('../modules/cargos/cargos.model');
jest.mock('../modules/puntos-marcaje/puntos-marcaje.model');
jest.mock('../modules/grupos-turno/grupos-turno.model');
jest.mock('../modules/empresas/empresas.model');
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const { pool } = require('../config/database');
const OfertasModel = require('../modules/turnos/ofertas/ofertas.model');
const GruposTurnoModel = require('../modules/grupos-turno/grupos-turno.model');
const EmpresasModel = require('../modules/empresas/empresas.model');
const OfertasService = require('../modules/turnos/ofertas/ofertas.service');

afterEach(() => jest.clearAllMocks());

const oferta = (extra = {}) => ({
  id: 10, empresa_id: 7, titulo: 'Montaje', fecha: '2099-01-01', hora_inicio: '08:00:00', hora_fin_estimada: null,
  lugar: null, estado: 'abierta', puestos: [], destinatarios: [], punto_marcaje_ids: [], grupo_id: null, ...extra,
});
const grupo = (extra = {}) => ({ id: 3, empresa_id: 7, nombre: 'Feria del Libro', estado: 'activo', ...extra });
const datosNuevos = (extra = {}) => ({ titulo: 'Montaje', fecha: '2099-01-01', hora_inicio: '08:00:00', puestos: [], ...extra });

describe('crear con grupo_id', () => {
  beforeEach(() => {
    OfertasModel.crear.mockResolvedValue(10);
    OfertasModel.obtenerPorId.mockResolvedValue(oferta());
    pool.query.mockResolvedValue([[]]); // co-gestores
  });

  test('sin grupo no consulta la empresa ni los grupos', async () => {
    await OfertasService.crear(7, datosNuevos(), 1);
    expect(EmpresasModel.usaGruposTurno).not.toHaveBeenCalled();
    expect(GruposTurnoModel.obtenerPorId).not.toHaveBeenCalled();
    expect(OfertasModel.crear).toHaveBeenCalledTimes(1);
  });

  test('empresa sin la función encendida: 403 y no crea nada', async () => {
    EmpresasModel.usaGruposTurno.mockResolvedValue(false);
    await expect(OfertasService.crear(7, datosNuevos({ grupo_id: 3 }), 1)).rejects.toMatchObject({ statusCode: 403 });
    expect(OfertasModel.crear).not.toHaveBeenCalled();
  });

  test('grupo inexistente o de otra empresa: 404', async () => {
    EmpresasModel.usaGruposTurno.mockResolvedValue(true);
    GruposTurnoModel.obtenerPorId.mockResolvedValue(null);
    await expect(OfertasService.crear(7, datosNuevos({ grupo_id: 3 }), 1)).rejects.toMatchObject({ statusCode: 404 });
    expect(GruposTurnoModel.obtenerPorId).toHaveBeenCalledWith(7, 3); // siempre con la empresa del token
    expect(OfertasModel.crear).not.toHaveBeenCalled();
  });

  test('grupo cerrado: 409 con su nombre y no crea nada', async () => {
    EmpresasModel.usaGruposTurno.mockResolvedValue(true);
    GruposTurnoModel.obtenerPorId.mockResolvedValue(grupo({ estado: 'cerrado' }));
    await expect(OfertasService.crear(7, datosNuevos({ grupo_id: 3 }), 1)).rejects.toMatchObject({
      statusCode: 409, message: expect.stringContaining('Feria del Libro'),
    });
    expect(OfertasModel.crear).not.toHaveBeenCalled();
  });

  test('grupo activo: crea y le pasa el grupo al modelo', async () => {
    EmpresasModel.usaGruposTurno.mockResolvedValue(true);
    GruposTurnoModel.obtenerPorId.mockResolvedValue(grupo());
    await OfertasService.crear(7, datosNuevos({ grupo_id: 3 }), 1);
    expect(OfertasModel.crear).toHaveBeenCalledWith(7, expect.objectContaining({ grupo_id: 3 }), 1);
  });
});

describe('vincularGrupo', () => {
  test('oferta inexistente: 404', async () => {
    OfertasModel.obtenerPorId.mockResolvedValueOnce(null);
    await expect(OfertasService.vincularGrupo(7, 10, 3)).rejects.toMatchObject({ statusCode: 404 });
    expect(OfertasModel.asignarGrupo).not.toHaveBeenCalled();
  });

  test('vincula a un grupo activo y devuelve la oferta actualizada', async () => {
    EmpresasModel.usaGruposTurno.mockResolvedValue(true);
    GruposTurnoModel.obtenerPorId.mockResolvedValue(grupo());
    OfertasModel.obtenerPorId.mockResolvedValueOnce(oferta()).mockResolvedValueOnce(oferta({ grupo_id: 3 }));
    const r = await OfertasService.vincularGrupo(7, 10, 3);
    expect(OfertasModel.asignarGrupo).toHaveBeenCalledWith(7, 10, 3);
    expect(r.grupo_id).toBe(3);
  });

  test('se permite en cualquier estado (es solo una etiqueta), p. ej. un turno ya completado', async () => {
    EmpresasModel.usaGruposTurno.mockResolvedValue(true);
    GruposTurnoModel.obtenerPorId.mockResolvedValue(grupo());
    OfertasModel.obtenerPorId.mockResolvedValue(oferta({ estado: 'completada' }));
    await OfertasService.vincularGrupo(7, 10, 3);
    expect(OfertasModel.asignarGrupo).toHaveBeenCalledWith(7, 10, 3);
  });

  test('grupo cerrado: 409 y no cambia nada', async () => {
    EmpresasModel.usaGruposTurno.mockResolvedValue(true);
    GruposTurnoModel.obtenerPorId.mockResolvedValue(grupo({ estado: 'cerrado' }));
    OfertasModel.obtenerPorId.mockResolvedValue(oferta());
    await expect(OfertasService.vincularGrupo(7, 10, 3)).rejects.toMatchObject({ statusCode: 409 });
    expect(OfertasModel.asignarGrupo).not.toHaveBeenCalled();
  });

  test('grupo_id null saca el turno del grupo sin consultar la función ni los grupos', async () => {
    OfertasModel.obtenerPorId.mockResolvedValue(oferta({ grupo_id: 3 }));
    await OfertasService.vincularGrupo(7, 10, null);
    expect(OfertasModel.asignarGrupo).toHaveBeenCalledWith(7, 10, null);
    expect(EmpresasModel.usaGruposTurno).not.toHaveBeenCalled();
    expect(GruposTurnoModel.obtenerPorId).not.toHaveBeenCalled();
  });
});
