'use strict';

// Marcar un día a mano como «compensatorio» (crear o corregir un registro) debe descontar un descanso
// pendiente del trabajador: sin pendientes se rechaza, con pendientes se asigna el más antiguo cuya
// ventana de 28 días incluya el día, y si el día deja de ser compensatorio el descanso vuelve a pendiente.
// Antes se guardaba el tipo_dia sin mirar nada: el trabajador descansaba y su compensatorio seguía pendiente.
jest.mock('../config/database', () => ({
  pool: { query: jest.fn().mockResolvedValue([[]]) },
}));
jest.mock('../modules/nomina/registros/registros.model');
jest.mock('../modules/nomina/periodos/periodos.model');
jest.mock('../modules/nomina/compensatorios/compensatorios.model');
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/puntos-marcaje/puntos-marcaje.model');
jest.mock('../modules/notificaciones/notificaciones.service');

const RegistrosModel      = require('../modules/nomina/registros/registros.model');
const PeriodosModel       = require('../modules/nomina/periodos/periodos.model');
const CompensatoriosModel = require('../modules/nomina/compensatorios/compensatorios.model');
const TrabajadoresModel   = require('../modules/trabajadores/trabajadores.model');
const RegistrosService    = require('../modules/nomina/registros/registros.service');
const { ROLES }           = require('../config/constants');

const GESTOR = { sub: 10, rol: ROLES.JEFE_NOMINA };
const FECHA = '2026-06-10'; // miércoles, no festivo

const pendiente = (id, origen_fecha) => ({ id, empresa_id: 1, trabajador_id: 5, periodo_id: 1, origen_fecha, estado: 'pendiente' });

beforeEach(() => {
  jest.clearAllMocks();
  TrabajadoresModel.obtenerPorId.mockResolvedValue({ id: 5, empresa_id: 1, usuario_id: 42 });
  PeriodosModel.obtenerPorId.mockResolvedValue({ id: 1, estado: 'abierto', fecha_inicio: '2026-06-01', fecha_fin: '2026-06-30' });
  RegistrosModel.crear.mockResolvedValue(77);
  RegistrosModel.obtenerPorId.mockResolvedValue({ id: 77 });
  RegistrosModel.sumarOrdinariasEnSemana.mockResolvedValue({ ordinarias: 0, extras: 0 });
  RegistrosModel.actualizar.mockResolvedValue(1);
  CompensatoriosModel.listarPendientesDeTrabajador.mockResolvedValue([]);
  CompensatoriosModel.existeFechaAsignada.mockResolvedValue(false);
  CompensatoriosModel.asignar.mockResolvedValue(1);
});

const crearCompensatorio = () => RegistrosService.crear(1, GESTOR, {
  trabajador_id: 5, periodo_id: 1, fecha: FECHA, tipo_dia: 'compensatorio',
});

describe('crear un registro «compensatorio»', () => {
  test('sin compensatorios pendientes → 422 y no guarda nada', async () => {
    await expect(crearCompensatorio()).rejects.toMatchObject({ statusCode: 422 });
    expect(RegistrosModel.crear).not.toHaveBeenCalled();
    expect(CompensatoriosModel.asignar).not.toHaveBeenCalled();
  });

  test('con un pendiente dentro de la ventana → guarda el día y descuenta ese descanso', async () => {
    CompensatoriosModel.listarPendientesDeTrabajador.mockResolvedValue([pendiente(3, '2026-06-07')]);

    await crearCompensatorio();

    expect(RegistrosModel.crear).toHaveBeenCalledWith(1, expect.objectContaining({ tipo_dia: 'compensatorio', fecha: FECHA }));
    expect(CompensatoriosModel.asignar).toHaveBeenCalledWith(1, 3, { fechaAsignada: FECHA, asignadoPor: GESTOR.sub });
    expect(CompensatoriosModel.marcarTomado).toHaveBeenCalledWith(1, 3);
  });

  test('pendientes que ya vencieron para ese día → 422 explicando la ventana, sin guardar', async () => {
    CompensatoriosModel.listarPendientesDeTrabajador.mockResolvedValue([pendiente(3, '2026-04-05')]); // vence el 3 may
    await expect(crearCompensatorio()).rejects.toMatchObject({
      statusCode: 422,
      message: expect.stringContaining('28 días'),
    });
    expect(RegistrosModel.crear).not.toHaveBeenCalled();
  });

  test('descuenta el más antiguo que sirva: salta el vencido y toma el siguiente', async () => {
    CompensatoriosModel.listarPendientesDeTrabajador.mockResolvedValue([
      pendiente(3, '2026-04-05'), // vencido para el 10 jun
      pendiente(4, '2026-05-24'), // vence el 21 jun → sirve
      pendiente(5, '2026-06-07'),
    ]);

    await crearCompensatorio();

    expect(CompensatoriosModel.asignar).toHaveBeenCalledWith(1, 4, expect.objectContaining({ fechaAsignada: FECHA }));
  });

  test('carrera: el pendiente ya lo tomó otro → 409 y el registro recién creado se borra', async () => {
    CompensatoriosModel.listarPendientesDeTrabajador.mockResolvedValue([pendiente(3, '2026-06-07')]);
    CompensatoriosModel.asignar.mockResolvedValue(0);

    await expect(crearCompensatorio()).rejects.toMatchObject({ statusCode: 409 });
    expect(RegistrosModel.eliminar).toHaveBeenCalledWith(1, 77);
  });

  test('otros tipos de día no consultan compensatorios', async () => {
    await RegistrosService.crear(1, GESTOR, { trabajador_id: 5, periodo_id: 1, fecha: FECHA, tipo_dia: 'descanso' });
    expect(CompensatoriosModel.listarPendientesDeTrabajador).not.toHaveBeenCalled();
  });
});

