'use strict';

// Nuevo comportamiento: editar fecha/hora_inicio/hora_fin_estimada/lugar ya no
// solo notifica a los asignados — a quien estaba 'confirmado' lo pasa a
// 'por_reconfirmar' (libera su plaza hasta que reconfirme). Por el mismo
// motivo, ese cambio se bloquea si ya hay alguien en_progreso/completado, o si
// falta menos de HORAS_CORTE_EDICION_OFERTA para que el turno empiece — no le
// queda tiempo real al trabajador para reaccionar a la notificación.
jest.mock('../config/database', () => ({
  pool: { query: jest.fn().mockResolvedValue([[]]) },
}));
jest.mock('../modules/turnos/ofertas/ofertas.model');
jest.mock('../modules/turnos/asignaciones/asignaciones.model');
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const { ahoraColombiaSQL } = require('../utils/fechaColombia');
const OfertasModel = require('../modules/turnos/ofertas/ofertas.model');
const AsignacionesModel = require('../modules/turnos/asignaciones/asignaciones.model');
const NotificacionesService = require('../modules/notificaciones/notificaciones.service');
const OfertasService = require('../modules/turnos/ofertas/ofertas.service');
const { HORAS_CORTE_EDICION_OFERTA } = require('../config/constants');

afterEach(() => jest.clearAllMocks());

/** Fecha/hora_inicio que caen `horas` horas después de ahora (hora Colombia). */
function turnoEnHoras(horas) {
  const [fecha, hora_inicio] = ahoraColombiaSQL(horas * 3_600_000).split(' ');
  return { fecha, hora_inicio };
}

describe('OfertasService.actualizar — reconfirmación al cambiar campos críticos', () => {
  test('bloquea si ya hay alguien en_progreso en el turno', async () => {
    const oferta = { id: 1, empresa_id: 7, estado: 'abierta', titulo: 'Bodega', lugar: 'Bodega A', ...turnoEnHoras(10) };
    OfertasModel.obtenerPorId.mockResolvedValue(oferta);
    AsignacionesModel.listarPorOferta.mockResolvedValue([
      { id: 10, estado: 'en_progreso', trabajador_nombre: 'Ana', trabajador_apellido: 'Ruiz' },
    ]);

    await expect(OfertasService.actualizar(7, 1, { lugar: 'Bodega B' })).rejects.toMatchObject({ statusCode: 409 });
    expect(OfertasModel.actualizar).not.toHaveBeenCalled();
  });

  test(`bloquea si faltan menos de ${HORAS_CORTE_EDICION_OFERTA}h para el inicio`, async () => {
    const oferta = { id: 2, empresa_id: 7, estado: 'abierta', titulo: 'Bodega', lugar: 'Bodega A', ...turnoEnHoras(HORAS_CORTE_EDICION_OFERTA - 0.5) };
    OfertasModel.obtenerPorId.mockResolvedValue(oferta);
    AsignacionesModel.listarPorOferta.mockResolvedValue([]);

    await expect(OfertasService.actualizar(7, 2, { lugar: 'Bodega B' })).rejects.toMatchObject({ statusCode: 409 });
    expect(OfertasModel.actualizar).not.toHaveBeenCalled();
  });

  test('con margen suficiente: pasa a los confirmados a por_reconfirmar y notifica', async () => {
    const oferta = { id: 3, empresa_id: 7, estado: 'abierta', titulo: 'Bodega', lugar: 'Bodega A', ...turnoEnHoras(HORAS_CORTE_EDICION_OFERTA + 1) };
    OfertasModel.obtenerPorId
      .mockResolvedValueOnce(oferta)
      .mockResolvedValueOnce({ ...oferta, lugar: 'Bodega B' });
    AsignacionesModel.listarPorOferta.mockResolvedValue([
      { id: 20, estado: 'confirmado', trabajador_nombre: 'Ana', trabajador_apellido: 'Ruiz' },
      { id: 21, estado: 'pendiente', trabajador_nombre: 'Luis', trabajador_apellido: 'Paz' },
    ]);
    AsignacionesModel.marcarPorReconfirmar.mockResolvedValue({ ok: true });
    AsignacionesModel.listarUsuariosAsignados.mockResolvedValue([501, 502]);
    OfertasModel.actualizar.mockResolvedValue(1);

    await OfertasService.actualizar(7, 3, { lugar: 'Bodega B' });

    expect(AsignacionesModel.marcarPorReconfirmar).toHaveBeenCalledWith(7, 20);
    expect(AsignacionesModel.marcarPorReconfirmar).not.toHaveBeenCalledWith(7, 21);
    expect(NotificacionesService.notificarVarios).toHaveBeenCalledWith(
      [501, 502], expect.objectContaining({ tipo: 'oferta.modificada' })
    );
  });

  test('editar un campo no crítico (descripción) no exige margen ni toca asignaciones', async () => {
    const oferta = { id: 4, empresa_id: 7, estado: 'abierta', titulo: 'Bodega', lugar: 'Bodega A', descripcion: 'vieja', ...turnoEnHoras(0.1) };
    OfertasModel.obtenerPorId
      .mockResolvedValueOnce(oferta)
      .mockResolvedValueOnce({ ...oferta, descripcion: 'nueva' });
    OfertasModel.actualizar.mockResolvedValue(1);

    await OfertasService.actualizar(7, 4, { descripcion: 'nueva' });

    expect(AsignacionesModel.listarPorOferta).not.toHaveBeenCalled();
    expect(AsignacionesModel.marcarPorReconfirmar).not.toHaveBeenCalled();
    expect(NotificacionesService.notificarVarios).not.toHaveBeenCalled();
    expect(OfertasModel.actualizar).toHaveBeenCalledWith(7, 4, { descripcion: 'nueva' });
  });
});
