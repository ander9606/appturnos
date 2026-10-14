'use strict';

jest.mock('../config/database', () => ({
  pool: { query: jest.fn().mockResolvedValue([[]]) },
}));
jest.mock('../modules/nomina/registros/registros.model');
jest.mock('../modules/nomina/periodos/periodos.model');
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/puntos-marcaje/puntos-marcaje.model');
// Proxy al real por defecto — no afecta hoyISO()/ahoraHHMMSS() en el resto de
// tests; solo se sobreescribe puntualmente con mockReturnValueOnce() donde el
// "ahora" importa (desglose en vivo de un turno abierto).
jest.mock('../utils/fechaColombia', () => ({
  ahoraColombiaSQL: jest.fn(jest.requireActual('../utils/fechaColombia').ahoraColombiaSQL),
}));

const RegistrosModel     = require('../modules/nomina/registros/registros.model');
const PeriodosModel      = require('../modules/nomina/periodos/periodos.model');
const TrabajadoresModel  = require('../modules/trabajadores/trabajadores.model');
const PuntosMarcajeModel = require('../modules/puntos-marcaje/puntos-marcaje.model');
const RegistrosService   = require('../modules/nomina/registros/registros.service');
const { ahoraColombiaSQL } = require('../utils/fechaColombia');
const { ROLES }          = require('../config/constants');

// Usuario gestor estándar para pruebas.
const GESTOR = { sub: 10, rol: ROLES.JEFE_NOMINA };

// ── crear ─────────────────────────────────────────────────────────────────────

