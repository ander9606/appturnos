'use strict';

// Regresión: "Marcar completada" forzaba el estado sin mirar las asignaciones,
// así que un trabajador que nunca marcó salida (en_progreso) o nunca llegó
// (confirmado sin ingreso) quedaba "completado" en el sistema sin datos reales
// de horas/pago. Ahora bloquea lo primero mientras el turno esté fresco,
// resuelve lo segundo de inmediato como no_presentado, y pasado el margen de
// gracia (DIAS_GRACIA_ASIGNACIONES_COLGADAS) fuerza el cierre en vez de
// bloquear para siempre — mismo cierre que turnos.worker.js ya aplica a
// ofertas vencidas.
jest.mock('../config/database', () => ({
  pool: { query: jest.fn().mockResolvedValue([[]]) },
}));
jest.mock('../modules/turnos/ofertas/ofertas.model');
jest.mock('../modules/turnos/asignaciones/asignaciones.model');
jest.mock('../modules/turnos/asignaciones/asignaciones.service', () => ({
  cerrarMasivo: jest.fn(),
}));
jest.mock('../modules/integracion/costo-labor.service', () => ({
  verificarYEmitir: jest.fn().mockResolvedValue(undefined),
}));

const { ahoraColombiaSQL } = require('../utils/fechaColombia');
const OfertasModel = require('../modules/turnos/ofertas/ofertas.model');
const AsignacionesModel = require('../modules/turnos/asignaciones/asignaciones.model');
const AsignacionesService = require('../modules/turnos/asignaciones/asignaciones.service');
const OfertasService = require('../modules/turnos/ofertas/ofertas.service');
const { DIAS_GRACIA_ASIGNACIONES_COLGADAS } = require('../config/constants');

afterEach(() => jest.clearAllMocks());

function fechaHaceNDias(n) {
  return ahoraColombiaSQL(-n * 86_400_000).slice(0, 10);
}

describe('OfertasService.completar', () => {
  test('bloquea si algún trabajador sigue en_progreso y el turno es reciente', async () => {
    const ofertaReciente = { id: 1, empresa_id: 7, estado: 'publicada', fecha: fechaHaceNDias(0) };
    OfertasModel.obtenerPorId.mockResolvedValue(ofertaReciente);
    AsignacionesModel.listarPorOferta.mockResolvedValue([
      { id: 100, estado: 'en_progreso', trabajador_nombre: 'Ana', trabajador_apellido: 'Ruiz' },
      { id: 101, estado: 'completado', trabajador_nombre: 'Luis', trabajador_apellido: 'Paz' },
    ]);

    await expect(OfertasService.completar(7, 1)).rejects.toMatchObject({ statusCode: 409 });
    expect(OfertasModel.cambiarEstado).not.toHaveBeenCalled();
    expect(AsignacionesService.cerrarMasivo).not.toHaveBeenCalled();
  });

  test('pasado el margen de gracia, fuerza el cierre capeando horas por default', async () => {
    const ofertaVieja = { id: 2, empresa_id: 7, estado: 'publicada', fecha: fechaHaceNDias(DIAS_GRACIA_ASIGNACIONES_COLGADAS) };
    OfertasModel.obtenerPorId
      .mockResolvedValueOnce(ofertaVieja)
      .mockResolvedValueOnce(ofertaVieja)
      .mockResolvedValueOnce({ ...ofertaVieja, estado: 'completada' });
    AsignacionesModel.listarPorOferta.mockResolvedValue([
      { id: 102, estado: 'en_progreso', trabajador_nombre: 'Ana', trabajador_apellido: 'Ruiz' },
    ]);
    AsignacionesService.cerrarMasivo.mockResolvedValue({ cerradas: 1, noPresentados: 0 });
    OfertasModel.cambiarEstado.mockResolvedValue(1);

    const resultado = await OfertasService.completar(7, 2);

    expect(AsignacionesService.cerrarMasivo).toHaveBeenCalledWith(7, 2, [], { capearHoras: true });
    expect(OfertasModel.cambiarEstado).toHaveBeenCalledWith(7, 2, 'completada');
    expect(resultado.forzados_al_completar).toBe(1);
    expect(resultado.forzados_con_hora_actual).toBe(false);
  });

  test('pasado el margen de gracia, "cerrar ahora" pasa capearHoras: false', async () => {
    const ofertaVieja = { id: 5, empresa_id: 7, estado: 'publicada', fecha: fechaHaceNDias(DIAS_GRACIA_ASIGNACIONES_COLGADAS) };
    OfertasModel.obtenerPorId
      .mockResolvedValueOnce(ofertaVieja)
      .mockResolvedValueOnce(ofertaVieja)
      .mockResolvedValueOnce({ ...ofertaVieja, estado: 'completada' });
    AsignacionesModel.listarPorOferta.mockResolvedValue([
      { id: 103, estado: 'en_progreso', trabajador_nombre: 'Ana', trabajador_apellido: 'Ruiz' },
    ]);
    AsignacionesService.cerrarMasivo.mockResolvedValue({ cerradas: 1, noPresentados: 0 });
    OfertasModel.cambiarEstado.mockResolvedValue(1);

    const resultado = await OfertasService.completar(7, 5, { capearHoras: false });

    expect(AsignacionesService.cerrarMasivo).toHaveBeenCalledWith(7, 5, [], { capearHoras: false });
    expect(resultado.forzados_con_hora_actual).toBe(true);
  });

  test('resuelve como no_presentado a quien nunca marcó ingreso y completa la oferta', async () => {
    const oferta = { id: 3, empresa_id: 7, estado: 'publicada', fecha: fechaHaceNDias(0) };
    OfertasModel.obtenerPorId
      .mockResolvedValueOnce(oferta)
      .mockResolvedValueOnce(oferta)
      .mockResolvedValueOnce({ ...oferta, estado: 'completada' });
    AsignacionesModel.listarPorOferta.mockResolvedValue([
      { id: 200, estado: 'confirmado', trabajador_nombre: 'Ana', trabajador_apellido: 'Ruiz' },
      { id: 201, estado: 'completado', trabajador_nombre: 'Luis', trabajador_apellido: 'Paz' },
    ]);
    AsignacionesModel.marcarNoPresentado.mockResolvedValue({ ok: true });
    OfertasModel.cambiarEstado.mockResolvedValue(1);

    const resultado = await OfertasService.completar(7, 3);

    expect(AsignacionesModel.marcarNoPresentado).toHaveBeenCalledWith(7, 200);
    expect(OfertasModel.cambiarEstado).toHaveBeenCalledWith(7, 3, 'completada');
    expect(resultado.no_presentados_al_completar).toBe(1);
  });

  test('completa directo si no quedan asignaciones sin resolver', async () => {
    const oferta = { id: 4, empresa_id: 7, estado: 'publicada', fecha: fechaHaceNDias(0) };
    OfertasModel.obtenerPorId
      .mockResolvedValueOnce(oferta)
      .mockResolvedValueOnce(oferta)
      .mockResolvedValueOnce({ ...oferta, estado: 'completada' });
    AsignacionesModel.listarPorOferta.mockResolvedValue([
      { id: 300, estado: 'completado', trabajador_nombre: 'Luis', trabajador_apellido: 'Paz' },
    ]);
    OfertasModel.cambiarEstado.mockResolvedValue(1);

    const resultado = await OfertasService.completar(7, 4);

    expect(AsignacionesModel.marcarNoPresentado).not.toHaveBeenCalled();
    expect(AsignacionesService.cerrarMasivo).not.toHaveBeenCalled();
    expect(resultado.no_presentados_al_completar).toBe(0);
  });
});
