'use strict';

// Caracterización de crear() y corregir() de registros.gestion.service.js ANTES de
// partirlos en funciones más cortas. A diferencia de registrosService.test.js (que
// usa objectContaining), aquí se congela TODO: el payload completo que se guarda,
// los argumentos del compensatorio, la notificación y —sobre todo— el ORDEN en que
// se consulta cada colaborador. Un refactor que cambie cualquiera de las tres cosas
// debe romper estos tests.
jest.mock('../config/database', () => ({ pool: { query: jest.fn().mockResolvedValue([[]]) } }));
jest.mock('../modules/nomina/registros/registros.model');
jest.mock('../modules/nomina/periodos/periodos.model');
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/empresas/empresas.model');
jest.mock('../modules/nomina/compensatorios/compensatorios.service');
jest.mock('../modules/notificaciones/notificaciones.service');

const RegistrosModel = require('../modules/nomina/registros/registros.model');
const PeriodosModel = require('../modules/nomina/periodos/periodos.model');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const EmpresasModel = require('../modules/empresas/empresas.model');
const CompensatoriosService = require('../modules/nomina/compensatorios/compensatorios.service');
const NotificacionesService = require('../modules/notificaciones/notificaciones.service');
const RegistrosService = require('../modules/nomina/registros/registros.service');
const { ROLES } = require('../config/constants');

const GESTOR = { sub: 10, rol: ROLES.JEFE_NOMINA, nombre: 'Laura' };
const PERIODO = { id: 1, estado: 'abierto', fecha_inicio: '2026-06-01', fecha_fin: '2026-06-30' };
const MIERCOLES = '2026-06-10';
const DOMINGO = '2026-06-14';

let log;
/** Cada colaborador anota su nombre y argumentos, en orden, en un único registro. */
const anotar = (mock, nombre, resultado) =>
  mock.mockImplementation(async (...args) => { log.push([nombre, ...args]); return typeof resultado === 'function' ? resultado(...args) : resultado; });

beforeEach(() => {
  jest.resetAllMocks();
  log = [];
  anotar(TrabajadoresModel.obtenerPorId, 'trabajador.obtenerPorId', { id: 5 });
  anotar(TrabajadoresModel.obtenerPorUsuarioId, 'trabajador.obtenerPorUsuarioId', { id: 5 });
  anotar(TrabajadoresModel.obtenerUsuarioId, 'trabajador.obtenerUsuarioId', 77);
  anotar(PeriodosModel.obtenerPorId, 'periodo.obtenerPorId', PERIODO);
  anotar(RegistrosModel.sumarOrdinariasEnSemana, 'registro.sumarOrdinariasEnSemana', { ordinarias: 0, extras: 0 });
  anotar(EmpresasModel.obtenerConfigRecargos, 'empresa.obtenerConfigRecargos', { sumarNocturnasFestivo: true, reglaDomingoHabitual: 'ley' });
  anotar(RegistrosModel.contarFestivosTrabajadosEnMes, 'registro.contarFestivosTrabajadosEnMes', 0);
  anotar(RegistrosModel.crear, 'registro.crear', 77);
  anotar(RegistrosModel.actualizar, 'registro.actualizar', 1);
  anotar(RegistrosModel.obtenerPorId, 'registro.obtenerPorId', { id: 77 });
  anotar(CompensatoriosService.crearSiCorresponde, 'compensatorio.crearSiCorresponde', null);
  anotar(NotificacionesService.notificar, 'notificacion.notificar', undefined);
});

const nombres = () => log.map((l) => l[0]);
const llamada = (nombre) => log.find((l) => l[0] === nombre);

// ── crear ─────────────────────────────────────────────────────────────────────

