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

  // Clasificación ocasional/habitual (Art. 180/181 CST, extendida por decisión de
  // producto a festivos entre semana — domingo y festivo cuentan para el MISMO
  // umbral mensual). 2026-06-07 es domingo; 2026-10-12 es festivo (Ley Emiliani,
  // cae lunes ese año) — ninguna de las dos fechas depende de un mock de calendario,
  // son las funciones reales de laboralUtils.
  describe('domingo/festivo trabajado — clasificación ocasional/habitual', () => {
    beforeEach(() => {
      PeriodosModel.obtenerPorId.mockResolvedValue({
        id: 1, estado: 'abierto', fecha_inicio: '2026-06-01', fecha_fin: '2026-06-30',
      });
      RegistrosModel.crear.mockResolvedValue(200);
      RegistrosModel.obtenerPorId.mockResolvedValue({ id: 200 });
      RegistrosModel.sumarOrdinariasEnSemana.mockResolvedValue({ ordinarias: 0, extras: 0 });
    });

    test('1º domingo del mes (ocasional) → horas van a ordinarias, sin recargo', async () => {
      RegistrosModel.contarFestivosTrabajadosEnMes.mockResolvedValue(0); // ningún domingo/festivo previo este mes

      await RegistrosService.crear(1, GESTOR, {
        trabajador_id: 5, periodo_id: 1, fecha: '2026-06-07',
        hora_entrada: '08:00', hora_salida: '16:00',
      });

      expect(RegistrosModel.contarFestivosTrabajadosEnMes).toHaveBeenCalledWith(1, 5, '2026-06-07');
      expect(RegistrosModel.crear).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ horas_ordinarias: 7, horas_festivo: 0, es_festivo: 1 })
      );
    });

    test('3er domingo del mes (habitual) → horas van a horas_festivo, con recargo', async () => {
      RegistrosModel.contarFestivosTrabajadosEnMes.mockResolvedValue(2); // ya trabajó 2 domingos/festivos antes este mes

      await RegistrosService.crear(1, GESTOR, {
        trabajador_id: 5, periodo_id: 1, fecha: '2026-06-07',
        hora_entrada: '08:00', hora_salida: '16:00',
      });

      expect(RegistrosModel.crear).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ horas_ordinarias: 0, horas_festivo: 7, es_festivo: 1 })
      );
    });

    test('1er festivo entre semana del mes (sin domingos previos) → ocasional, sin recargo', async () => {
      PeriodosModel.obtenerPorId.mockResolvedValue({
        id: 1, estado: 'abierto', fecha_inicio: '2026-10-01', fecha_fin: '2026-10-31',
      });
      RegistrosModel.contarFestivosTrabajadosEnMes.mockResolvedValue(0);

      await RegistrosService.crear(1, GESTOR, {
        trabajador_id: 5, periodo_id: 1, fecha: '2026-10-12', // lunes festivo (Ley Emiliani)
        hora_entrada: '08:00', hora_salida: '16:00',
      });

      expect(RegistrosModel.crear).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ horas_ordinarias: 7, horas_festivo: 0, es_festivo: 1 })
      );
    });

    test('festivo entre semana que ya es el 3er día festivo/domingo del mes (2 domingos ya trabajados) → con recargo', async () => {
      PeriodosModel.obtenerPorId.mockResolvedValue({
        id: 1, estado: 'abierto', fecha_inicio: '2026-10-01', fecha_fin: '2026-10-31',
      });
      RegistrosModel.contarFestivosTrabajadosEnMes.mockResolvedValue(2); // 2 domingos ya trabajados este mes

      await RegistrosService.crear(1, GESTOR, {
        trabajador_id: 5, periodo_id: 1, fecha: '2026-10-12', // este festivo ya es el 3º del mes
        hora_entrada: '08:00', hora_salida: '16:00',
      });

      expect(RegistrosModel.crear).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ horas_ordinarias: 0, horas_festivo: 7, es_festivo: 1 })
      );
    });

    test('martes normal → nunca cuenta domingos/festivos ni toca la clasificación', async () => {
      await RegistrosService.crear(1, GESTOR, {
        trabajador_id: 5, periodo_id: 1, fecha: '2026-06-09', // martes
        hora_entrada: '08:00', hora_salida: '16:00',
      });

      expect(RegistrosModel.contarFestivosTrabajadosEnMes).not.toHaveBeenCalled();
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

// ── corregir: día con reingreso (por sesiones) ───────────────────────────────

describe('RegistrosService.corregir — día con reingreso', () => {
  // Martes 2026-06-09: sesión 1 08–12, sesión 2 14–16 (hoy ya cerrada).
  const registroConReingreso = (extra = {}) => ({
    id: 99, trabajador_id: 5, periodo_id: 1, fecha: '2026-06-09',
    hora_entrada: '14:00:00', hora_salida: '16:00:00',
    sesiones: 2, sesiones_detalle: [{ hora_entrada: '08:00:00', hora_salida: '12:00:00' }],
    jornada_continua: 0, novedad: null, tipo_dia: 'ordinario',
    ...extra,
  });
  const s = (hora_entrada, hora_salida) => ({ hora_entrada, hora_salida });

  beforeEach(() => {
    RegistrosModel.obtenerPorId.mockResolvedValue(registroConReingreso());
    PeriodosModel.obtenerPorId.mockResolvedValue({ id: 1, estado: 'abierto' });
    RegistrosModel.sumarOrdinariasEnSemana.mockResolvedValue({ ordinarias: 0, extras: 0 });
    RegistrosModel.actualizar.mockResolvedValue(1);
  });

  test('corrige la sesión 1 (08–12 → 07–12): recalcula el día completo y reescribe las sesiones', async () => {
    await RegistrosService.corregir(1, GESTOR, 99, { sesiones: [s('07:00', '12:00'), s('14:00', '16:00')] });

    expect(RegistrosModel.actualizar).toHaveBeenCalledWith(
      1, 99,
      expect.objectContaining({
        // La sesión vigente (la última) sigue en hora_entrada/hora_salida; las cerradas, en el detalle.
        hora_entrada: '14:00:00',
        hora_salida: '16:00:00',
        sesiones_detalle: [s('07:00:00', '12:00:00')],
        hora_entrada_inicial: '07:00:00',
        // 5 h + 2 h = 7 h ordinarias (el almuerzo solo se descuenta en una sesión de más de 6 h).
        horas_ordinarias: 7,
        aprobado_por: GESTOR.sub,
      })
    );
  });

  test('corrige la sesión vigente (la última): se refleja en hora_entrada/hora_salida', async () => {
    await RegistrosService.corregir(1, GESTOR, 99, { sesiones: [s('08:00', '12:00'), s('14:00', '18:00')] });

    expect(RegistrosModel.actualizar).toHaveBeenCalledWith(
      1, 99,
      expect.objectContaining({
        hora_salida: '18:00:00',
        sesiones_detalle: [s('08:00:00', '12:00:00')],
        horas_ordinarias: 8,
      })
    );
  });

  test('el tope semanal se reparte entre sesiones al recalcular', async () => {
    RegistrosModel.sumarOrdinariasEnSemana.mockResolvedValue({ ordinarias: 40, extras: 0 });

    await RegistrosService.corregir(1, GESTOR, 99, { sesiones: [s('08:00', '12:00'), s('14:00', '16:00')] });

    expect(RegistrosModel.actualizar).toHaveBeenCalledWith(
      1, 99,
      expect.objectContaining({ horas_ordinarias: 2, horas_extra_diurnas: 4, horas_acumuladas_semana: 40 })
    );
  });

  test('conserva la novedad ya guardada si no se envía', async () => {
    RegistrosModel.obtenerPorId.mockResolvedValue(registroConReingreso({ novedad: 'Reingreso aprobado' }));

    await RegistrosService.corregir(1, GESTOR, 99, { sesiones: [s('08:00', '12:00'), s('14:00', '16:00')] });

    expect(RegistrosModel.actualizar).toHaveBeenCalledWith(1, 99, expect.objectContaining({ novedad: 'Reingreso aprobado' }));
  });

  test('sin "sesiones" → 422 y no modifica nada', async () => {
    await expect(RegistrosService.corregir(1, GESTOR, 99, { novedad: 'x' }))
      .rejects.toMatchObject({ statusCode: 422, message: expect.stringContaining('todas sus sesiones') });
    expect(RegistrosModel.actualizar).not.toHaveBeenCalled();
  });

  test('con hora_entrada/hora_salida sueltas → 422 (se perderían las otras sesiones)', async () => {
    await expect(RegistrosService.corregir(1, GESTOR, 99, { hora_salida: '18:00', sesiones: [s('08:00', '12:00'), s('14:00', '16:00')] }))
      .rejects.toMatchObject({ statusCode: 422 });
    expect(RegistrosModel.actualizar).not.toHaveBeenCalled();
  });

  test('cantidad de sesiones distinta → 422', async () => {
    await expect(RegistrosService.corregir(1, GESTOR, 99, { sesiones: [s('08:00', '16:00')] }))
      .rejects.toMatchObject({ statusCode: 422 });
    expect(RegistrosModel.actualizar).not.toHaveBeenCalled();
  });

  test('sesiones solapadas → 422', async () => {
    await expect(RegistrosService.corregir(1, GESTOR, 99, { sesiones: [s('08:00', '12:00'), s('07:00', '09:00')] }))
      .rejects.toMatchObject({ statusCode: 422 });
    expect(RegistrosModel.actualizar).not.toHaveBeenCalled();
  });

  test('período cerrado → 409', async () => {
    PeriodosModel.obtenerPorId.mockResolvedValue({ id: 1, estado: 'cerrado' });

    await expect(RegistrosService.corregir(1, GESTOR, 99, { sesiones: [s('08:00', '12:00'), s('14:00', '16:00')] }))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(RegistrosModel.actualizar).not.toHaveBeenCalled();
  });

  test('reingreso todavía abierto: corrige la sesión cerrada y deja la vigente abierta', async () => {
    RegistrosModel.obtenerPorId.mockResolvedValue(registroConReingreso({ hora_salida: null }));

    await RegistrosService.corregir(1, GESTOR, 99, { sesiones: [s('07:00', '12:00'), { hora_entrada: '14:00', hora_salida: null }] });

    expect(RegistrosModel.actualizar).toHaveBeenCalledWith(
      1, 99,
      expect.objectContaining({ hora_salida: null, sesiones_detalle: [s('07:00:00', '12:00:00')], horas_ordinarias: 5 })
    );
  });

  test('reingreso sin salida (olvidó marcar): el gestor le pone la salida y se calculan sus horas', async () => {
    // El caso real: sesión 2 entró 22:53 y nunca marcó salida.
    RegistrosModel.obtenerPorId.mockResolvedValue(
      registroConReingreso({ hora_entrada: '22:53:00', hora_salida: null, sesiones_detalle: [s('08:00:00', '12:00:00')] }),
    );

    await RegistrosService.corregir(1, GESTOR, 99, { sesiones: [s('08:00', '12:00'), s('22:53', '01:10')] });

    expect(RegistrosModel.actualizar).toHaveBeenCalledWith(
      1, 99,
      expect.objectContaining({
        hora_entrada: '22:53:00',
        hora_salida: '01:10:00', // el registro queda cerrado
        sesiones_detalle: [s('08:00:00', '12:00:00')],
        // 4 h ordinarias de la sesión 1 + 137 min nocturnos de la 2 (2.5 h con el redondeo a media hora).
        horas_ordinarias: 4,
        horas_nocturnas: 2.5,
      })
    );
  });

  test('un día de una sola sesión sigue corrigiéndose como siempre y no acepta "sesiones"', async () => {
    RegistrosModel.obtenerPorId.mockResolvedValue({
      id: 98, trabajador_id: 5, periodo_id: 1, fecha: '2026-06-09', hora_entrada: '08:00', hora_salida: '12:00', sesiones: 1,
    });

    await expect(RegistrosService.corregir(1, GESTOR, 98, { sesiones: [s('08:00', '12:00'), s('14:00', '16:00')] }))
      .rejects.toMatchObject({ statusCode: 422 });

    await RegistrosService.corregir(1, GESTOR, 98, { hora_salida: '13:00' });
    const campos = RegistrosModel.actualizar.mock.calls[0][2];
    expect(campos).not.toHaveProperty('sesiones_detalle');
    expect(campos.hora_salida).toBe('13:00');
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

// ── reprocesarPeriodoAbierto ───────────────────────────────────────────────────

describe('RegistrosService.reprocesarPeriodoAbierto', () => {
  const ADMIN = { sub: 1, rol: ROLES.ADMIN_EMPRESA };

  // Lunes, cerrado, una sola sesión: se reprocesa.
  const REG_T5_LUNES = {
    id: 101, trabajador_id: 5, periodo_id: 1, fecha: '2026-06-08',
    hora_entrada: '08:00:00', hora_salida: '17:00:00', sesiones: 1,
    tipo_dia: 'ordinario', novedad: null, jornada_continua: 0,
  };
  // Martes, en curso (sin salida): nada cerrado que reclasificar todavía — se salta.
  const REG_T5_MARTES_ABIERTO = {
    id: 102, trabajador_id: 5, periodo_id: 1, fecha: '2026-06-09',
    hora_entrada: '08:00:00', hora_salida: null, sesiones: 1,
    tipo_dia: 'ordinario', novedad: null, jornada_continua: 0,
  };
  // Reingreso cerrado: se reconstruye `sesiones` (detalle + la vigente).
  const REG_T7_REINGRESO = {
    id: 103, trabajador_id: 7, periodo_id: 1, fecha: '2026-06-08',
    hora_entrada: '14:00:00', hora_salida: '16:00:00', sesiones: 2,
    sesiones_detalle: [{ hora_entrada: '08:00:00', hora_salida: '12:00:00' }],
    tipo_dia: 'ordinario', novedad: null, jornada_continua: 0,
  };
  // Descanso sin horario: nada que clasificar — se salta.
  const REG_T7_DESCANSO = {
    id: 104, trabajador_id: 7, periodo_id: 1, fecha: '2026-06-10',
    hora_entrada: null, hora_salida: null, sesiones: 1,
    tipo_dia: 'descanso', novedad: null, jornada_continua: 0,
  };

  beforeEach(() => {
    PeriodosModel.obtenerAbiertoPorFecha.mockResolvedValue({ id: 1, estado: 'abierto' });
    PeriodosModel.obtenerPorId.mockResolvedValue({ id: 1, estado: 'abierto' });
    RegistrosModel.sumarOrdinariasEnSemana.mockResolvedValue({ ordinarias: 0, extras: 0 });
    RegistrosModel.actualizar.mockResolvedValue(1);
    // listar() devuelve en orden "fecha DESC" a propósito — prueba que se reordena cronológicamente.
    RegistrosModel.listar.mockResolvedValue({
      data: [REG_T7_DESCANSO, REG_T7_REINGRESO, REG_T5_MARTES_ABIERTO, REG_T5_LUNES],
      total: 4,
    });
    const porId = { 101: REG_T5_LUNES, 102: REG_T5_MARTES_ABIERTO, 103: REG_T7_REINGRESO, 104: REG_T7_DESCANSO };
    RegistrosModel.obtenerPorId.mockImplementation(async (_empresaId, id) => porId[id]);
  });

  test('reprocesa los días cerrados con horario; salta el que está en curso y el que no tiene horario', async () => {
    const res = await RegistrosService.reprocesarPeriodoAbierto(1, ADMIN);

    expect(res).toEqual({ periodo_id: 1, registros_actualizados: 2 });
    const idsCorregidos = RegistrosModel.actualizar.mock.calls.map(([, id]) => id).sort();
    expect(idsCorregidos).toEqual([101, 103]);
  });

  test('reconstruye "sesiones" para un día con reingreso (sesiones_detalle + la vigente)', async () => {
    await RegistrosService.reprocesarPeriodoAbierto(1, ADMIN);

    const llamadaT7 = RegistrosModel.actualizar.mock.calls.find(([, id]) => id === 103);
    expect(llamadaT7[2].sesiones_detalle).toEqual([{ hora_entrada: '08:00:00', hora_salida: '12:00:00' }]);
    expect(llamadaT7[2].hora_entrada).toBe('14:00:00');
    expect(llamadaT7[2].hora_salida).toBe('16:00:00');
  });

  test('un aviso por trabajador afectado, no uno por día tocado', async () => {
    await RegistrosService.reprocesarPeriodoAbierto(1, ADMIN);

    expect(TrabajadoresModel.obtenerUsuarioId).toHaveBeenCalledTimes(2);
    expect(TrabajadoresModel.obtenerUsuarioId).toHaveBeenCalledWith(5);
    expect(TrabajadoresModel.obtenerUsuarioId).toHaveBeenCalledWith(7);
  });

  test('sin período abierto → 404 y no toca nada', async () => {
    PeriodosModel.obtenerAbiertoPorFecha.mockResolvedValue(null);

    await expect(RegistrosService.reprocesarPeriodoAbierto(1, ADMIN)).rejects.toMatchObject({ statusCode: 404 });
    expect(RegistrosModel.actualizar).not.toHaveBeenCalled();
  });
});

// ── rellenarDiasVaciosComoDescanso ────────────────────────────────────────────

describe('RegistrosService.rellenarDiasVaciosComoDescanso', () => {
  const PERIODO = { id: 1, fecha_inicio: '2026-06-01', fecha_fin: '2026-06-03' };

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-07-01T05:00:00Z')); // muy después del período
    RegistrosModel.crear.mockResolvedValue(999);
  });
  afterEach(() => jest.restoreAllMocks());

  test('sin trabajadores activos de nómina → no crea nada', async () => {
    TrabajadoresModel.listarActivosNomina.mockResolvedValue([]);

    const res = await RegistrosService.rellenarDiasVaciosComoDescanso(1, PERIODO);

    expect(res).toEqual({ creados: 0 });
    expect(RegistrosModel.listarFechasConRegistro).not.toHaveBeenCalled();
    expect(RegistrosModel.crear).not.toHaveBeenCalled();
  });

  test('rellena solo los días sin registro, como "descanso" sin horario', async () => {
    TrabajadoresModel.listarActivosNomina.mockResolvedValue([5]);
    // El trabajador 5 ya tiene registro el día 2 — debe saltarlo.
    RegistrosModel.listarFechasConRegistro.mockResolvedValue([{ trabajador_id: 5, fecha: '2026-06-02' }]);

    const res = await RegistrosService.rellenarDiasVaciosComoDescanso(1, PERIODO);

    expect(res).toEqual({ creados: 2 }); // días 1 y 3 (el 2 ya tenía registro)
    expect(RegistrosModel.crear).toHaveBeenCalledTimes(2);
    expect(RegistrosModel.crear).toHaveBeenCalledWith(1, expect.objectContaining({
      trabajador_id: 5, periodo_id: 1, fecha: '2026-06-01',
      tipo_dia: 'descanso', hora_entrada: null, hora_salida: null, horas_ordinarias: 0,
    }));
    expect(RegistrosModel.crear).toHaveBeenCalledWith(1, expect.objectContaining({ fecha: '2026-06-03' }));
    expect(RegistrosModel.crear).not.toHaveBeenCalledWith(1, expect.objectContaining({ fecha: '2026-06-02' }));
  });

  test('nunca rellena un día futuro (período cerrado antes de fecha_fin)', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-06-02T05:00:00Z')); // "hoy" = 2026-06-02
    TrabajadoresModel.listarActivosNomina.mockResolvedValue([5]);
    RegistrosModel.listarFechasConRegistro.mockResolvedValue([]);

    const res = await RegistrosService.rellenarDiasVaciosComoDescanso(1, PERIODO);

    expect(res).toEqual({ creados: 2 }); // solo 1 y 2 — el 3 todavía no ha ocurrido
    expect(RegistrosModel.crear).not.toHaveBeenCalledWith(1, expect.objectContaining({ fecha: '2026-06-03' }));
  });

  test('un fallo en un día puntual no detiene el resto (best-effort)', async () => {
    TrabajadoresModel.listarActivosNomina.mockResolvedValue([5]);
    RegistrosModel.listarFechasConRegistro.mockResolvedValue([]);
    RegistrosModel.crear
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue(999);

    const res = await RegistrosService.rellenarDiasVaciosComoDescanso(1, PERIODO);

    expect(res).toEqual({ creados: 2 }); // 3 días intentados, 1 falló, 2 se cuentan
    expect(RegistrosModel.crear).toHaveBeenCalledTimes(3);
  });
});
