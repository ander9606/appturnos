'use strict';

// Caracterización de marcarSalida() (registros.marcaje.service.js) y del cálculo EN VIVO de un
// turno abierto (conHorasEnVivo, usado por obtener() y listar() de registros.gestion.service.js)
// ANTES de unificar el cálculo que ambos repetían. Se congela TODO: payload completo que se
// guarda, argumentos del compensatorio, notificaciones, advertencia de extras, el ORDEN de las
// consultas y —a propósito— EN QUÉ PUNTO se lee el reloj ('reloj' en el log): marcarSalida lo lee
// antes de consultar la configuración de recargos; el cálculo en vivo, después de clasificar el día.
jest.mock('../config/database', () => ({ pool: { query: jest.fn().mockResolvedValue([[]]) } }));
jest.mock('../modules/nomina/registros/registros.model');
jest.mock('../modules/nomina/registros/solicitudes-reingreso.model');
jest.mock('../modules/nomina/periodos/periodos.model');
jest.mock('../modules/nomina/periodos/periodos.service');
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/puntos-marcaje/puntos-marcaje.model');
jest.mock('../modules/empresas/empresas.model');
jest.mock('../modules/nomina/compensatorios/compensatorios.service');
jest.mock('../modules/notificaciones/notificaciones.service');
jest.mock('../modules/notificaciones/notificaciones.model');
jest.mock('../utils/fechaColombia', () => ({ ahoraColombiaSQL: jest.fn() }));

const RegistrosModel = require('../modules/nomina/registros/registros.model');
const PeriodosModel = require('../modules/nomina/periodos/periodos.model');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const EmpresasModel = require('../modules/empresas/empresas.model');
const CompensatoriosService = require('../modules/nomina/compensatorios/compensatorios.service');
const NotificacionesService = require('../modules/notificaciones/notificaciones.service');
const NotificacionesModel = require('../modules/notificaciones/notificaciones.model');
const { ahoraColombiaSQL } = require('../utils/fechaColombia');
const RegistrosService = require('../modules/nomina/registros/registros.service');
const { ROLES } = require('../config/constants');

const EMPLEADO = { sub: 42, rol: ROLES.TRABAJADOR_NOMINA };
// obtener() ahora valida dueño si el rol es trabajador_nomina — un gestor evita esa
// consulta extra y no cambia el orden de consultas que este archivo congela.
const GESTOR = { sub: 1, rol: ROLES.ADMIN_EMPRESA };
const MIERCOLES = '2026-06-10';
const DOMINGO = '2026-06-14';
const AHORA = `${MIERCOLES} 17:00:00`; // reloj de Colombia fijo: la salida es 17:00:00

let log;
const anotar = (mock, nombre, resultado) =>
  mock.mockImplementation(async (...args) => { log.push([nombre, ...args]); return typeof resultado === 'function' ? resultado(...args) : resultado; });

const registroAbierto = (extra = {}) => ({
  id: 99, trabajador_id: 5, periodo_id: 1, fecha: MIERCOLES, hora_entrada: '08:00:00', hora_salida: null,
  sesiones: 1, jornada_continua: 0, horas_ordinarias: 0, horas_extra_diurnas: 0, horas_extra_nocturnas: 0,
  horas_nocturnas: 0, horas_festivo: 0, es_festivo: 0, ...extra,
});

beforeEach(() => {
  jest.resetAllMocks();
  log = [];
  ahoraColombiaSQL.mockImplementation(() => { log.push(['reloj']); return AHORA; });
  anotar(TrabajadoresModel.obtenerPorId, 'trabajador.obtenerPorId', { id: 5, usuario_id: 42, nombre: 'Ana', apellido: 'Pérez', tipo_marcacion: 'libre' });
  anotar(PeriodosModel.obtenerPorId, 'periodo.obtenerPorId', { id: 1, estado: 'abierto' });
  anotar(RegistrosModel.sumarOrdinariasEnSemana, 'registro.sumar', { ordinarias: 0, extras: 0 });
  anotar(EmpresasModel.obtenerConfigRecargos, 'empresa.config', { sumarNocturnasFestivo: true, reglaDomingoHabitual: 'ley' });
  anotar(RegistrosModel.contarFestivosTrabajadosEnMes, 'registro.contarFestivos', 0);
  anotar(RegistrosModel.actualizarSalida, 'registro.actualizarSalida', 1);
  anotar(NotificacionesModel.idsGestoresNomina, 'notificaciones.idsGestores', [501, 502]);
  anotar(NotificacionesService.notificarVarios, 'notificar', undefined);
  anotar(CompensatoriosService.crearSiCorresponde, 'compensatorio', null);
});