describe('crear — caracterización', () => {
  const datos = { trabajador_id: 5, periodo_id: 1, fecha: MIERCOLES, hora_entrada: '08:00', hora_salida: '16:00' };

  test('día ordinario: orden de consultas, payload completo y compensatorio', async () => {
    const r = await RegistrosService.crear(1, GESTOR, datos);

    expect(r).toEqual({ id: 77 });
    expect(nombres()).toEqual([
      'trabajador.obtenerPorId',
      'periodo.obtenerPorId',
      'registro.sumarOrdinariasEnSemana',
      'empresa.obtenerConfigRecargos',
      'registro.crear',
      'compensatorio.crearSiCorresponde',
      'registro.obtenerPorId',
    ]);
    expect(llamada('trabajador.obtenerPorId').slice(1)).toEqual([1, 5]);
    expect(llamada('periodo.obtenerPorId').slice(1)).toEqual([1, 1]);
    expect(llamada('registro.sumarOrdinariasEnSemana').slice(1)).toEqual([1, 5, '2026-06-08', MIERCOLES]);
    expect(llamada('empresa.obtenerConfigRecargos').slice(1)).toEqual([1]);
    expect(llamada('registro.crear').slice(1)).toEqual([1, {
      trabajador_id: 5,
      periodo_id: 1,
      fecha: MIERCOLES,
      hora_entrada: '08:00',
      hora_salida: '16:00',
      horas_ordinarias: 7,
      horas_extra_diurnas: 0,
      horas_extra_nocturnas: 0,
      horas_nocturnas: 0,
      horas_festivo: 0,
      es_festivo: 0,
      novedad: null,
      tipo_dia: 'ordinario',
      jornada_continua: false,
      horas_acumuladas_semana: 0,
    }]);
    expect(llamada('compensatorio.crearSiCorresponde').slice(1)).toEqual([1, {
      trabajadorId: 5,
      periodoId: 1,
      fecha: MIERCOLES,
      esFestivo: false,
      registroId: 77,
      clasificacion: 'habitual',
      numeroDiaFestivo: null,
      sumarNocturnasFestivo: true,
      tipoDia: 'ordinario',
    }]);
    expect(llamada('registro.obtenerPorId').slice(1)).toEqual([1, 77]);
  });

  test('con acumulado semanal previo y jornada_continua/novedad/tipo_dia: todo llega al guardado', async () => {
    anotar(RegistrosModel.sumarOrdinariasEnSemana, 'registro.sumarOrdinariasEnSemana', { ordinarias: 38, extras: 0 });
    anotar(EmpresasModel.obtenerConfigRecargos, 'empresa.obtenerConfigRecargos', { sumarNocturnasFestivo: false, reglaDomingoHabitual: 'ley' });

    await RegistrosService.crear(1, GESTOR, { ...datos, jornada_continua: 1, novedad: 'llegó tarde', tipo_dia: 'ordinario' });

    const [, , payload] = llamada('registro.crear');
    expect(payload).toEqual({
      trabajador_id: 5,
      periodo_id: 1,
      fecha: MIERCOLES,
      hora_entrada: '08:00',
      hora_salida: '16:00',
      horas_ordinarias: 4,       // 42 - 38 de cupo semanal, jornada continua: sin almuerzo
      horas_extra_diurnas: 4,
      horas_extra_nocturnas: 0,
      horas_nocturnas: 0,
      horas_festivo: 0,
      es_festivo: 0,
      novedad: 'llegó tarde',
      tipo_dia: 'ordinario',
      jornada_continua: true,
      horas_acumuladas_semana: 38,
    });
    expect(llamada('compensatorio.crearSiCorresponde')[2].sumarNocturnasFestivo).toBe(false);
  });

  test('día sin horario (descanso): guarda null en las horas y tipo_dia se respeta', async () => {
    await RegistrosService.crear(1, GESTOR, { trabajador_id: 5, periodo_id: 1, fecha: MIERCOLES, tipo_dia: 'descanso', hora_entrada: '', hora_salida: '' });

    const [, , payload] = llamada('registro.crear');
    expect(payload).toMatchObject({ hora_entrada: null, hora_salida: null, tipo_dia: 'descanso', horas_ordinarias: 0 });
    expect(llamada('compensatorio.crearSiCorresponde')[2].tipoDia).toBe('descanso');
  });

  test('domingo, 3º del mes (regla ley): consulta festivos del mes, es habitual y marca festivo', async () => {
    anotar(RegistrosModel.contarFestivosTrabajadosEnMes, 'registro.contarFestivosTrabajadosEnMes', 2);

    await RegistrosService.crear(1, GESTOR, { ...datos, fecha: DOMINGO });

    expect(nombres()).toEqual([
      'trabajador.obtenerPorId',
      'periodo.obtenerPorId',
      'registro.sumarOrdinariasEnSemana',
      'empresa.obtenerConfigRecargos',
      'registro.contarFestivosTrabajadosEnMes',
      'registro.crear',
      'compensatorio.crearSiCorresponde',
      'registro.obtenerPorId',
    ]);
    expect(llamada('registro.contarFestivosTrabajadosEnMes').slice(1)).toEqual([1, 5, DOMINGO]);
    expect(llamada('registro.sumarOrdinariasEnSemana').slice(1)).toEqual([1, 5, '2026-06-08', DOMINGO]);
    expect(llamada('registro.crear')[2]).toMatchObject({ es_festivo: 1 });
    expect(llamada('compensatorio.crearSiCorresponde').slice(1)).toEqual([1, {
      trabajadorId: 5, periodoId: 1, fecha: DOMINGO, esFestivo: true, registroId: 77,
      clasificacion: 'habitual', numeroDiaFestivo: 3, sumarNocturnasFestivo: true, tipoDia: 'ordinario',
    }]);
  });

  test('domingo, 1º del mes: ocasional (sin recargo) pero sigue pidiendo compensatorio', async () => {
    await RegistrosService.crear(1, GESTOR, { ...datos, fecha: DOMINGO });

    expect(llamada('registro.crear')[2]).toMatchObject({ es_festivo: 1 });
    expect(llamada('compensatorio.crearSiCorresponde')[2]).toMatchObject({
      esFestivo: true, clasificacion: 'ocasional', numeroDiaFestivo: 1,
    });
  });

  test('trabajador_nomina: ignora el trabajador_id del cuerpo y usa el propio, antes de validar nada más', async () => {
    anotar(TrabajadoresModel.obtenerPorUsuarioId, 'trabajador.obtenerPorUsuarioId', { id: 9 });

    await RegistrosService.crear(1, { sub: 33, rol: ROLES.TRABAJADOR_NOMINA }, { ...datos, trabajador_id: 5 });

    expect(nombres().slice(0, 2)).toEqual(['trabajador.obtenerPorUsuarioId', 'trabajador.obtenerPorId']);
    expect(llamada('trabajador.obtenerPorUsuarioId').slice(1)).toEqual([1, 33]);
    expect(llamada('trabajador.obtenerPorId').slice(1)).toEqual([1, 9]);
    expect(llamada('registro.crear')[2].trabajador_id).toBe(9);
    expect(llamada('compensatorio.crearSiCorresponde')[2].trabajadorId).toBe(9);
  });

  // Cada validación se corta ANTES de las consultas siguientes: se congela hasta dónde llega el log.
  test.each([
    ['sin trabajador_id', { ...datos, trabajador_id: undefined }, 422, []],
    ['salida <= entrada', { ...datos, hora_salida: '08:00' }, 422, ['trabajador.obtenerPorId', 'periodo.obtenerPorId']],
    ['fecha futura', { ...datos, fecha: '2999-01-01' }, 422, ['trabajador.obtenerPorId', 'periodo.obtenerPorId']],
  ])('rechazo: %s → %i', async (_n, d, status, esperado) => {
    PeriodosModel.obtenerPorId.mockImplementation(async (...a) => { log.push(['periodo.obtenerPorId', ...a]); return { ...PERIODO, fecha_fin: '2999-12-31' }; });

    await expect(RegistrosService.crear(1, GESTOR, d)).rejects.toMatchObject({ statusCode: status });
    expect(nombres()).toEqual(esperado);
    expect(RegistrosModel.crear).not.toHaveBeenCalled();
    expect(CompensatoriosService.crearSiCorresponde).not.toHaveBeenCalled();
  });

  test.each([
    ['período inexistente', null, datos, 404],
    ['período cerrado', { ...PERIODO, estado: 'cerrado' }, datos, 409],
    ['fecha fuera del rango del período', PERIODO, { ...datos, fecha: '2026-07-05' }, 422],
  ])('rechazo: %s → %i, sin calcular ni guardar', async (_n, periodo, d, status) => {
    anotar(PeriodosModel.obtenerPorId, 'periodo.obtenerPorId', periodo);

    await expect(RegistrosService.crear(1, GESTOR, d)).rejects.toMatchObject({ statusCode: status });
    expect(nombres()).toEqual(['trabajador.obtenerPorId', 'periodo.obtenerPorId']);
    expect(RegistrosModel.crear).not.toHaveBeenCalled();
  });

  test('trabajador_nomina sin ficha vinculada → 403 y no consulta nada más', async () => {
    anotar(TrabajadoresModel.obtenerPorUsuarioId, 'trabajador.obtenerPorUsuarioId', null);
    await expect(RegistrosService.crear(1, { sub: 33, rol: ROLES.TRABAJADOR_NOMINA }, datos)).rejects.toMatchObject({ statusCode: 403 });
    expect(nombres()).toEqual(['trabajador.obtenerPorUsuarioId']);
  });
});

