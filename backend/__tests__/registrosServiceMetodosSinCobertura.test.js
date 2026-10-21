'use strict';

// Cuatro métodos públicos de RegistrosService que ningún test ejecutaba: obtener, descartarSospechoso,
// obtenerMiPerfil y listarReingresosPendientes. Se fijan antes de repartir el service en sub-services.
jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../modules/nomina/registros/registros.model');
jest.mock('../modules/nomina/registros/solicitudes-reingreso.model');
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/puntos-marcaje/puntos-marcaje.model');
jest.mock('../modules/empresas/empresas.model');

const RegistrosModel = require('../modules/nomina/registros/registros.model');
const SolicitudesReingresoModel = require('../modules/nomina/registros/solicitudes-reingreso.model');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const PuntosMarcajeModel = require('../modules/puntos-marcaje/puntos-marcaje.model');
const EmpresasModel = require('../modules/empresas/empresas.model');
const RegistrosService = require('../modules/nomina/registros/registros.service');

describe('obtener', () => {
  test('registro inexistente (o de otra empresa) → 404', async () => {
    RegistrosModel.obtenerPorId.mockResolvedValue(null);
    await expect(RegistrosService.obtener(1, 9)).rejects.toMatchObject({ statusCode: 404, message: 'Registro no encontrado' });
    expect(RegistrosModel.obtenerPorId).toHaveBeenCalledWith(1, 9);
  });

  test('jornada ya cerrada: se devuelve tal cual, sin calcular horas en vivo', async () => {
    const cerrado = { id: 9, fecha: '2026-06-01', hora_entrada: '08:00:00', hora_salida: '17:00:00', horas_ordinarias: 9 };
    RegistrosModel.obtenerPorId.mockResolvedValue(cerrado);
    await expect(RegistrosService.obtener(1, 9)).resolves.toBe(cerrado);
    expect(RegistrosModel.sumarOrdinariasEnSemana).not.toHaveBeenCalled();
  });
});

describe('descartarSospechoso', () => {
  test('sin fila afectada → 404', async () => {
    RegistrosModel.descartarSospechoso.mockResolvedValue(0);
    await expect(RegistrosService.descartarSospechoso(1, 9)).rejects.toMatchObject({ statusCode: 404 });
  });

  test('con fila afectada → resuelve sin valor', async () => {
    RegistrosModel.descartarSospechoso.mockResolvedValue(1);
    await expect(RegistrosService.descartarSospechoso(1, 9)).resolves.toBeUndefined();
    expect(RegistrosModel.descartarSospechoso).toHaveBeenCalledWith(1, 9);
  });
});

describe('obtenerMiPerfil', () => {
  const trabajador = { id: 5, nombre: 'Ana', apellido: 'Ruiz', cargo: 'Cajera', tipo_marcacion: 'libre', salario_base: '1800000', acepta_extras: 1, punto_marcaje_id: null };

  beforeEach(() => {
    EmpresasModel.obtenerDetalle.mockResolvedValue({ nombre: 'ACME' });
    TrabajadoresModel.listarCargos.mockResolvedValue([{ id: 3 }]);
  });

  test('usuario sin trabajador activo → 403', async () => {
    TrabajadoresModel.obtenerPorUsuarioId.mockResolvedValue(null);
    await expect(RegistrosService.obtenerMiPerfil(1, 42)).rejects.toMatchObject({ statusCode: 403 });
  });

  test('marcación libre: perfil sin punto ni zonas, con extras como booleano', async () => {
    TrabajadoresModel.obtenerPorUsuarioId.mockResolvedValue(trabajador);

    await expect(RegistrosService.obtenerMiPerfil(1, 42)).resolves.toEqual({
      id: 5, nombre: 'Ana', apellido: 'Ruiz', cargo: 'Cajera', empresa_nombre: 'ACME', cargos: [{ id: 3 }],
      tipo_marcacion: 'libre', punto_marcaje: null, puntos_zonales: [], salario_base: '1800000', acepta_extras: true,
    });
    expect(TrabajadoresModel.obtenerPorUsuarioId).toHaveBeenCalledWith(1, 42);
    expect(PuntosMarcajeModel.obtenerPorId).not.toHaveBeenCalled();
    expect(PuntosMarcajeModel.listarZonales).not.toHaveBeenCalled();
  });

  test('marcación fija: trae el punto asignado', async () => {
    TrabajadoresModel.obtenerPorUsuarioId.mockResolvedValue({ ...trabajador, tipo_marcacion: 'fijo', punto_marcaje_id: 8 });
    PuntosMarcajeModel.obtenerPorId.mockResolvedValue({ id: 8, nombre: 'Sede norte' });

    const perfil = await RegistrosService.obtenerMiPerfil(1, 42);

    expect(PuntosMarcajeModel.obtenerPorId).toHaveBeenCalledWith(1, 8);
    expect(perfil.punto_marcaje).toEqual({ id: 8, nombre: 'Sede norte' });
  });

  test('marcación zonal: trae las zonas de la empresa', async () => {
    TrabajadoresModel.obtenerPorUsuarioId.mockResolvedValue({ ...trabajador, tipo_marcacion: 'zonal' });
    PuntosMarcajeModel.listarZonales.mockResolvedValue([{ id: 1 }, { id: 2 }]);

    const perfil = await RegistrosService.obtenerMiPerfil(1, 42);

    expect(PuntosMarcajeModel.listarZonales).toHaveBeenCalledWith(1);
    expect(perfil.puntos_zonales).toEqual([{ id: 1 }, { id: 2 }]);
  });

  test('sin cargo, sin tipo de marcación ni empresa: valores por defecto', async () => {
    TrabajadoresModel.obtenerPorUsuarioId.mockResolvedValue({ ...trabajador, cargo: undefined, tipo_marcacion: undefined, acepta_extras: 0 });
    EmpresasModel.obtenerDetalle.mockResolvedValue(null);

    const perfil = await RegistrosService.obtenerMiPerfil(1, 42);

    expect(perfil).toMatchObject({ cargo: null, empresa_nombre: null, tipo_marcacion: 'libre', acepta_extras: false });
  });
});

describe('listarReingresosPendientes', () => {
  test('devuelve las solicitudes pendientes de la empresa', async () => {
    SolicitudesReingresoModel.listarPendientes.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    await expect(RegistrosService.listarReingresosPendientes(7)).resolves.toEqual([{ id: 1 }, { id: 2 }]);
    expect(SolicitudesReingresoModel.listarPendientes).toHaveBeenCalledWith(7);
  });
});
