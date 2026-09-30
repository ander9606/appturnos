'use strict';

// verificarPersonalIncompleto (aviso 24h antes de un turno con plazas sin
// cubrir) debe decir qué hacer, igual que advertenciasCapacidad al crear el
// turno: banco de talento si hay cupo, o subir de plan si ya está en el tope.
jest.mock('../modules/turnos/ofertas/ofertas.model');
jest.mock('../modules/turnos/asignaciones/asignaciones.service', () => ({
  cerrarMasivo: jest.fn(),
}));
jest.mock('../modules/trabajadores/trabajadores.service');
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const OfertasModel = require('../modules/turnos/ofertas/ofertas.model');
const NotificacionesService = require('../modules/notificaciones/notificaciones.service');
const TrabajadoresService = require('../modules/trabajadores/trabajadores.service');
const { verificarPersonalIncompleto } = require('../modules/turnos/turnos.worker');

const OFERTA = {
  id: 1, empresa_id: 7, titulo: 'Turno bodega', fecha: '2099-01-01',
  hora_inicio: '08:00:00', total_plazas: 5, cubiertas: 2, gestor_ids: [10, 11],
};

beforeEach(() => {
  jest.clearAllMocks();
  OfertasModel.marcarAlertaEnviada.mockResolvedValue(undefined);
});

describe('turnos.worker — verificarPersonalIncompleto', () => {
  test('con cupo disponible, sugiere el banco de talento', async () => {
    OfertasModel.listarProximasConPersonalIncompleto.mockResolvedValue([OFERTA]);
    TrabajadoresService.obtenerCupoPlan.mockResolvedValue({ plan: 'basico', limite: 10, total: 3, alTope: false });

    await verificarPersonalIncompleto();

    expect(TrabajadoresService.obtenerCupoPlan).toHaveBeenCalledWith(7);
    const [, payload] = NotificacionesService.notificarVarios.mock.calls[0];
    expect(payload.mensaje).toMatch(/faltan 3 plazas/);
    expect(payload.mensaje).toMatch(/Banco de talento/);
    expect(payload.mensaje).not.toMatch(/tope/);
    expect(OfertasModel.marcarAlertaEnviada).toHaveBeenCalledWith(1);
  });

  test('en el tope del plan, sugiere ampliar el plan en vez del banco de talento', async () => {
    OfertasModel.listarProximasConPersonalIncompleto.mockResolvedValue([OFERTA]);
    TrabajadoresService.obtenerCupoPlan.mockResolvedValue({ plan: 'basico', limite: 10, total: 10, alTope: true });

    await verificarPersonalIncompleto();

    const [, payload] = NotificacionesService.notificarVarios.mock.calls[0];
    expect(payload.mensaje).toMatch(/tope de trabajadores de tu plan \(10\)/);
    expect(payload.mensaje).not.toMatch(/Banco de talento/);
  });

  test('sin ofertas con personal incompleto → no notifica', async () => {
    OfertasModel.listarProximasConPersonalIncompleto.mockResolvedValue([]);

    await verificarPersonalIncompleto();

    expect(TrabajadoresService.obtenerCupoPlan).not.toHaveBeenCalled();
    expect(NotificacionesService.notificarVarios).not.toHaveBeenCalled();
  });
});