// ── corregir ──────────────────────────────────────────────────────────────────

describe('corregir — caracterización', () => {
  const registro = (extra = {}) => ({
    id: 99, trabajador_id: 5, periodo_id: 1, fecha: MIERCOLES,
    hora_entrada: '07:00', hora_salida: '17:00', sesiones: 1,
    jornada_continua: 0, tipo_dia: 'ordinario', novedad: 'original', ...extra,
  });
  const dosSesiones = [
    { hora_entrada: '08:00', hora_salida: '12:00' },
    { hora_entrada: '14:00', hora_salida: '16:00' },
  ];

  beforeEach(() => {
    let primera = true;
    RegistrosModel.obtenerPorId.mockImplementation(async (...a) => { log.push(['registro.obtenerPorId', ...a]); return primera ? (primera = false, registro()) : { id: 99, final: true }; });
  });

  test('corrección simple sin cambios ({}): orden, payload completo, compensatorio y aviso', async () => {
    const r = await RegistrosService.corregir(1, GESTOR, 99, {});

    expect(r).toEqual({ id: 99, final: true });
    expect(nombres()).toEqual([
      'registro.obtenerPorId',
      'periodo.obtenerPorId',
      'registro.sumarOrdinariasEnSemana',
      'empresa.obtenerConfigRecargos',
      'registro.actualizar',
      'compensatorio.crearSiCorresponde',
      'trabajador.obtenerUsuarioId',
      'notificacion.notificar',
      'registro.obtenerPorId',
    ]);
    expect(log[0].slice(1)).toEqual([1, 99]);
    expect(llamada('periodo.obtenerPorId').slice(1)).toEqual([1, 1]);
    expect(llamada('registro.sumarOrdinariasEnSemana').slice(1)).toEqual([1, 5, '2026-06-08', MIERCOLES]);
    expect(llamada('registro.actualizar').slice(1)).toEqual([1, 99, {
      hora_entrada: '07:00',
      hora_salida: '17:00',
      horas_ordinarias: 9,
      horas_extra_diurnas: 0,
      horas_extra_nocturnas: 0,
      horas_nocturnas: 0,
      horas_festivo: 0,
      es_festivo: 0,
      novedad: 'original',
      tipo_dia: 'ordinario',
      aprobado_por: 10,
      jornada_continua: false,
      horas_acumuladas_semana: 0,
    }]);
    expect(llamada('compensatorio.crearSiCorresponde').slice(1)).toEqual([1, {
      trabajadorId: 5, periodoId: 1, fecha: MIERCOLES, esFestivo: false, registroId: 99,
      clasificacion: 'habitual', numeroDiaFestivo: null, sumarNocturnasFestivo: true, tipoDia: 'ordinario',
    }]);
    expect(llamada('trabajador.obtenerUsuarioId').slice(1)).toEqual([5]);
    expect(llamada('notificacion.notificar').slice(1)).toEqual([{
      empresaId: 1, usuarioId: 77, tipo: 'nomina.correccion', titulo: 'Tu horario fue modificado',
      mensaje: `Tu horario del ${MIERCOLES} fue modificado por Laura.`, data: { registro_id: 99 },
    }]);
  });

  test('con cambios: hora_salida, novedad, tipo_dia y jornada_continua mandan sobre lo persistido', async () => {
    await RegistrosService.corregir(1, { sub: 10, rol: ROLES.JEFE_NOMINA }, 99, {
      hora_salida: '15:00', novedad: null, tipo_dia: 'compensatorio', jornada_continua: true,
    });

    expect(llamada('registro.actualizar')[3]).toEqual({
      hora_entrada: '07:00', hora_salida: '15:00',
      horas_ordinarias: 8, horas_extra_diurnas: 0, horas_extra_nocturnas: 0,
      horas_nocturnas: 0, horas_festivo: 0, es_festivo: 0,
      novedad: null, tipo_dia: 'compensatorio', aprobado_por: 10,
      jornada_continua: true, horas_acumuladas_semana: 0,
    });
    expect(llamada('compensatorio.crearSiCorresponde')[2].tipoDia).toBe('compensatorio');
    // sin nombre de gestor → texto de reemplazo
    expect(llamada('notificacion.notificar')[1].mensaje).toBe(`Tu horario del ${MIERCOLES} fue modificado por tu gestor.`);
  });

  test('preserva jornada_continua persistida si no se envía: no descuenta almuerzo', async () => {
    RegistrosModel.obtenerPorId.mockReset();
    anotar(RegistrosModel.obtenerPorId, 'registro.obtenerPorId', registro({ jornada_continua: 1 }));

    await RegistrosService.corregir(1, GESTOR, 99, {});

    expect(llamada('registro.actualizar')[3]).toMatchObject({ jornada_continua: true, horas_ordinarias: 10 });
  });

  test('ignora una fecha que venga en la petición: todo se calcula con la fecha del registro', async () => {
    await RegistrosService.corregir(1, GESTOR, 99, { fecha: '2026-06-14' });

    expect(llamada('registro.sumarOrdinariasEnSemana').slice(1)).toEqual([1, 5, '2026-06-08', MIERCOLES]);
    expect(nombres()).not.toContain('registro.contarFestivosTrabajadosEnMes');
    expect(llamada('compensatorio.crearSiCorresponde')[2]).toMatchObject({ fecha: MIERCOLES, esFestivo: false });
  });

  test('notificar: false → no busca al usuario del trabajador ni avisa', async () => {
    await RegistrosService.corregir(1, GESTOR, 99, {}, { notificar: false });
    expect(nombres()).not.toContain('trabajador.obtenerUsuarioId');
    expect(nombres()).not.toContain('notificacion.notificar');
    expect(nombres().at(-1)).toBe('registro.obtenerPorId');
  });

  test('trabajador sin usuario → no notifica; si notificar() falla, la corrección no se cae', async () => {
    anotar(TrabajadoresModel.obtenerUsuarioId, 'trabajador.obtenerUsuarioId', null);
    await RegistrosService.corregir(1, GESTOR, 99, {});
    expect(nombres()).not.toContain('notificacion.notificar');

    log.length = 0;
    anotar(RegistrosModel.obtenerPorId, 'registro.obtenerPorId', registro());
    anotar(TrabajadoresModel.obtenerUsuarioId, 'trabajador.obtenerUsuarioId', 77);
    NotificacionesService.notificar.mockRejectedValue(new Error('push caído'));
    await expect(RegistrosService.corregir(1, GESTOR, 99, {})).resolves.toBeDefined();
  });

  test('domingo festivo ocasional: clasifica con los datos del REGISTRO (no de la petición)', async () => {
    RegistrosModel.obtenerPorId.mockReset();
    anotar(RegistrosModel.obtenerPorId, 'registro.obtenerPorId', registro({ fecha: DOMINGO }));
    anotar(RegistrosModel.contarFestivosTrabajadosEnMes, 'registro.contarFestivosTrabajadosEnMes', 0);

    await RegistrosService.corregir(1, GESTOR, 99, { notificar: 'ignorado' });

    expect(llamada('registro.contarFestivosTrabajadosEnMes').slice(1)).toEqual([1, 5, DOMINGO]);
    expect(llamada('registro.actualizar')[3]).toMatchObject({ es_festivo: 1 });
    expect(llamada('compensatorio.crearSiCorresponde')[2]).toMatchObject({
      fecha: DOMINGO, esFestivo: true, clasificacion: 'ocasional', numeroDiaFestivo: 1, registroId: 99,
    });
  });

  test('por sesiones: guarda sesiones_detalle y la primera entrada, y calcula con la lista completa', async () => {
    RegistrosModel.obtenerPorId.mockReset();
    anotar(RegistrosModel.obtenerPorId, 'registro.obtenerPorId', registro({ sesiones: 2, hora_entrada: '14:00', hora_salida: '16:00' }));

    await RegistrosService.corregir(1, GESTOR, 99, { sesiones: dosSesiones });

    expect(llamada('registro.actualizar')[3]).toEqual({
      // validarSesiones normaliza las horas a HH:MM:SS
      sesiones_detalle: [{ hora_entrada: '08:00:00', hora_salida: '12:00:00' }],
      hora_entrada_inicial: '08:00:00',
      hora_entrada: '14:00:00',
      hora_salida: '16:00:00',
      horas_ordinarias: 6,
      horas_extra_diurnas: 0,
      horas_extra_nocturnas: 0,
      horas_nocturnas: 0,
      horas_festivo: 0,
      es_festivo: 0,
      novedad: 'original',
      tipo_dia: 'ordinario',
      aprobado_por: 10,
      jornada_continua: false,
      horas_acumuladas_semana: 0,
    });
  });

  // Cada rechazo se corta antes de tocar cálculo/guardado: se congela hasta dónde llega el log.
  test.each([
    ['registro inexistente', () => null, {}, 404, ['registro.obtenerPorId']],
    ['reingreso sin lista de sesiones', () => registro({ sesiones: 2 }), {}, 422, ['registro.obtenerPorId']],
    ['reingreso con hora_entrada suelta', () => registro({ sesiones: 2 }), { sesiones: dosSesiones, hora_entrada: '09:00' }, 422, ['registro.obtenerPorId']],
    ['sesiones en un día sin reingreso', () => registro(), { sesiones: dosSesiones }, 422, ['registro.obtenerPorId']],
    ['período cerrado', () => registro(), {}, 409, ['registro.obtenerPorId', 'periodo.obtenerPorId']],
    ['entrada igual a salida', () => registro(), { hora_salida: '07:00' }, 422, ['registro.obtenerPorId', 'periodo.obtenerPorId']],
  ])('rechazo: %s → %i', async (nombre, fila, datos, status, esperado) => {
    RegistrosModel.obtenerPorId.mockReset();
    anotar(RegistrosModel.obtenerPorId, 'registro.obtenerPorId', fila);
    if (nombre === 'período cerrado') anotar(PeriodosModel.obtenerPorId, 'periodo.obtenerPorId', { id: 1, estado: 'cerrado' });

    await expect(RegistrosService.corregir(1, GESTOR, 99, datos)).rejects.toMatchObject({ statusCode: status });
    expect(nombres()).toEqual(esperado);
    expect(RegistrosModel.actualizar).not.toHaveBeenCalled();
    expect(CompensatoriosService.crearSiCorresponde).not.toHaveBeenCalled();
  });
});
