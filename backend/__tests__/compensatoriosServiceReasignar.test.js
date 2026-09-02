'use strict';

// Reasignación de fecha de un descanso compensatorio ya asignado/tomado
// (el jefe mueve el auto-asignado a otra fecha dentro del plazo legal de 28 días).
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
    origen_fecha: '2026-08-02',
    estado: 'tomado',
    fecha_asignada: '2026-08-10',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  esDiaFestivo.mockReturnValue(false);
  TrabajadoresModel.obtenerPorId.mockResolvedValue({ id: 3, usuario_id: 42 });
  NotificacionesService.notificar.mockResolvedValue();
});

describe('CompensatoriosService.reasignar', () => {
  test('mueve la fecha: borra el placeholder viejo, crea el nuevo, notifica', async () => {
    CompensatoriosModel.obtenerPorId.mockResolvedValue(compBase());
    RegistrosModel.obtenerPorFecha.mockImplementation((_e, _t, fecha) =>
      fecha === '2026-08-10'
        ? { id: 55, tipo_dia: 'compensatorio', hora_entrada: null }
        : null
    );
    CompensatoriosModel.existeFechaAsignada.mockResolvedValue(false);
    CompensatoriosModel.reasignar.mockResolvedValue(1);
    RegistrosModel.crear.mockResolvedValue(88);

    await CompensatoriosService.reasignar(EMPRESA_ID, USUARIO_ID, COMP_ID, { fechaAsignada: '2026-08-15' });

    expect(RegistrosModel.eliminar).toHaveBeenCalledWith(EMPRESA_ID, 55);
    expect(CompensatoriosModel.reasignar).toHaveBeenCalledWith(EMPRESA_ID, COMP_ID, {
      fechaAsignada: '2026-08-15',
      asignadoPor: USUARIO_ID,
    });
    expect(RegistrosModel.crear).toHaveBeenCalledWith(
      EMPRESA_ID,
      expect.objectContaining({ fecha: '2026-08-15', tipo_dia: 'compensatorio' })
    );
    expect(NotificacionesService.notificar).toHaveBeenCalled();
  });

  test('si el día anterior tenía horas reales, no lo borra pero libera el tipo_dia', async () => {
    CompensatoriosModel.obtenerPorId.mockResolvedValue(compBase());
    RegistrosModel.obtenerPorFecha.mockImplementation((_e, _t, fecha) =>
      fecha === '2026-08-10'
        ? { id: 55, tipo_dia: 'compensatorio', hora_entrada: '08:00:00', hora_salida: '17:00:00' }
        : null
    );
    CompensatoriosModel.existeFechaAsignada.mockResolvedValue(false);
    CompensatoriosModel.reasignar.mockResolvedValue(1);
    RegistrosModel.crear.mockResolvedValue(88);

    await CompensatoriosService.reasignar(EMPRESA_ID, USUARIO_ID, COMP_ID, { fechaAsignada: '2026-08-15' });

    expect(RegistrosModel.eliminar).not.toHaveBeenCalled();
    expect(RegistrosModel.actualizar).toHaveBeenCalledWith(
      EMPRESA_ID,
      55,
      expect.objectContaining({ tipo_dia: 'ordinario', hora_entrada: '08:00:00', hora_salida: '17:00:00' })
    );
  });

  test('rechaza fecha fuera del plazo legal (28 días desde origen_fecha)', async () => {
    CompensatoriosModel.obtenerPorId.mockResolvedValue(compBase());

    await expect(
      CompensatoriosService.reasignar(EMPRESA_ID, USUARIO_ID, COMP_ID, { fechaAsignada: '2026-09-15' })
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(CompensatoriosModel.reasignar).not.toHaveBeenCalled();
  });

  test('rechaza domingo/festivo', async () => {
    CompensatoriosModel.obtenerPorId.mockResolvedValue(compBase());
    esDiaFestivo.mockReturnValue(true);

    await expect(
      CompensatoriosService.reasignar(EMPRESA_ID, USUARIO_ID, COMP_ID, { fechaAsignada: '2026-08-16' })
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  test('rechaza si el descanso aún está pendiente (usa asignar, no reasignar)', async () => {
    CompensatoriosModel.obtenerPorId.mockResolvedValue(compBase({ estado: 'pendiente', fecha_asignada: null }));

    await expect(
      CompensatoriosService.reasignar(EMPRESA_ID, USUARIO_ID, COMP_ID, { fechaAsignada: '2026-08-15' })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  test('rechaza si el trabajador ya tiene un registro ese día', async () => {
    CompensatoriosModel.obtenerPorId.mockResolvedValue(compBase());
    RegistrosModel.obtenerPorFecha.mockImplementation((_e, _t, fecha) =>
      fecha === '2026-08-15' ? { id: 99 } : null
    );
    CompensatoriosModel.existeFechaAsignada.mockResolvedValue(false);

    await expect(
      CompensatoriosService.reasignar(EMPRESA_ID, USUARIO_ID, COMP_ID, { fechaAsignada: '2026-08-15' })
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(CompensatoriosModel.reasignar).not.toHaveBeenCalled();
  });
});
