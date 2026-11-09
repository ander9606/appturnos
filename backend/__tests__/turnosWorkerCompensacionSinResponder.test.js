'use strict';

// El worker de turnos avisa al gestor de las propuestas de compensación que el trabajador no responde.
jest.mock('../modules/turnos/ofertas/ofertas.model');
jest.mock('../modules/turnos/ofertas/ofertas.service');
jest.mock('../modules/turnos/asignaciones/asignaciones.service', () => ({
  cerrarMasivo: jest.fn(),
  alertarCompensacionesSinResponder: jest.fn(),
}));
jest.mock('../modules/trabajadores/trabajadores.service');
jest.mock('../modules/notificaciones/notificaciones.service', () => ({ notificarVarios: jest.fn() }));

const AsignacionesService = require('../modules/turnos/asignaciones/asignaciones.service');
const { alertarCompensacionesSinResponder } = require('../modules/turnos/turnos.worker');

beforeEach(() => jest.clearAllMocks());

test('delega en el servicio (que reclama cada aviso para no repetirlo)', async () => {
  AsignacionesService.alertarCompensacionesSinResponder.mockResolvedValue(2);
  await alertarCompensacionesSinResponder();
  expect(AsignacionesService.alertarCompensacionesSinResponder).toHaveBeenCalledTimes(1);
});

test('si el servicio falla, el error sube (el ciclo del worker lo registra y sigue)', async () => {
  AsignacionesService.alertarCompensacionesSinResponder.mockRejectedValue(new Error('boom'));
  await expect(alertarCompensacionesSinResponder()).rejects.toThrow('boom');
});
