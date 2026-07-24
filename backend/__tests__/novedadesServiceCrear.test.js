'use strict';

// Cierra el hueco de integración: un incidente reportado en un turno originado
// en logiq360 (external_ref) debe viajar como evento novedad.reportada, con
// GPS si el trabajador lo compartió. Antes esto nunca salía de Zaturno.
jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../modules/novedades/novedades.model');
jest.mock('../modules/turnos/asignaciones/asignaciones.model');
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../modules/integracion/integracion.service', () => ({
  emitir: jest.fn().mockResolvedValue(undefined),
}));

const NovedadesModel = require('../modules/novedades/novedades.model');
const AsignacionesModel = require('../modules/turnos/asignaciones/asignaciones.model');
const NotificacionesService = require('../modules/notificaciones/notificaciones.service');
const IntegracionService = require('../modules/integracion/integracion.service');
const NovedadesService = require('../modules/novedades/novedades.service');

const usuarioGestor = { id: 1, rol: 'admin_empresa' };

afterEach(() => jest.clearAllMocks());

describe('NovedadesService.crear — evento novedad.reportada hacia logiq360', () => {
  test('emite novedad.reportada con GPS cuando la oferta tiene external_ref', async () => {
    AsignacionesModel.obtenerPorId.mockResolvedValue({ id: 5 });
    NovedadesModel.create.mockResolvedValue({ id: 10, tipo: 'incidente', descripcion: 'Tubo doblado' });
    NovedadesModel.getParticipantes.mockResolvedValue([1, 2]);
    AsignacionesModel.obtenerConDetalles.mockResolvedValue({
      empresa_id: 7,
      oferta_external_ref: 'logiq360:orden:47',
      trabajador_nombre: 'Pedro', trabajador_apellido: 'Gómez',
    });

    await NovedadesService.crear(
      7, 5, 'incidente', 'Tubo doblado', null, null, usuarioGestor, 4.8567, -74.0124
    );

    expect(IntegracionService.emitir).toHaveBeenCalledWith(7, 'novedad.reportada', expect.objectContaining({
      external_ref: 'logiq360:orden:47',
      trabajador_nombre: 'Pedro Gómez',
      tipo_novedad: 'incidente',
      descripcion: 'Tubo doblado',
      latitud: 4.8567,
      longitud: -74.0124,
      tiene_foto: false,
    }));
  });

  test('no emite nada si la oferta no vino de logiq360 (sin external_ref)', async () => {
    AsignacionesModel.obtenerPorId.mockResolvedValue({ id: 5 });
    NovedadesModel.create.mockResolvedValue({ id: 10 });
    NovedadesModel.getParticipantes.mockResolvedValue([]);
    AsignacionesModel.obtenerConDetalles.mockResolvedValue({
      empresa_id: 7, oferta_external_ref: null,
    });

    await NovedadesService.crear(7, 5, 'retraso', 'Llega tarde', null, null, usuarioGestor);

    expect(IntegracionService.emitir).not.toHaveBeenCalled();
  });

  test('sin GPS, viaja igual con latitud/longitud en null (nunca bloquea el reporte)', async () => {
    AsignacionesModel.obtenerPorId.mockResolvedValue({ id: 5 });
    NovedadesModel.create.mockResolvedValue({ id: 10 });
    NovedadesModel.getParticipantes.mockResolvedValue([]);
    AsignacionesModel.obtenerConDetalles.mockResolvedValue({
      empresa_id: 7, oferta_external_ref: 'logiq360:orden:47',
      trabajador_nombre: 'Pedro', trabajador_apellido: 'Gómez',
    });

    await NovedadesService.crear(7, 5, 'otro', 'Sin GPS disponible', null, null, usuarioGestor);

    expect(IntegracionService.emitir).toHaveBeenCalledWith(7, 'novedad.reportada', expect.objectContaining({
      latitud: null, longitud: null,
    }));
  });

  test('un fallo al resolver detalles no rompe la creación de la novedad', async () => {
    AsignacionesModel.obtenerPorId.mockResolvedValue({ id: 5 });
    NovedadesModel.create.mockResolvedValue({ id: 10 });
    NovedadesModel.getParticipantes.mockResolvedValue([]);
    AsignacionesModel.obtenerConDetalles.mockRejectedValue(new Error('db caída'));

    await expect(
      NovedadesService.crear(7, 5, 'otro', 'x', null, null, usuarioGestor)
    ).resolves.toEqual({ id: 10 });
    expect(NotificacionesService.notificarVarios).toHaveBeenCalled();
  });
});
