'use strict';

// Regresión: marcarEgreso() usaba `trabajador.id` en la llamada a
// TrabajadoresModel.guardarFirma(), pero la variable `trabajador` nunca se
// declara en esta función (a diferencia de marcarIngreso(), que sí la
// reconstruye localmente). Esto lanza un ReferenceError síncrono al evaluar
// el argumento — antes de que la promesa exista, así que el .catch(() => null)
// encadenado no lo atrapa — rompiendo "Marcar Egreso" para TODO trabajador,
// no solo el caso de filas duplicadas que este flujo originalmente arreglaba.
//
// Además (migración 088): marcarEgreso ahora valida geofence igual que
// marcarIngreso — antes solo pedía firma, sin importar tipo_geofence del cargo.
jest.mock('../config/database', () => ({
  pool: { query: jest.fn().mockResolvedValue([[]]) },
}));
jest.mock('../modules/turnos/asignaciones/asignaciones.model');
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/contratos/contratos.model');
jest.mock('../modules/contratos/contratos.service');
jest.mock('../modules/puntos-marcaje/puntos-marcaje.model');
jest.mock('../modules/integracion/integracion.service', () => ({ emitir: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../modules/integracion/costo-labor.service', () => ({ verificarYEmitir: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificar: jest.fn().mockResolvedValue(undefined),
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const AsignacionesModel = require('../modules/turnos/asignaciones/asignaciones.model');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const ContratosModel    = require('../modules/contratos/contratos.model');
const ContratosService  = require('../modules/contratos/contratos.service');
const PuntosMarcajeModel = require('../modules/puntos-marcaje/puntos-marcaje.model');
const AsignacionesService = require('../modules/turnos/asignaciones/asignaciones.service');

afterEach(() => jest.clearAllMocks());

const PUNTO = { latitud: 4.7110000, longitud: -74.0721000, radio_metros: 100, nombre: 'Bodega Norte' };
const LEJOS = { lat: 4.8000000, lng: -74.2000000 }; // ~20km del punto

describe('AsignacionesService.marcarEgreso', () => {
  const asignacion = {
    id: 500,
    empresa_id: 7,
    trabajador_id: 99,
    usuario_id: 42,
    trabajador_nombre: 'Ana',
    trabajador_apellido: 'Ruiz',
    estado: 'en_progreso',
    oferta_id: 1,
    hora_ingreso_real: new Date(Date.now() - 5 * 60_000).toISOString(),
    geofence_info: { tipo: 'libre' },
  };

  beforeEach(() => {
    AsignacionesModel.obtenerConDetalles.mockResolvedValue(asignacion);
    AsignacionesModel.registrarEgreso.mockResolvedValue(undefined);
    AsignacionesModel.obtenerPorId.mockResolvedValue({ id: 500, estado: 'completado' });
    ContratosModel.obtenerPorAsignacion.mockResolvedValue(null);
    ContratosService.generarParaAsignacion.mockResolvedValue(null);
    TrabajadoresModel.guardarFirma.mockResolvedValue(undefined);
  });

  test('marca egreso y guarda la firma con el trabajador_id de la asignación (sin ReferenceError)', async () => {
    const resultado = await AsignacionesService.marcarEgreso(7, 500, 42, { latitud: 1, longitud: 1, firma_b64: 'data:...' });

    expect(TrabajadoresModel.guardarFirma).toHaveBeenCalledWith(99, 'data:...');
    expect(AsignacionesModel.registrarEgreso).toHaveBeenCalledWith(7, 500, 'data:...', 1, 1);
    expect(resultado).toEqual({ id: 500, estado: 'completado' });
  });

  test('rechaza a un usuario que no coincide con usuario_id de la asignación', async () => {
    await expect(
      AsignacionesService.marcarEgreso(7, 500, 999, { latitud: 1, longitud: 1, firma_b64: 'data:...' })
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(AsignacionesModel.registrarEgreso).not.toHaveBeenCalled();
  });

  test('trabajador_nomina en turno eventual: no genera contrato (es bono, la firma_digital del egreso ya lo confirma)', async () => {
    AsignacionesModel.obtenerConDetalles.mockResolvedValue({ ...asignacion, trabajador_tipo: 'nomina' });

    await AsignacionesService.marcarEgreso(7, 500, 42, { latitud: 1, longitud: 1, firma_b64: 'data:...' });

    expect(ContratosService.generarParaAsignacion).not.toHaveBeenCalled();
  });

  test('trabajador_turnos: sí genera contrato como antes', async () => {
    AsignacionesModel.obtenerConDetalles.mockResolvedValue({ ...asignacion, trabajador_tipo: 'turnos' });

    await AsignacionesService.marcarEgreso(7, 500, 42, { latitud: 1, longitud: 1, firma_b64: 'data:...' });

    expect(ContratosService.generarParaAsignacion).toHaveBeenCalledWith(7, 500);
  });
});

describe('AsignacionesService.marcarEgreso — geofence (mismo criterio que marcarIngreso)', () => {
  const base = {
    id: 500, empresa_id: 7, trabajador_id: 99, usuario_id: 42,
    trabajador_nombre: 'Ana', trabajador_apellido: 'Ruiz',
    estado: 'en_progreso', oferta_id: 1,
    hora_ingreso_real: new Date(Date.now() - 5 * 60_000).toISOString(),
  };

  beforeEach(() => {
    AsignacionesModel.registrarEgreso.mockResolvedValue(undefined);
    AsignacionesModel.obtenerPorId.mockResolvedValue({ id: 500, estado: 'completado' });
    ContratosModel.obtenerPorAsignacion.mockResolvedValue(null);
    ContratosService.generarParaAsignacion.mockResolvedValue(null);
    TrabajadoresModel.guardarFirma.mockResolvedValue(undefined);
  });

  test('tipo fijo: rechaza la salida lejos del punto', async () => {
    AsignacionesModel.obtenerConDetalles.mockResolvedValue({
      ...base, geofence_info: { tipo: 'fijo', nombre: PUNTO.nombre, latitud: PUNTO.latitud, longitud: PUNTO.longitud, radio_metros: PUNTO.radio_metros },
    });
    await expect(
      AsignacionesService.marcarEgreso(7, 500, 42, { latitud: LEJOS.lat, longitud: LEJOS.lng, firma_b64: 'data:...' })
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(AsignacionesModel.registrarEgreso).not.toHaveBeenCalled();
  });

  test('tipo fijo: permite la salida en el punto', async () => {
    AsignacionesModel.obtenerConDetalles.mockResolvedValue({
      ...base, geofence_info: { tipo: 'fijo', nombre: PUNTO.nombre, latitud: PUNTO.latitud, longitud: PUNTO.longitud, radio_metros: PUNTO.radio_metros },
    });
    await AsignacionesService.marcarEgreso(7, 500, 42, { latitud: PUNTO.latitud, longitud: PUNTO.longitud, firma_b64: 'data:...' });
    expect(AsignacionesModel.registrarEgreso).toHaveBeenCalled();
  });

  test('tipo oferta: rechaza la salida fuera del área del turno', async () => {
    AsignacionesModel.obtenerConDetalles.mockResolvedValue({
      ...base, geofence_info: { tipo: 'oferta', nombre: 'Corferias', latitud: PUNTO.latitud, longitud: PUNTO.longitud, radio_metros: 1000 },
    });
    await expect(
      AsignacionesService.marcarEgreso(7, 500, 42, { latitud: LEJOS.lat, longitud: LEJOS.lng, firma_b64: 'data:...' })
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(AsignacionesModel.registrarEgreso).not.toHaveBeenCalled();
  });

  test('tipo zonal: rechaza si no está dentro de ningún punto zonal', async () => {
    AsignacionesModel.obtenerConDetalles.mockResolvedValue({ ...base, geofence_info: { tipo: 'zonal' } });
    PuntosMarcajeModel.listarZonalesEfectivos.mockResolvedValue([PUNTO]);
    await expect(
      AsignacionesService.marcarEgreso(7, 500, 42, { latitud: LEJOS.lat, longitud: LEJOS.lng, firma_b64: 'data:...' })
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(AsignacionesModel.registrarEgreso).not.toHaveBeenCalled();
  });

  test('tipo zonal: permite la salida dentro de un punto zonal', async () => {
    AsignacionesModel.obtenerConDetalles.mockResolvedValue({ ...base, geofence_info: { tipo: 'zonal' } });
    PuntosMarcajeModel.listarZonalesEfectivos.mockResolvedValue([PUNTO]);
    await AsignacionesService.marcarEgreso(7, 500, 42, { latitud: PUNTO.latitud, longitud: PUNTO.longitud, firma_b64: 'data:...' });
    expect(AsignacionesModel.registrarEgreso).toHaveBeenCalled();
  });

  test('tipo libre: nunca valida geofence', async () => {
    AsignacionesModel.obtenerConDetalles.mockResolvedValue({ ...base, geofence_info: { tipo: 'libre' } });
    await AsignacionesService.marcarEgreso(7, 500, 42, { latitud: LEJOS.lat, longitud: LEJOS.lng, firma_b64: 'data:...' });
    expect(AsignacionesModel.registrarEgreso).toHaveBeenCalled();
  });
});