const nombres = () => log.map((l) => l[0]);
const llamada = (n) => log.find((l) => l[0] === n);
const conRegistro = (reg, final = { id: 99, final: true }) => {
  let primera = true;
  RegistrosModel.obtenerPorId.mockImplementation(async (...a) => { log.push(['registro.obtenerPorId', ...a]); return primera ? (primera = false, reg) : final; });
};

// ── marcarSalida ─────────────────────────────────────────────────────────────

describe('marcarSalida — caracterización', () => {
  test('día ordinario: orden completo (el reloj se lee ANTES de la configuración de recargos), payload y avisos', async () => {
    conRegistro(registroAbierto());
    const r = await RegistrosService.marcarSalida(1, EMPLEADO, 99, { jornada_continua: false });

    expect(r).toEqual({ id: 99, final: true, advertencia: null });
    expect(nombres()).toEqual([
      'registro.obtenerPorId',
      'trabajador.obtenerPorId',
      'periodo.obtenerPorId',
      'registro.sumar',
      'reloj',
      'empresa.config',
      'registro.actualizarSalida',
      'notificaciones.idsGestores',
      'notificar',
      'compensatorio',
      'registro.obtenerPorId',
    ]);
    expect(llamada('registro.sumar').slice(1)).toEqual([1, 5, '2026-06-08', MIERCOLES]);
    expect(llamada('registro.actualizarSalida').slice(1)).toEqual([1, 99, {
      hora_salida: '17:00:00',
      latitud: undefined,
      longitud: undefined,
      deviceId: undefined,
      horas_ordinarias: 8,
      horas_extra_diurnas: 0,
      horas_extra_nocturnas: 0,
      horas_nocturnas: 0,
      horas_festivo: 0,
      es_festivo: 0,
      total_horas: 8, // sesión 1: viene tal cual de calcularHoras
      jornada_continua: false,
      horas_acumuladas_semana: 0,
    }]);
    expect(llamada('notificar').slice(1)).toEqual([[501, 502], {
      empresaId: 1, tipo: 'nomina.salida', titulo: 'Salida registrada',
      mensaje: 'Ana Pérez marcó salida.', data: { registro_id: 99, trabajador_id: 5 },
    }]);
    expect(llamada('compensatorio').slice(1)).toEqual([1, {
      trabajadorId: 5, periodoId: 1, fecha: MIERCOLES, esFestivo: false, registroId: 99,
      clasificacion: 'habitual', numeroDiaFestivo: null, sumarNocturnasFestivo: true, tipoDia: 'ordinario',
    }]);
  });

  test('con acumulado semanal previo, jornada continua y coordenadas: todo llega a actualizarSalida y a la advertencia', async () => {
    conRegistro(registroAbierto());
    anotar(RegistrosModel.sumarOrdinariasEnSemana, 'registro.sumar', { ordinarias: 40, extras: 11 });
    anotar(EmpresasModel.obtenerConfigRecargos, 'empresa.config', { sumarNocturnasFestivo: false, reglaDomingoHabitual: 'ley' });

    const r = await RegistrosService.marcarSalida(1, EMPLEADO, 99, { latitud: 4.6, longitud: -74.1, device_id: 'dev-1', jornada_continua: 1 });

    expect(llamada('registro.actualizarSalida')[3]).toEqual({
      hora_salida: '17:00:00', latitud: 4.6, longitud: -74.1, deviceId: 'dev-1',
      horas_ordinarias: 2,        // 42 - 40 de cupo semanal; jornada continua: sin almuerzo
      horas_extra_diurnas: 7,
      horas_extra_nocturnas: 0, horas_nocturnas: 0, horas_festivo: 0, es_festivo: 0,
      total_horas: 9,
      jornada_continua: true,
      horas_acumuladas_semana: 40,
    });
    expect(llamada('compensatorio')[2].sumarNocturnasFestivo).toBe(false);
    // extras acumuladas 11 + 7 de hoy = 18 → supera el tope semanal
    expect(r.advertencia).toMatch(/^Superaste el límite de \d+ h extra esta semana \(total: 18\.0 h\)\.$/);
  });

  test('segunda sesión del día: suma los totales de las anteriores y las cuenta en el acumulado base', async () => {
    conRegistro(registroAbierto({ sesiones: 2, hora_entrada: '14:00:00', horas_ordinarias: '4.00', horas_nocturnas: '0.00', horas_extra_diurnas: '0.50', horas_extra_nocturnas: '0.00', horas_festivo: '0.00' }));
    anotar(RegistrosModel.sumarOrdinariasEnSemana, 'registro.sumar', { ordinarias: 36, extras: 0 });

    await RegistrosService.marcarSalida(1, EMPLEADO, 99, {});

    const guardado = llamada('registro.actualizarSalida')[3];
    // base = 36 + 4 (ordinarias de la sesión 1) = 40 → a la sesión de 3 h le caben 2 ordinarias y 1 extra
    expect(guardado).toMatchObject({ horas_ordinarias: 6, horas_extra_diurnas: 1.5, horas_acumuladas_semana: 36 });
    expect(guardado.es_festivo).toBe(0);
    // con sesiones > 1 los totales se arman a mano y NO incluyen total_horas
    expect(guardado).not.toHaveProperty('total_horas');
  });

  test('sesión previa con nocturnas, festivas y es_festivo: cada total se SUMA y es_festivo es el de ESTA sesión', async () => {
    conRegistro(registroAbierto({ sesiones: 2, hora_entrada: '14:00:00', horas_ordinarias: '3.00', horas_nocturnas: '1.00', horas_extra_diurnas: '0.50', horas_extra_nocturnas: '0.25', horas_festivo: '0.75', es_festivo: 1 }));
    anotar(RegistrosModel.sumarOrdinariasEnSemana, 'registro.sumar', { ordinarias: 36, extras: 0 });

    await RegistrosService.marcarSalida(1, EMPLEADO, 99, {});

    // base = 36 + 3 ordinarias + 1 nocturna = 40 → a la sesión de 3 h le caben 2 ordinarias y 1 extra
    expect(llamada('registro.actualizarSalida')[3]).toMatchObject({ horas_ordinarias: 5, horas_extra_diurnas: 1.5, horas_extra_nocturnas: 0.25, horas_nocturnas: 1, horas_festivo: 0.75, es_festivo: 0 });
  });

  test('domingo (3º del mes): consulta festivos antes de calcular y marca festivo + compensatorio habitual', async () => {
    conRegistro(registroAbierto({ fecha: DOMINGO }));
    anotar(RegistrosModel.contarFestivosTrabajadosEnMes, 'registro.contarFestivos', 2);

    await RegistrosService.marcarSalida(1, EMPLEADO, 99, {});

    expect(nombres().slice(3, 7)).toEqual(['registro.sumar', 'reloj', 'empresa.config', 'registro.contarFestivos']);
    expect(llamada('registro.contarFestivos').slice(1)).toEqual([1, 5, DOMINGO]);
    expect(llamada('registro.actualizarSalida')[3]).toMatchObject({ es_festivo: 1 });
    expect(llamada('compensatorio')[2]).toMatchObject({ fecha: DOMINGO, esFestivo: true, clasificacion: 'habitual', numeroDiaFestivo: 3, tipoDia: 'ordinario' });
  });

  test('si el UPDATE no afecta filas (ya marcada en paralelo) → 409 y no avisa ni crea compensatorio', async () => {
    conRegistro(registroAbierto());
    anotar(RegistrosModel.actualizarSalida, 'registro.actualizarSalida', 0);
    await expect(RegistrosService.marcarSalida(1, EMPLEADO, 99, {})).rejects.toMatchObject({ statusCode: 409 });
    expect(nombres()).not.toContain('notificar');
    expect(nombres()).not.toContain('compensatorio');
  });

  test.each([
    ['registro inexistente', null, 404, ['registro.obtenerPorId']],
    ['no es su registro (otro usuario)', registroAbierto(), 403, ['registro.obtenerPorId', 'trabajador.obtenerPorId']],
    ['sin entrada registrada', registroAbierto({ hora_entrada: null }), 409, ['registro.obtenerPorId', 'trabajador.obtenerPorId']],
    ['ya marcó la salida', registroAbierto({ hora_salida: '12:00:00' }), 409, ['registro.obtenerPorId', 'trabajador.obtenerPorId']],
    ['período cerrado', registroAbierto(), 409, ['registro.obtenerPorId', 'trabajador.obtenerPorId', 'periodo.obtenerPorId']],
  ])('rechazo: %s → %i, sin calcular ni guardar', async (nombre, reg, status, esperado) => {
    conRegistro(reg);
    if (nombre.startsWith('no es su registro')) anotar(TrabajadoresModel.obtenerPorId, 'trabajador.obtenerPorId', { id: 5, usuario_id: 7 });
    if (nombre === 'período cerrado') anotar(PeriodosModel.obtenerPorId, 'periodo.obtenerPorId', { id: 1, estado: 'cerrado' });

    await expect(RegistrosService.marcarSalida(1, EMPLEADO, 99, {})).rejects.toMatchObject({ statusCode: status });
    expect(nombres()).toEqual(esperado);
    expect(RegistrosModel.actualizarSalida).not.toHaveBeenCalled();
  });

  test('sin gestores a quienes avisar: no llama a notificarVarios; si notificar falla, la salida igual se registra', async () => {
    conRegistro(registroAbierto());
    anotar(NotificacionesModel.idsGestoresNomina, 'notificaciones.idsGestores', []);
    await RegistrosService.marcarSalida(1, EMPLEADO, 99, {});
    expect(nombres()).not.toContain('notificar');

    log.length = 0;
    conRegistro(registroAbierto());
    anotar(NotificacionesModel.idsGestoresNomina, 'notificaciones.idsGestores', [501]);
    NotificacionesService.notificarVarios.mockRejectedValue(new Error('push caído'));
    await expect(RegistrosService.marcarSalida(1, EMPLEADO, 99, {})).resolves.toBeDefined();
  });
});

