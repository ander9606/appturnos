'use strict';

// Cambiar tarifa_dia de un puesto ya no se aplica en silencio: a quien está
// 'confirmado' en ese puesto lo pasa a 'por_reconfirmar' (mismo mecanismo que
// OfertasService.actualizar usa para fecha/hora/lugar) y le avisa. Se bloquea
// si ya hay alguien en_progreso/completado, o si falta menos de
// HORAS_CORTE_EDICION_OFERTA para que el turno empiece.
jest.mock('../config/database', () => ({
  pool: { query: jest.fn().mockResolvedValue([[]]) },
}));
jest.mock('../modules/turnos/ofertas/puestos/puestos.model');
jest.mock('../modules/turnos/ofertas/ofertas.model');
jest.mock('../modules/turnos/asignaciones/asignaciones.model');
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificar: jest.fn().mockResolvedValue(undefined),
}));

const { ahoraColombiaSQL } = require('../utils/fechaColombia');
const PuestosModel = require('../modules/turnos/ofertas/puestos/puestos.model');
const OfertasModel = require('../modules/turnos/ofertas/ofertas.model');
const AsignacionesModel = require('../modules/turnos/asignaciones/asignaciones.model');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const NotificacionesService = require('../modules/notificaciones/notificaciones.service');
const PuestosService = require('../modules/turnos/ofertas/puestos/puestos.service');
const { HORAS_CORTE_EDICION_OFERTA } = require('../config/constants');

afterEach(() => jest.clearAllMocks());

/** Fecha/hora_inicio que caen `horas` horas después de ahora (hora Colombia). */
function turnoEnHoras(horas) {
  const [fecha, hora_inicio] = ahoraColombiaSQL(horas * 3_600_000).split(' ');
  return { fecha, hora_inicio };
}

const PUESTO_BASE = { id: 50, oferta_id: 1, cargo_id: 9, cargo_nombre: 'Mesero', plazas: 2, plazas_cubiertas: 1, tarifa_dia: 80000 };

describe('PuestosService.actualizar — reconfirmación al cambiar tarifa_dia', () => {
  test('bloquea si ya hay alguien en_progreso en ese puesto', async () => {
    OfertasModel.obtenerPorId.mockResolvedValue({ id: 1, empresa_id: 7 });
    PuestosModel.obtenerPorId.mockResolvedValue(PUESTO_BASE);
    AsignacionesModel.listarPorOferta.mockResolvedValue([
      { id: 10, puesto_id: 50, estado: 'en_progreso' },
    ]);

    await expect(PuestosService.actualizar(7, 1, 50, { tarifa_dia: 90000 })).rejects.toMatchObject({ statusCode: 409 });
    expect(PuestosModel.actualizar).not.toHaveBeenCalled();
  });

  test(`bloquea si faltan menos de ${HORAS_CORTE_EDICION_OFERTA}h para el inicio y hay confirmados`, async () => {
    OfertasModel.obtenerPorId
      .mockResolvedValueOnce({ id: 1, empresa_id: 7 })
      .mockResolvedValueOnce({ id: 1, empresa_id: 7, ...turnoEnHoras(HORAS_CORTE_EDICION_OFERTA - 0.5) });
    PuestosModel.obtenerPorId.mockResolvedValue(PUESTO_BASE);
    AsignacionesModel.listarPorOferta.mockResolvedValue([
      { id: 11, puesto_id: 50, estado: 'confirmado', trabajador_id: 200 },
    ]);

    await expect(PuestosService.actualizar(7, 1, 50, { tarifa_dia: 90000 })).rejects.toMatchObject({ statusCode: 409 });
    expect(PuestosModel.actualizar).not.toHaveBeenCalled();
  });

  test('con margen suficiente: pasa a los confirmados de ESTE puesto a por_reconfirmar y notifica', async () => {
    OfertasModel.obtenerPorId
      .mockResolvedValueOnce({ id: 1, empresa_id: 7 })
      .mockResolvedValueOnce({ id: 1, empresa_id: 7, ...turnoEnHoras(HORAS_CORTE_EDICION_OFERTA + 1) });
    PuestosModel.obtenerPorId.mockResolvedValue(PUESTO_BASE);
    AsignacionesModel.listarPorOferta.mockResolvedValue([
      { id: 20, puesto_id: 50, estado: 'confirmado', trabajador_id: 200 },
      { id: 21, puesto_id: 50, estado: 'pendiente', trabajador_id: 201 },
      { id: 22, puesto_id: 99, estado: 'confirmado', trabajador_id: 202 }, // otro puesto, no debe tocarse
    ]);
    AsignacionesModel.marcarPorReconfirmar.mockResolvedValue({ ok: true });
    TrabajadoresModel.obtenerUsuarioId.mockResolvedValue(501);
    PuestosModel.actualizar.mockResolvedValue(1);

    await PuestosService.actualizar(7, 1, 50, { tarifa_dia: 90000 });

    expect(AsignacionesModel.marcarPorReconfirmar).toHaveBeenCalledTimes(1);
    expect(AsignacionesModel.marcarPorReconfirmar).toHaveBeenCalledWith(7, 20);
    expect(NotificacionesService.notificar).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: 501, tipo: 'oferta.modificada' })
    );
  });

  test('editar plazas sin tocar tarifa_dia no exige margen ni toca asignaciones', async () => {
    OfertasModel.obtenerPorId.mockResolvedValue({ id: 1, empresa_id: 7 });
    PuestosModel.obtenerPorId.mockResolvedValue(PUESTO_BASE);
    PuestosModel.actualizar.mockResolvedValue(1);

    await PuestosService.actualizar(7, 1, 50, { plazas: 3 });

    expect(AsignacionesModel.listarPorOferta).not.toHaveBeenCalled();
    expect(AsignacionesModel.marcarPorReconfirmar).not.toHaveBeenCalled();
    expect(NotificacionesService.notificar).not.toHaveBeenCalled();
  });
});