describe('RegistrosService.crear', () => {
  beforeEach(() => {
    TrabajadoresModel.obtenerPorId.mockResolvedValue({ id: 5, empresa_id: 1 });
  });

  test('trabajador de otra empresa → AppError 404 y no inserta', async () => {
    TrabajadoresModel.obtenerPorId.mockResolvedValue(null);

    await expect(
      RegistrosService.crear(1, GESTOR, {
        trabajador_id: 5,
        periodo_id: 1,
        fecha: '2026-06-10',
        hora_entrada: '08:00',
        hora_salida: '16:00',
      })
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(TrabajadoresModel.obtenerPorId).toHaveBeenCalledWith(1, 5);
    expect(RegistrosModel.crear).not.toHaveBeenCalled();
  });

  test('período no encontrado → AppError 404', async () => {
    PeriodosModel.obtenerPorId.mockResolvedValue(null);

    await expect(
      RegistrosService.crear(1, GESTOR, {
        trabajador_id: 5,
        periodo_id: 99,
        fecha: '2026-06-10',
        hora_entrada: '08:00',
        hora_salida: '16:00',
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test('período cerrado → AppError 409', async () => {
    PeriodosModel.obtenerPorId.mockResolvedValue({ id: 1, estado: 'cerrado' });

    await expect(
      RegistrosService.crear(1, GESTOR, {
        trabajador_id: 5,
        periodo_id: 1,
        fecha: '2026-06-10',
        hora_entrada: '08:00',
        hora_salida: '16:00',
      })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  test('fecha fuera del rango del período → AppError 422', async () => {
    PeriodosModel.obtenerPorId.mockResolvedValue({
      id: 1,
      estado: 'abierto',
      fecha_inicio: '2026-06-01',
      fecha_fin: '2026-06-15',
    });

    await expect(
      RegistrosService.crear(1, GESTOR, {
        trabajador_id: 5,
        periodo_id: 1,
        fecha: '2026-06-20', // fuera del rango
        hora_entrada: '08:00',
        hora_salida: '16:00',
      })
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  test('datos válidos → calcula horas y llama RegistrosModel.crear', async () => {
    PeriodosModel.obtenerPorId.mockResolvedValue({
      id: 1,
      estado: 'abierto',
      fecha_inicio: '2026-06-01',
      fecha_fin: '2026-06-30',
    });
    RegistrosModel.crear.mockResolvedValue(77);
    RegistrosModel.obtenerPorId.mockResolvedValue({ id: 77, horas_ordinarias: 8 });
    RegistrosModel.sumarOrdinariasEnSemana.mockResolvedValue({ ordinarias: 0, extras: 0 });

    const result = await RegistrosService.crear(1, GESTOR, {
      trabajador_id: 5,
      periodo_id: 1,
      fecha: '2026-06-10',
      hora_entrada: '08:00',
      hora_salida: '16:00',
    });

    // 8h > umbral de jornada continua (6h) → se descuenta 1h de almuerzo por defecto.
    expect(RegistrosModel.crear).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        horas_ordinarias: 7,
        horas_extra_diurnas: 0,
        jornada_continua: false,
        horas_acumuladas_semana: 0,
      })
    );
    expect(result.id).toBe(77);
  });

  test('jornada_continua: true → no descuenta almuerzo', async () => {
    PeriodosModel.obtenerPorId.mockResolvedValue({
      id: 1,
      estado: 'abierto',
      fecha_inicio: '2026-06-01',
      fecha_fin: '2026-06-30',
    });
    RegistrosModel.crear.mockResolvedValue(78);
    RegistrosModel.obtenerPorId.mockResolvedValue({ id: 78, horas_ordinarias: 8 });
    RegistrosModel.sumarOrdinariasEnSemana.mockResolvedValue({ ordinarias: 0, extras: 0 });

    await RegistrosService.crear(1, GESTOR, {
      trabajador_id: 5,
      periodo_id: 1,
      fecha: '2026-06-10',
      hora_entrada: '08:00',
      hora_salida: '16:00',
      jornada_continua: true,
    });

    expect(RegistrosModel.crear).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        horas_ordinarias: 8,
        jornada_continua: true,
      })
    );
  });

  test('sin trabajador_id en rol gestor → AppError 422', async () => {
    await expect(
      RegistrosService.crear(1, GESTOR, {
        periodo_id: 1,
        fecha: '2026-06-10',
        hora_entrada: '08:00',
        hora_salida: '16:00',
        // trabajador_id omitido
      })
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  // Clasificación ocasional/habitual (Art. 180/181 CST) — 2026-06-07 es domingo.
  describe('domingo trabajado — clasificación ocasional/habitual', () => {
    beforeEach(() => {
      PeriodosModel.obtenerPorId.mockResolvedValue({
        id: 1, estado: 'abierto', fecha_inicio: '2026-06-01', fecha_fin: '2026-06-30',
      });
      RegistrosModel.crear.mockResolvedValue(200);
      RegistrosModel.obtenerPorId.mockResolvedValue({ id: 200 });
      RegistrosModel.sumarOrdinariasEnSemana.mockResolvedValue({ ordinarias: 0, extras: 0 });
    });

    test('1º domingo del mes (ocasional) → horas van a ordinarias, sin recargo', async () => {
      RegistrosModel.contarDomingosTrabajadosEnMes.mockResolvedValue(0); // ningún domingo previo este mes

      await RegistrosService.crear(1, GESTOR, {
        trabajador_id: 5, periodo_id: 1, fecha: '2026-06-07',
        hora_entrada: '08:00', hora_salida: '16:00',
      });

      expect(RegistrosModel.contarDomingosTrabajadosEnMes).toHaveBeenCalledWith(1, 5, '2026-06-07');
      expect(RegistrosModel.crear).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ horas_ordinarias: 7, horas_festivo: 0, es_festivo: 1 })
      );
    });

    test('3er domingo del mes (habitual) → horas van a horas_festivo, con recargo', async () => {
      RegistrosModel.contarDomingosTrabajadosEnMes.mockResolvedValue(2); // ya trabajó 2 domingos antes este mes

      await RegistrosService.crear(1, GESTOR, {
        trabajador_id: 5, periodo_id: 1, fecha: '2026-06-07',
        hora_entrada: '08:00', hora_salida: '16:00',
      });

      expect(RegistrosModel.crear).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ horas_ordinarias: 0, horas_festivo: 7, es_festivo: 1 })
      );
    });

    test('martes normal → nunca cuenta domingos ni toca la clasificación', async () => {
      await RegistrosService.crear(1, GESTOR, {
        trabajador_id: 5, periodo_id: 1, fecha: '2026-06-09', // martes
        hora_entrada: '08:00', hora_salida: '16:00',
      });

      expect(RegistrosModel.contarDomingosTrabajadosEnMes).not.toHaveBeenCalled();
      expect(RegistrosModel.crear).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ horas_ordinarias: 7, horas_festivo: 0, es_festivo: 0 })
      );
    });
  });
});