// ── Cálculo en vivo (obtener / listar) ───────────────────────────────────────

describe('cálculo en vivo — caracterización', () => {
  test('turno abierto: orden (el reloj se lee DESPUÉS de clasificar el día) y desglose proyectado, marcado en_vivo', async () => {
    const reg = registroAbierto();
    conRegistro(reg);

    const r = await RegistrosService.obtener(1, 99, GESTOR);

    expect(nombres()).toEqual(['registro.obtenerPorId', 'registro.sumar', 'empresa.config', 'reloj']);
    expect(llamada('registro.sumar').slice(1)).toEqual([1, 5, '2026-06-08', MIERCOLES]);
    expect(r).toEqual({
      ...reg, horas_ordinarias: 8, horas_extra_diurnas: 0, horas_extra_nocturnas: 0, horas_nocturnas: 0,
      horas_festivo: 0, es_festivo: 0, total_horas: 8, en_vivo: true,
    });
  });

  test('toma la jornada continua del registro y el acumulado semanal', async () => {
    conRegistro(registroAbierto({ jornada_continua: 1 }));
    anotar(RegistrosModel.sumarOrdinariasEnSemana, 'registro.sumar', { ordinarias: 40, extras: 0 });
    const r = await RegistrosService.obtener(1, 99, GESTOR);
    expect(r).toMatchObject({ horas_ordinarias: 2, horas_extra_diurnas: 7, en_vivo: true });
  });

  test('segunda sesión abierta: suma lo ya guardado y cuenta las ordinarias previas en el acumulado', async () => {
    conRegistro(registroAbierto({ sesiones: 2, hora_entrada: '14:00:00', horas_ordinarias: '4.00', horas_nocturnas: '0.00', horas_extra_diurnas: '0.50', horas_extra_nocturnas: '0.00', horas_festivo: '0.00' }));
    anotar(RegistrosModel.sumarOrdinariasEnSemana, 'registro.sumar', { ordinarias: 36, extras: 0 });
    const r = await RegistrosService.obtener(1, 99, GESTOR);
    expect(r).toMatchObject({ horas_ordinarias: 6, horas_extra_diurnas: 1.5, en_vivo: true });
    expect(r).not.toHaveProperty('total_horas');
  });

  test('sesión previa con nocturnas, festivas y es_festivo: cada total se SUMA y es_festivo es el de ESTA sesión', async () => {
    conRegistro(registroAbierto({ sesiones: 2, hora_entrada: '14:00:00', horas_ordinarias: '3.00', horas_nocturnas: '1.00', horas_extra_diurnas: '0.50', horas_extra_nocturnas: '0.25', horas_festivo: '0.75', es_festivo: 1 }));
    anotar(RegistrosModel.sumarOrdinariasEnSemana, 'registro.sumar', { ordinarias: 36, extras: 0 });
    const r = await RegistrosService.obtener(1, 99, GESTOR);
    expect(r).toMatchObject({ ...{ horas_ordinarias: 5, horas_extra_diurnas: 1.5, horas_extra_nocturnas: 0.25, horas_nocturnas: 1, horas_festivo: 0.75, es_festivo: 0 }, en_vivo: true });
  });

  test('domingo: consulta festivos del mes y el desglose sale como festivo', async () => {
    conRegistro(registroAbierto({ fecha: DOMINGO }));
    anotar(RegistrosModel.contarFestivosTrabajadosEnMes, 'registro.contarFestivos', 2);
    const r = await RegistrosService.obtener(1, 99, GESTOR);
    expect(nombres()).toEqual(['registro.obtenerPorId', 'registro.sumar', 'empresa.config', 'registro.contarFestivos', 'reloj']);
    expect(r.es_festivo).toBe(1);
  });

  test.each([
    ['con salida (cerrado)', registroAbierto({ hora_salida: '16:00:00' })],
    ['sin entrada (sin horario)', registroAbierto({ hora_entrada: null })],
  ])('%s: se devuelve intacto, sin consultar nada más ni leer el reloj', async (_n, reg) => {
    conRegistro(reg);
    await expect(RegistrosService.obtener(1, 99, GESTOR)).resolves.toBe(reg);
    expect(nombres()).toEqual(['registro.obtenerPorId']);
  });

  test('obtener: registro inexistente → 404', async () => {
    conRegistro(null);
    await expect(RegistrosService.obtener(1, 99, GESTOR)).rejects.toMatchObject({ statusCode: 404 });
  });

  test('listar: proyecta en vivo solo los abiertos y deja intactos los cerrados, conservando el orden', async () => {
    const cerrado = registroAbierto({ id: 1, hora_salida: '16:00:00' });
    const abierto = registroAbierto({ id: 2 });
    anotar(RegistrosModel.listar, 'registro.listar', { data: [cerrado, abierto], total: 2 });

    const r = await RegistrosService.listar(1, { rol: ROLES.JEFE_NOMINA }, { page: 1, limit: 20 });

    expect(r.pagination).toEqual({ page: 1, limit: 20, total: 2 });
    expect(r.data[0]).toBe(cerrado);
    expect(r.data[1]).toMatchObject({ id: 2, horas_ordinarias: 8, en_vivo: true });
  });
});