describe('corregir el tipo de día de un registro', () => {
  const registro = (tipo_dia) => ({
    id: 99, trabajador_id: 5, periodo_id: 1, fecha: FECHA, tipo_dia, hora_entrada: null, hora_salida: null, sesiones: 1,
  });

  test('ordinario → compensatorio sin pendientes: 422 y el registro no cambia', async () => {
    RegistrosModel.obtenerPorId.mockResolvedValue(registro('ordinario'));
    await expect(RegistrosService.corregir(1, GESTOR, 99, { tipo_dia: 'compensatorio' }))
      .rejects.toMatchObject({ statusCode: 422 });
    expect(RegistrosModel.actualizar).not.toHaveBeenCalled();
  });

  test('ordinario → compensatorio con pendiente: actualiza y descuenta', async () => {
    RegistrosModel.obtenerPorId.mockResolvedValue(registro('ordinario'));
    CompensatoriosModel.listarPendientesDeTrabajador.mockResolvedValue([pendiente(3, '2026-06-07')]);

    await RegistrosService.corregir(1, GESTOR, 99, { tipo_dia: 'compensatorio' });

    expect(RegistrosModel.actualizar).toHaveBeenCalledWith(1, 99, expect.objectContaining({ tipo_dia: 'compensatorio' }));
    expect(CompensatoriosModel.asignar).toHaveBeenCalledWith(1, 3, expect.objectContaining({ fechaAsignada: FECHA }));
  });

  test('compensatorio → ordinario: el descanso de ese día vuelve a pendiente', async () => {
    RegistrosModel.obtenerPorId.mockResolvedValue(registro('compensatorio'));
    CompensatoriosModel.obtenerPorFechaAsignada.mockResolvedValue({ id: 3, estado: 'tomado', fecha_asignada: FECHA });

    await RegistrosService.corregir(1, GESTOR, 99, { tipo_dia: 'ordinario' });

    expect(CompensatoriosModel.obtenerPorFechaAsignada).toHaveBeenCalledWith(1, 5, FECHA);
    expect(CompensatoriosModel.liberar).toHaveBeenCalledWith(1, 3);
  });

  test('compensatorio → ordinario sin descanso ligado (marcado antes de esta regla): no falla', async () => {
    RegistrosModel.obtenerPorId.mockResolvedValue(registro('compensatorio'));
    CompensatoriosModel.obtenerPorFechaAsignada.mockResolvedValue(null);

    await expect(RegistrosService.corregir(1, GESTOR, 99, { tipo_dia: 'ordinario' })).resolves.toBeDefined();
    expect(CompensatoriosModel.liberar).not.toHaveBeenCalled();
  });

  test('un día que ya era compensatorio y sigue siéndolo no vuelve a descontar ni libera', async () => {
    RegistrosModel.obtenerPorId.mockResolvedValue(registro('compensatorio'));

    await RegistrosService.corregir(1, GESTOR, 99, { novedad: 'nota' });

    expect(CompensatoriosModel.listarPendientesDeTrabajador).not.toHaveBeenCalled();
    expect(CompensatoriosModel.liberar).not.toHaveBeenCalled();
    expect(CompensatoriosModel.asignar).not.toHaveBeenCalled();
  });
});
