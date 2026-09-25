'use strict';

// Primera asignación de fecha de un descanso compensatorio pendiente (el
// jefe/admin la elige desde el picker de rango). Antes de esto, asignar() no
// validaba nada server-side más allá del formato de fecha en la ruta — el
// picker solo ocultaba las fechas malas en el cliente, pero un POST directo
// podía poner cualquier fecha, incluido un domingo/festivo o una fuera del
// plazo legal. Ahora comparte la misma validación que ya tenía reasignar().
jest.mock('../modules/nomina/compensatorios/compensatorios.model');
jest.mock('../modules/nomina/registros/registros.model');
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/notificaciones/notificaciones.service');
jest.mock('../utils/laboralUtils', () => ({ esDiaFestivo: jest.fn(() => false) }));

const CompensatoriosModel = require('../modules/nomina/compensatorios/compensatorios.model');
const RegistrosModel = require('../modules/nomina/registros/registros.model');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const NotificacionesService = require('../modules/notificaciones/notificaciones.service');
const { esDiaFestivo } = require('../utils/laboralUtils');
const CompensatoriosService = require('../modules/nomina/compensatorios/compensatorios.service');

const EMPRESA_ID = 1;
const USUARIO_ID = 9;
const COMP_ID = 5;

function compBase(overrides = {}) {
  return {
    id: COMP_ID,
    empresa_id: EMPRESA_ID,
    trabajador_id: 3,
    periodo_id: 7,
    origen_fecha: '2026-06-21', // domingo trabajado
    estado: 'pendiente',
    fecha_asignada: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  esDiaFestivo.mockReturnValue(false);
  TrabajadoresModel.obtenerPorId.mockResolvedValue({ id: 3, usuario_id: 42 });
  NotificacionesService.notificar.mockResolvedValue();
});

describe('CompensatoriosService.asignar', () => {
  test('no encontrado → 404', async () => {
    CompensatoriosModel.obtenerPorId.mockResolvedValue(null);

    await expect(
      CompensatoriosService.asignar(EMPRESA_ID, USUARIO_ID, COMP_ID, { fechaAsignada: '2026-06-25' })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test('ya no está pendiente → 409, no valida ni asigna', async () => {
    CompensatoriosModel.obtenerPorId.mockResolvedValue(compBase({ estado: 'asignado' }));

    await expect(
      CompensatoriosService.asignar(EMPRESA_ID, USUARIO_ID, COMP_ID, { fechaAsignada: '2026-06-25' })
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(CompensatoriosModel.asignar).not.toHaveBeenCalled();
  });

  test('rechaza fecha fuera del plazo legal (28 días desde origen_fecha)', async () => {
    CompensatoriosModel.obtenerPorId.mockResolvedValue(compBase());

    await expect(
      CompensatoriosService.asignar(EMPRESA_ID, USUARIO_ID, COMP_ID, { fechaAsignada: '2026-08-01' })
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(CompensatoriosModel.asignar).not.toHaveBeenCalled();
  });

  test('rechaza domingo/festivo', async () => {
    CompensatoriosModel.obtenerPorId.mockResolvedValue(compBase());
    esDiaFestivo.mockReturnValue(true);

    await expect(
      CompensatoriosService.asignar(EMPRESA_ID, USUARIO_ID, COMP_ID, { fechaAsignada: '2026-06-28' })
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(CompensatoriosModel.asignar).not.toHaveBeenCalled();
  });

  test('rechaza si el trabajador ya tiene un registro ese día', async () => {
    CompensatoriosModel.obtenerPorId.mockResolvedValue(compBase());
    RegistrosModel.obtenerPorFecha.mockResolvedValue({ id: 99 });
    CompensatoriosModel.existeFechaAsignada.mockResolvedValue(false);

    await expect(
      CompensatoriosService.asignar(EMPRESA_ID, USUARIO_ID, COMP_ID, { fechaAsignada: '2026-06-25' })
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(CompensatoriosModel.asignar).not.toHaveBeenCalled();
  });

  test('rechaza si el trabajador ya tiene otro compensatorio asignado ese día', async () => {
    CompensatoriosModel.obtenerPorId.mockResolvedValue(compBase());
    RegistrosModel.obtenerPorFecha.mockResolvedValue(null);
    CompensatoriosModel.existeFechaAsignada.mockResolvedValue(true);

    await expect(
      CompensatoriosService.asignar(EMPRESA_ID, USUARIO_ID, COMP_ID, { fechaAsignada: '2026-06-25' })
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(CompensatoriosModel.asignar).not.toHaveBeenCalled();
  });

  test('fecha válida → asigna, crea el registro placeholder y notifica', async () => {
    CompensatoriosModel.obtenerPorId.mockResolvedValue(compBase());
    RegistrosModel.obtenerPorFecha.mockResolvedValue(null);
    CompensatoriosModel.existeFechaAsignada.mockResolvedValue(false);
    CompensatoriosModel.asignar.mockResolvedValue(1);
    RegistrosModel.crear.mockResolvedValue(88);

    await CompensatoriosService.asignar(EMPRESA_ID, USUARIO_ID, COMP_ID, { fechaAsignada: '2026-06-25' });

    expect(CompensatoriosModel.asignar).toHaveBeenCalledWith(EMPRESA_ID, COMP_ID, {
      fechaAsignada: '2026-06-25', asignadoPor: USUARIO_ID,
    });
    expect(RegistrosModel.crear).toHaveBeenCalledWith(
      EMPRESA_ID,
      expect.objectContaining({ fecha: '2026-06-25', tipo_dia: 'compensatorio' })
    );
    expect(CompensatoriosModel.marcarTomado).toHaveBeenCalledWith(EMPRESA_ID, COMP_ID);
    expect(NotificacionesService.notificar).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: 42, tipo: 'nomina.compensatorio_asignado' })
    );
  });

  test('carrera: dos asignaciones casi simultáneas para el mismo trabajador/fecha → 409 legible (índice único de la BD)', async () => {
    // Ambas pasaron validarFechaDescanso (existeFechaAsignada aún decía "libre")
    // porque llegaron casi al mismo tiempo — el índice único de la migración 096
    // es quien realmente lo impide, esto solo verifica que se traduzca bien.
    CompensatoriosModel.obtenerPorId.mockResolvedValue(compBase());
    RegistrosModel.obtenerPorFecha.mockResolvedValue(null);
    CompensatoriosModel.existeFechaAsignada.mockResolvedValue(false);
    const err = new Error("Duplicate entry '1-3-2026-06-25' for key 'uq_compensatorio_trabajador_fecha'");
    err.code = 'ER_DUP_ENTRY';
    CompensatoriosModel.asignar.mockRejectedValue(err);

    await expect(
      CompensatoriosService.asignar(EMPRESA_ID, USUARIO_ID, COMP_ID, { fechaAsignada: '2026-06-25' })
    ).rejects.toMatchObject({ statusCode: 409, message: 'El trabajador ya tiene otro descanso asignado ese día' });
  });
});