// ── corregir ──────────────────────────────────────────────────────────────────

describe('RegistrosService.corregir', () => {
  test('usa el acumulado semanal, no solo el día — evita subpagar horas extra', async () => {
    RegistrosModel.obtenerPorId.mockResolvedValue({
      id: 99,
      trabajador_id: 5,
      periodo_id: 1,
      fecha: '2026-06-12',
      hora_entrada: '07:00',
      hora_salida: '17:00', // 10 h
      sesiones: 1,
    });
    PeriodosModel.obtenerPorId.mockResolvedValue({ id: 1, estado: 'abierto' });
    // Ya trabajó 34h ordinarias esta semana → solo quedan 8h de cupo ordinario.
    RegistrosModel.sumarOrdinariasEnSemana.mockResolvedValue({ ordinarias: 34, extras: 0 });
    RegistrosModel.actualizar.mockResolvedValue(1);

    await RegistrosService.corregir(1, GESTOR, 99, {});

    // 10h > umbral de jornada continua (6h) → 1h de almuerzo se descuenta antes
    // de repartir ordinarias/extra, dejando 9h efectivas (8 ordinarias + 1 extra).
    expect(RegistrosModel.actualizar).toHaveBeenCalledWith(
      1,
      99,
      expect.objectContaining({
        horas_ordinarias: 8,
        horas_extra_diurnas: 1,
        jornada_continua: false,
        horas_acumuladas_semana: 34,
      })
    );
  });

  test('preserva jornada_continua ya persistida si la corrección no la envía', async () => {
    RegistrosModel.obtenerPorId.mockResolvedValue({
      id: 99,
      trabajador_id: 5,
      periodo_id: 1,
      fecha: '2026-06-12',
      hora_entrada: '07:00',
      hora_salida: '17:00',
      sesiones: 1,
      jornada_continua: 1,
    });
    PeriodosModel.obtenerPorId.mockResolvedValue({ id: 1, estado: 'abierto' });
    RegistrosModel.sumarOrdinariasEnSemana.mockResolvedValue({ ordinarias: 0, extras: 0 });
    RegistrosModel.actualizar.mockResolvedValue(1);

    await RegistrosService.corregir(1, GESTOR, 99, {});

    expect(RegistrosModel.actualizar).toHaveBeenCalledWith(
      1,
      99,
      expect.objectContaining({
        horas_ordinarias: 10, // sin descuento: jornada_continua persistida = true
        jornada_continua: true,
      })
    );
  });
});

// ── marcarSalida ──────────────────────────────────────────────────────────────

