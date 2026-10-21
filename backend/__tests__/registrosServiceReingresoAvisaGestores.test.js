'use strict';

// Al solicitar un reingreso se avisa a los gestores de NÓMINA (no a los de turnos),
// y el aviso es de mejor esfuerzo: sin gestores o con el aviso caído, la solicitud igual se crea.
jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../modules/nomina/registros/registros.model');
jest.mock('../modules/nomina/registros/solicitudes-reingreso.model');
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/notificaciones/notificaciones.model');
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificar: jest.fn().mockResolvedValue(undefined),
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const RegistrosModel = require('../modules/nomina/registros/registros.model');
const SolicitudesReingresoModel = require('../modules/nomina/registros/solicitudes-reingreso.model');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const NotificacionesModel = require('../modules/notificaciones/notificaciones.model');
const NotificacionesService = require('../modules/notificaciones/notificaciones.service');
const RegistrosService = require('../modules/nomina/registros/registros.service');

const EMPRESA = 1;
const usuario = { sub: 42 };

beforeEach(() => {
  TrabajadoresModel.obtenerPorUsuarioId.mockResolvedValue({ id: 5 });
  TrabajadoresModel.obtenerPorId.mockResolvedValue({ id: 5, nombre: 'Ana', apellido: 'Pérez' });
  RegistrosModel.obtenerPorFecha.mockResolvedValue({ id: 77, hora_salida: '17:00:00' });
  SolicitudesReingresoModel.obtenerActivaPorRegistro.mockResolvedValue(null);
  SolicitudesReingresoModel.crear.mockResolvedValue(900);
  NotificacionesModel.idsGestoresNomina.mockResolvedValue([3, 8]);
});

test('avisa a los gestores de nómina de la empresa con el id de la solicitud', async () => {
  await expect(RegistrosService.solicitarReingreso(EMPRESA, usuario, { motivo: 'olvidé algo' }))
    .resolves.toEqual({ id: 900, registro_id: 77 });

  expect(NotificacionesModel.idsGestoresNomina).toHaveBeenCalledWith(EMPRESA);
  expect(NotificacionesService.notificarVarios).toHaveBeenCalledWith([3, 8], expect.objectContaining({
    empresaId: EMPRESA, tipo: 'reingreso.solicitado', data: { solicitud_id: 900, registro_id: 77 },
  }));
});

test('sin gestores de nómina: crea la solicitud y no avisa a nadie', async () => {
  NotificacionesModel.idsGestoresNomina.mockResolvedValue([]);

  await expect(RegistrosService.solicitarReingreso(EMPRESA, usuario)).resolves.toEqual({ id: 900, registro_id: 77 });
  expect(NotificacionesService.notificarVarios).not.toHaveBeenCalled();
});

test('si el aviso falla, la solicitud igual queda creada', async () => {
  NotificacionesService.notificarVarios.mockRejectedValueOnce(new Error('push caído'));

  await expect(RegistrosService.solicitarReingreso(EMPRESA, usuario)).resolves.toEqual({ id: 900, registro_id: 77 });
  expect(SolicitudesReingresoModel.crear).toHaveBeenCalled();
});
