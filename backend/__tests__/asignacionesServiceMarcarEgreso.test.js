'use strict';

// Regresión: marcarEgreso() usaba `trabajador.id` en la llamada a
// TrabajadoresModel.guardarFirma(), pero la variable `trabajador` nunca se
// declara en esta función (a diferencia de marcarIngreso(), que sí la
// reconstruye localmente). Esto lanza un ReferenceError síncrono al evaluar
// el argumento — antes de que la promesa exista, así que el .catch(() => null)
// encadenado no lo atrapa — rompiendo "Marcar Egreso" para TODO trabajador,
// no solo el caso de filas duplicadas que este flujo originalmente arreglaba.
jest.mock('../config/database', () => ({
  pool: { query: jest.fn().mockResolvedValue([[]]) },
}));
jest.mock('../modules/turnos/asignaciones/asignaciones.model');
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/contratos/contratos.model');
jest.mock('../modules/integracion/integracion.service', () => ({ emitir: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../modules/integracion/costo-labor.service', () => ({ verificarYEmitir: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificar: jest.fn().mockResolvedValue(undefined),
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const AsignacionesModel = require('../modules/turnos/asignaciones/asignaciones.model');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const ContratosModel    = require('../modules/contratos/contratos.model');
const AsignacionesService = require('../modules/turnos/asignaciones/asignaciones.service');

afterEach(() => jest.clearAllMocks());

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
  };

  beforeEach(() => {
    AsignacionesModel.obtenerConDetalles.mockResolvedValue(asignacion);
    AsignacionesModel.registrarEgreso.mockResolvedValue(undefined);
    AsignacionesModel.obtenerPorId.mockResolvedValue({ id: 500, estado: 'completado' });
    ContratosModel.obtenerPorAsignacion.mockResolvedValue(null);
    TrabajadoresModel.guardarFirma.mockResolvedValue(undefined);
  });

  test('marca egreso y guarda la firma con el trabajador_id de la asignación (sin ReferenceError)', async () => {
    const resultado = await AsignacionesService.marcarEgreso(7, 500, 42, { firma_b64: 'data:...' });

    expect(TrabajadoresModel.guardarFirma).toHaveBeenCalledWith(99, 'data:...');
    expect(AsignacionesModel.registrarEgreso).toHaveBeenCalledWith(7, 500, 'data:...');
    expect(resultado).toEqual({ id: 500, estado: 'completado' });
  });

  test('rechaza a un usuario que no coincide con usuario_id de la asignación', async () => {
    await expect(
      AsignacionesService.marcarEgreso(7, 500, 999, { firma_b64: 'data:...' })
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(AsignacionesModel.registrarEgreso).not.toHaveBeenCalled();
  });
});