describe('RegistrosService.marcarSalida', () => {
  const TRABAJADOR_USUARIO = { sub: 20, rol: ROLES.TRABAJADOR_NOMINA };

  beforeEach(() => {
    TrabajadoresModel.obtenerPorUsuarioId.mockResolvedValue({ id: 5, usuario_id: 20 });
    TrabajadoresModel.obtenerPorId.mockResolvedValue({ id: 5, usuario_id: 20, tipo_marcacion: 'libre' });
    RegistrosModel.sumarOrdinariasEnSemana.mockResolvedValue({ ordinarias: 0, extras: 0 });
  });

  test('registro no encontrado → AppError 404', async () => {
    RegistrosModel.obtenerPorId.mockResolvedValue(null);

    await expect(
      RegistrosService.marcarSalida(1, TRABAJADOR_USUARIO, 999)
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test('registro de otro trabajador → AppError 403', async () => {
    RegistrosModel.obtenerPorId.mockResolvedValue({
      id: 1,
      trabajador_id: 99, // distinto al trabajador del usuario (5)
      hora_entrada: '08:00',
      hora_salida: null,
    });
    // El trabajador al que pertenece este registro (id 99) es de OTRO usuario.
    TrabajadoresModel.obtenerPorId.mockResolvedValue({ id: 99, usuario_id: 999 });

    await expect(
      RegistrosService.marcarSalida(1, TRABAJADOR_USUARIO, 1)
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test('sin hora_entrada registrada → AppError 409', async () => {
    RegistrosModel.obtenerPorId.mockResolvedValue({
      id: 1,
      trabajador_id: 5,
      hora_entrada: null,
      hora_salida: null,
    });

    await expect(
      RegistrosService.marcarSalida(1, TRABAJADOR_USUARIO, 1)
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  test('ya tiene hora_salida → AppError 409', async () => {
    RegistrosModel.obtenerPorId.mockResolvedValue({
      id: 1,
      trabajador_id: 5,
      hora_entrada: '08:00',
      hora_salida: '16:00', // ya salió
    });

    await expect(
      RegistrosService.marcarSalida(1, TRABAJADOR_USUARIO, 1)
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  test('período cerrado → AppError 409', async () => {
    RegistrosModel.obtenerPorId.mockResolvedValue({
      id: 1,
      trabajador_id: 5,
      hora_entrada: '08:00',
      hora_salida: null,
      periodo_id: 3,
      fecha: '2026-06-10',
    });
    PeriodosModel.obtenerPorId.mockResolvedValue({ id: 3, estado: 'cerrado' });

    await expect(
      RegistrosService.marcarSalida(1, TRABAJADOR_USUARIO, 1)
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  test('salida exitosa → llama actualizarSalida con horas calculadas', async () => {
    RegistrosModel.obtenerPorId
      .mockResolvedValueOnce({
        id: 1,
        trabajador_id: 5,
        hora_entrada: '08:00',
        hora_salida: null,
        periodo_id: 3,
        fecha: '2026-06-10',
      })
      .mockResolvedValueOnce({ id: 1, hora_salida: '16:00' });
    PeriodosModel.obtenerPorId.mockResolvedValue({ id: 3, estado: 'abierto' });
    RegistrosModel.actualizarSalida.mockResolvedValue(1); // affectedRows

    const result = await RegistrosService.marcarSalida(1, TRABAJADOR_USUARIO, 1);

    expect(RegistrosModel.actualizarSalida).toHaveBeenCalledWith(
      1, 1,
      expect.objectContaining({ horas_ordinarias: expect.any(Number), horas_acumuladas_semana: 0 })
    );
    expect(result.id).toBe(1);
    expect(result).toHaveProperty('advertencia'); // null o string
  });
});

// ── listar (desglose en vivo de un turno abierto) ─────────────────────────────

describe('RegistrosService.listar — desglose en vivo', () => {
  const GESTOR_LISTAR = { sub: 10, rol: ROLES.JEFE_NOMINA };

  test('registro cerrado se devuelve sin recalcular', async () => {
    const cerrado = {
      id: 1, trabajador_id: 5, fecha: '2026-06-10',
      hora_entrada: '08:00:00', hora_salida: '16:00:00',
      horas_ordinarias: 7, horas_nocturnas: 0, horas_extra_diurnas: 0,
      horas_extra_nocturnas: 0, horas_festivo: 0, es_festivo: 0, sesiones: 1,
    };
    RegistrosModel.listar.mockResolvedValue({ data: [cerrado], total: 1 });

    const { data } = await RegistrosService.listar(1, GESTOR_LISTAR, { page: 1, limit: 20 });

    expect(data[0]).toEqual(cerrado); // intacto, sin en_vivo
    expect(RegistrosModel.sumarOrdinariasEnSemana).not.toHaveBeenCalled();
  });

  test('turno abierto (sin hora_salida) devuelve horas en vivo con en_vivo:true', async () => {
    const abierto = {
      id: 2, trabajador_id: 5, fecha: '2026-06-10', // miércoles, no festivo
      hora_entrada: '08:00:00', hora_salida: null,
      horas_ordinarias: 0, horas_nocturnas: 0, horas_extra_diurnas: 0,
      horas_extra_nocturnas: 0, horas_festivo: 0, es_festivo: 0, sesiones: 1,
      jornada_continua: 0,
    };
    RegistrosModel.listar.mockResolvedValue({ data: [abierto], total: 1 });
    RegistrosModel.sumarOrdinariasEnSemana.mockResolvedValue({ ordinarias: 0, extras: 0 });
    ahoraColombiaSQL.mockReturnValueOnce('2026-06-10 12:00:00'); // 4h después de entrar, sin almuerzo (< 6h)

    const { data } = await RegistrosService.listar(1, GESTOR_LISTAR, { page: 1, limit: 20 });

    expect(data[0]).toMatchObject({
      en_vivo: true,
      horas_ordinarias: 4,
      horas_extra_diurnas: 0,
      horas_nocturnas: 0,
    });
  });
});

// ── validarGeofence (via marcarEntrada con tipo_marcacion fijo) ───────────────

describe('Validación de geofence en marcaje', () => {
  const TRABAJADOR_USUARIO = { sub: 20, rol: ROLES.TRABAJADOR_NOMINA };

  test('tipo_marcacion fijo sin coordenadas → AppError 422', async () => {
    TrabajadoresModel.obtenerPorUsuarioId.mockResolvedValue({ id: 5 });
    TrabajadoresModel.obtenerPorId.mockResolvedValue({
      id: 5,
      tipo_marcacion: 'fijo',
      punto_marcaje_id: 1,
    });

    // El service llama validarGeofence antes de consultar el período.
    await expect(
      RegistrosService.marcarEntrada(1, TRABAJADOR_USUARIO, {
        // latitud y longitud omitidos
      })
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  test('tipo_marcacion fijo fuera del radio → AppError 422', async () => {
    TrabajadoresModel.obtenerPorUsuarioId.mockResolvedValue({ id: 5 });
    TrabajadoresModel.obtenerPorId.mockResolvedValue({
      id: 5,
      tipo_marcacion: 'fijo',
      punto_marcaje_id: 1,
    });
    PuntosMarcajeModel.obtenerPorId.mockResolvedValue({
      latitud: 4.711,
      longitud: -74.072,
      radio_metros: 100,
    });

    // Medellín está a ~242 km de Bogotá.
    await expect(
      RegistrosService.marcarEntrada(1, TRABAJADOR_USUARIO, {
        latitud: 6.244,
        longitud: -75.574,
      })
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});

// ── marcarEntrada: turno que cruza la medianoche ──────────────────────────────

describe('RegistrosService.marcarEntrada — turno que cruza la medianoche', () => {
  const TRABAJADOR_USUARIO = { sub: 20, rol: ROLES.TRABAJADOR_NOMINA };

  // Date.now() es UTC; Colombia es UTC-5. 05:30Z → 00:30 del 14-oct en Bogotá.
  const ahoraBogota = (iso) => jest.spyOn(Date, 'now').mockReturnValue(Date.parse(iso));

  beforeEach(() => {
    TrabajadoresModel.obtenerPorUsuarioId.mockResolvedValue({ id: 5, usuario_id: 20 });
    TrabajadoresModel.obtenerPorId.mockResolvedValue({ id: 5, usuario_id: 20, nombre: 'Ana', apellido: 'P', tipo_marcacion: 'libre' });
    PeriodosModel.obtenerAbiertoPorFecha.mockResolvedValue({ id: 3, estado: 'abierto' });
    RegistrosModel.crearConEntrada.mockResolvedValue(77);
    RegistrosModel.obtenerPorId.mockResolvedValue({ id: 77 });
  });

  afterEach(() => jest.restoreAllMocks());

  // obtenerPorFecha se llama primero por AYER (el guard) y luego por HOY.
  const registrosPorFecha = ({ ayer = null, hoy = null }) =>
    RegistrosModel.obtenerPorFecha.mockImplementation(async (_e, _t, fecha) => (fecha === '2026-10-13' ? ayer : hoy));

  test('el turno de ayer sigue abierto (entró 22:53, ahora 00:30) → 409 y no crea registro nuevo', async () => {
    ahoraBogota('2026-10-14T05:30:00Z');
    registrosPorFecha({ ayer: { id: 9, hora_entrada: '22:53:00', hora_salida: null } });

    await expect(RegistrosService.marcarEntrada(1, TRABAJADOR_USUARIO, {}))
      .rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('22:53') });
    expect(RegistrosModel.crearConEntrada).not.toHaveBeenCalled();
  });

  test('el turno de ayer ya tiene salida → deja ingresar', async () => {
    ahoraBogota('2026-10-14T05:30:00Z');
    registrosPorFecha({ ayer: { id: 9, hora_entrada: '14:00:00', hora_salida: '22:00:00' } });

    await RegistrosService.marcarEntrada(1, TRABAJADOR_USUARIO, {});

    expect(RegistrosModel.crearConEntrada).toHaveBeenCalledTimes(1);
  });

  test('salida olvidada (abierto hace más de 24 h) → no bloquea el nuevo ingreso', async () => {
    // Entró ayer 08:00 y ahora son las 14:00 de hoy: 30 h abierto.
    ahoraBogota('2026-10-14T19:00:00Z');
    registrosPorFecha({ ayer: { id: 9, hora_entrada: '08:00:00', hora_salida: null } });

    await RegistrosService.marcarEntrada(1, TRABAJADOR_USUARIO, {});

    expect(RegistrosModel.crearConEntrada).toHaveBeenCalledTimes(1);
  });

  test('ayer sin registro → ingreso normal', async () => {
    ahoraBogota('2026-10-14T13:00:00Z');
    registrosPorFecha({});

    await RegistrosService.marcarEntrada(1, TRABAJADOR_USUARIO, {});

    expect(RegistrosModel.crearConEntrada).toHaveBeenCalledWith(1, expect.objectContaining({ fecha: '2026-10-14' }));
  });
});

// ── marcarSalida: el turno de ayer se cierra pasada la medianoche ─────────────

describe('RegistrosService.marcarSalida — turno que cruza la medianoche', () => {
  test('entró 22:53 el 13 y sale 01:10 del 14 → 2 h 17 min (2.5 h con el redondeo a media hora), en el registro del 13', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-14T06:10:00Z')); // 01:10 Bogotá
    TrabajadoresModel.obtenerPorId.mockResolvedValue({ id: 5, usuario_id: 20, tipo_marcacion: 'libre' });
    RegistrosModel.sumarOrdinariasEnSemana.mockResolvedValue({ ordinarias: 0, extras: 0 });
    RegistrosModel.obtenerPorId
      .mockResolvedValueOnce({ id: 9, trabajador_id: 5, hora_entrada: '22:53:00', hora_salida: null, periodo_id: 3, fecha: '2026-10-13', sesiones: 1 })
      .mockResolvedValueOnce({ id: 9 });
    PeriodosModel.obtenerPorId.mockResolvedValue({ id: 3, estado: 'abierto' });
    RegistrosModel.actualizarSalida.mockResolvedValue(1);

    await RegistrosService.marcarSalida(1, { sub: 20, rol: ROLES.TRABAJADOR_NOMINA }, 9, {});

    const horas = RegistrosModel.actualizarSalida.mock.calls[0][2];
    expect(horas.hora_salida).toBe('01:10:00');
    const total = horas.horas_ordinarias + horas.horas_extra_diurnas + horas.horas_extra_nocturnas + horas.horas_nocturnas + horas.horas_festivo;
    // 137 min, todos nocturnos; cada tipo de hora se redondea a la media hora (redondearMediaHora).
    expect(total).toBe(2.5);
    expect(horas.horas_nocturnas).toBe(2.5);
    jest.restoreAllMocks();
  });
});
