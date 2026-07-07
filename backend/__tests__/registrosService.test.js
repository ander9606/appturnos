'use strict';

jest.mock('../modules/nomina/registros/registros.model');
jest.mock('../modules/nomina/periodos/periodos.model');
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/puntos-marcaje/puntos-marcaje.model');

const RegistrosModel     = require('../modules/nomina/registros/registros.model');
const PeriodosModel      = require('../modules/nomina/periodos/periodos.model');
const TrabajadoresModel  = require('../modules/trabajadores/trabajadores.model');
const PuntosMarcajeModel = require('../modules/puntos-marcaje/puntos-marcaje.model');
const RegistrosService   = require('../modules/nomina/registros/registros.service');
const { ROLES }          = require('../config/constants');

// Usuario gestor estándar para pruebas.
const GESTOR = { sub: 10, rol: ROLES.JEFE_NOMINA };

// ── crear ─────────────────────────────────────────────────────────────────────

describe('RegistrosService.crear', () => {
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

    expect(RegistrosModel.crear).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        horas_ordinarias: 8,
        horas_extra_diurnas: 0,
      })
    );
    expect(result.id).toBe(77);
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

    expect(RegistrosModel.actualizar).toHaveBeenCalledWith(
      1,
      99,
      expect.objectContaining({
        horas_ordinarias: 8,
        horas_extra_diurnas: 2,
      })
    );
  });
});

// ── marcarSalida ──────────────────────────────────────────────────────────────

describe('RegistrosService.marcarSalida', () => {
  const TRABAJADOR_USUARIO = { sub: 20, rol: ROLES.TRABAJADOR_NOMINA };

  beforeEach(() => {
    TrabajadoresModel.obtenerPorUsuarioId.mockResolvedValue({ id: 5 });
    TrabajadoresModel.obtenerPorId.mockResolvedValue({ id: 5, tipo_marcacion: 'libre' });
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
      expect.objectContaining({ horas_ordinarias: expect.any(Number) })
    );
    expect(result.id).toBe(1);
    expect(result).toHaveProperty('advertencia'); // null o string
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
