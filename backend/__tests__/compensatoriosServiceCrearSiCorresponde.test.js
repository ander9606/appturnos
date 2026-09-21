'use strict';

// crearSiCorresponde() clasifica domingos trabajados en el mes calendario
// (Art. 180/181 CST): ocasional (1º/2º del mes) solo avisa al trabajador y no
// lleva recargo; habitual (3º+) y festivo entre semana avisan a trabajador y
// gestores. Ya no intenta auto-asignar fecha — todo compensatorio nace
// 'pendiente' (ver compensatoriosModelRangoDisponible.test.js para el rango
// que usa el jefe/admin para asignarla a mano).
jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../modules/nomina/compensatorios/compensatorios.model');
jest.mock('../modules/nomina/registros/registros.model');
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/notificaciones/notificaciones.service');
jest.mock('../utils/laboralUtils', () => ({
  esDiaFestivo: jest.fn(),
  esDomingo: jest.fn(),
}));

const { pool } = require('../config/database');
const CompensatoriosModel = require('../modules/nomina/compensatorios/compensatorios.model');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const NotificacionesService = require('../modules/notificaciones/notificaciones.service');
const { esDomingo } = require('../utils/laboralUtils');
const CompensatoriosService = require('../modules/nomina/compensatorios/compensatorios.service');

const EMPRESA_ID = 3;
const TRABAJADOR_ID = 54;

beforeEach(() => {
  jest.clearAllMocks();
  TrabajadoresModel.obtenerPorId.mockResolvedValue({
    id: TRABAJADOR_ID, nombre: 'Andrea', apellido: 'Salazar', usuario_id: 74,
  });
  NotificacionesService.notificar.mockResolvedValue();
  NotificacionesService.notificarVarios.mockResolvedValue();
  pool.query.mockResolvedValue([[{ id: 20 }, { id: 33 }]]); // gestores de la empresa
});

describe('CompensatoriosService.crearSiCorresponde', () => {
  test('ni festivo ni domingo → no crea nada, no notifica', async () => {
    esDomingo.mockReturnValue(false);

    const id = await CompensatoriosService.crearSiCorresponde(EMPRESA_ID, {
      trabajadorId: TRABAJADOR_ID, periodoId: 5, fecha: '2026-06-10', esFestivo: false, registroId: 1,
    });

    expect(id).toBeNull();
    expect(CompensatoriosModel.crear).not.toHaveBeenCalled();
    expect(NotificacionesService.notificar).not.toHaveBeenCalled();
  });

  test('ya existía (INSERT IGNORE devuelve null) → no notifica', async () => {
    esDomingo.mockReturnValue(true);
    CompensatoriosModel.crear.mockResolvedValue(null);

    const id = await CompensatoriosService.crearSiCorresponde(EMPRESA_ID, {
      trabajadorId: TRABAJADOR_ID, periodoId: 5, fecha: '2026-06-07', esFestivo: true, registroId: 1,
      clasificacion: 'ocasional', numeroDomingo: 1,
    });

    expect(id).toBeNull();
    expect(NotificacionesService.notificar).not.toHaveBeenCalled();
  });

  test('domingo ocasional (1º/2º del mes) → solo avisa al trabajador, sin recargo', async () => {
    esDomingo.mockReturnValue(true);
    CompensatoriosModel.crear.mockResolvedValue(1);

    const id = await CompensatoriosService.crearSiCorresponde(EMPRESA_ID, {
      trabajadorId: TRABAJADOR_ID, periodoId: 5, fecha: '2026-06-07', esFestivo: true, registroId: 10,
      clasificacion: 'ocasional', numeroDomingo: 1,
    });

    expect(id).toBe(1);
    expect(CompensatoriosModel.crear).toHaveBeenCalledWith(EMPRESA_ID, {
      trabajadorId: TRABAJADOR_ID, periodoId: 5, origenFecha: '2026-06-07', origenRegistroId: 10,
      clasificacion: 'ocasional',
    });
    expect(NotificacionesService.notificar).toHaveBeenCalledTimes(1);
    expect(NotificacionesService.notificar).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: 74, tipo: 'nomina.domingo_ocasional' })
    );
    expect(NotificacionesService.notificarVarios).not.toHaveBeenCalled();
  });

  test('domingo habitual (3º+ del mes) → avisa a trabajador y gestores, con recargo', async () => {
    esDomingo.mockReturnValue(true);
    CompensatoriosModel.crear.mockResolvedValue(2);

    await CompensatoriosService.crearSiCorresponde(EMPRESA_ID, {
      trabajadorId: TRABAJADOR_ID, periodoId: 5, fecha: '2026-06-21', esFestivo: true, registroId: 12,
      clasificacion: 'habitual', numeroDomingo: 3,
    });

    expect(NotificacionesService.notificar).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: 74, tipo: 'nomina.domingo_habitual' })
    );
    expect(NotificacionesService.notificarVarios).toHaveBeenCalledWith(
      [20, 33],
      expect.objectContaining({ tipo: 'nomina.domingo_habitual_gestor' })
    );
  });

  test('festivo entre semana (no domingo) → siempre avisa a trabajador y gestores', async () => {
    esDomingo.mockReturnValue(false);
    CompensatoriosModel.crear.mockResolvedValue(3);

    await CompensatoriosService.crearSiCorresponde(EMPRESA_ID, {
      trabajadorId: TRABAJADOR_ID, periodoId: 5, fecha: '2026-07-20', esFestivo: true, registroId: 13,
    });

    expect(CompensatoriosModel.crear).toHaveBeenCalledWith(
      EMPRESA_ID,
      expect.objectContaining({ clasificacion: 'habitual' }) // default cuando no aplica ocasional/habitual
    );
    expect(NotificacionesService.notificar).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: 74, tipo: 'nomina.festivo_trabajado' })
    );
    expect(NotificacionesService.notificarVarios).toHaveBeenCalledWith(
      [20, 33],
      expect.objectContaining({ tipo: 'nomina.festivo_trabajado_gestor' })
    );
  });

  test('un fallo notificando no revienta la creación (best-effort)', async () => {
    esDomingo.mockReturnValue(true);
    CompensatoriosModel.crear.mockResolvedValue(4);
    TrabajadoresModel.obtenerPorId.mockRejectedValue(new Error('DB caída'));

    const id = await CompensatoriosService.crearSiCorresponde(EMPRESA_ID, {
      trabajadorId: TRABAJADOR_ID, periodoId: 5, fecha: '2026-06-07', esFestivo: true, registroId: 10,
      clasificacion: 'ocasional', numeroDomingo: 1,
    });

    expect(id).toBe(4);
  });

  test('no auto-asigna fecha — nunca llama a CompensatoriosModel.asignar', async () => {
    esDomingo.mockReturnValue(true);
    CompensatoriosModel.crear.mockResolvedValue(5);

    await CompensatoriosService.crearSiCorresponde(EMPRESA_ID, {
      trabajadorId: TRABAJADOR_ID, periodoId: 5, fecha: '2026-06-07', esFestivo: true, registroId: 10,
      clasificacion: 'ocasional', numeroDomingo: 1,
    });

    expect(CompensatoriosModel.asignar).not.toHaveBeenCalled();
  });
});
