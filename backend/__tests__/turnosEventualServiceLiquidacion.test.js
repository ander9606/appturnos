'use strict';

// Un trabajador_nomina podía consultar /turnos-eventual/:id/liquidacion y ver la
// liquidación de TODOS sus compañeros (antes de este cambio la ruta ni siquiera dejaba
// pasar ese rol). Ahora la ruta lo deja pasar y el service filtra a su propia fila —
// mismo patrón que backend/modules/nomina/liquidacion/liquidacion.service.js.
jest.mock('../modules/turnos-eventual/turnos-eventual.model');
jest.mock('../modules/trabajadores/trabajadores.model');

const TurnosEventualModel = require('../modules/turnos-eventual/turnos-eventual.model');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const TurnosEventualService = require('../modules/turnos-eventual/turnos-eventual.service');
const { ROLES } = require('../config/constants');

afterEach(() => jest.clearAllMocks());

const periodoNomina = {
  id: 5, empresa_id: 7, segmento: 'nomina',
  fecha_inicio: '2026-01-01', fecha_fin: '2026-03-31', estado: 'abierto',
};

describe('TurnosEventualService.liquidacion', () => {
  test('trabajador_nomina: filtra la consulta a su propio trabajadorId', async () => {
    TurnosEventualModel.obtenerPorId.mockResolvedValue(periodoNomina);
    TrabajadoresModel.obtenerPorUsuarioId.mockResolvedValue({ id: 99 });
    TurnosEventualModel.liquidacion.mockResolvedValue([
      { trabajador_id: 99, nombre_completo: 'Ana Ruiz', turnos: 3, horas: 24, total: 500000 },
    ]);

    const usuario = { sub: 42, rol: ROLES.TRABAJADOR_NOMINA };
    const result = await TurnosEventualService.liquidacion(7, 5, usuario);

    expect(TrabajadoresModel.obtenerPorUsuarioId).toHaveBeenCalledWith(7, 42);
    expect(TurnosEventualModel.liquidacion).toHaveBeenCalledWith(7, 5, ['nomina'], 99);
    expect(result.lineas).toHaveLength(1);
    expect(result.total_general).toBe(500000);
  });

  test('trabajador_nomina sin trabajador vinculado → 403', async () => {
    TurnosEventualModel.obtenerPorId.mockResolvedValue(periodoNomina);
    TrabajadoresModel.obtenerPorUsuarioId.mockResolvedValue(null);

    const usuario = { sub: 42, rol: ROLES.TRABAJADOR_NOMINA };
    await expect(TurnosEventualService.liquidacion(7, 5, usuario)).rejects.toMatchObject({ statusCode: 403 });
    expect(TurnosEventualModel.liquidacion).not.toHaveBeenCalled();
  });

  test('gestor: sin filtro, recibe todas las líneas del período', async () => {
    TurnosEventualModel.obtenerPorId.mockResolvedValue(periodoNomina);
    TurnosEventualModel.liquidacion.mockResolvedValue([
      { trabajador_id: 1, total: 100 },
      { trabajador_id: 2, total: 200 },
    ]);

    const usuario = { sub: 1, rol: ROLES.ADMIN_EMPRESA };
    const result = await TurnosEventualService.liquidacion(7, 5, usuario);

    expect(TrabajadoresModel.obtenerPorUsuarioId).not.toHaveBeenCalled();
    expect(TurnosEventualModel.liquidacion).toHaveBeenCalledWith(7, 5, ['nomina'], undefined);
    expect(result.lineas).toHaveLength(2);
    expect(result.total_general).toBe(300);
  });

  test('segmento turnos: filtra por tipo turnos+ambos, no nomina', async () => {
    const periodoTurnos = { ...periodoNomina, id: 6, segmento: 'turnos' };
    TurnosEventualModel.obtenerPorId.mockResolvedValue(periodoTurnos);
    TurnosEventualModel.liquidacion.mockResolvedValue([]);

    const usuario = { sub: 1, rol: ROLES.ADMIN_EMPRESA };
    await TurnosEventualService.liquidacion(7, 6, usuario);

    expect(TurnosEventualModel.liquidacion).toHaveBeenCalledWith(7, 6, ['turnos', 'ambos'], undefined);
  });

  test('castea horas/total: mysql2 devuelve SUM() como string (DECIMAL)', async () => {
    TurnosEventualModel.obtenerPorId.mockResolvedValue(periodoNomina);
    TurnosEventualModel.liquidacion.mockResolvedValue([
      { trabajador_id: 1, nombre_completo: 'Ana Ruiz', turnos: 3, horas: '24.50', total: '500000.00' },
    ]);

    const usuario = { sub: 1, rol: ROLES.ADMIN_EMPRESA };
    const result = await TurnosEventualService.liquidacion(7, 5, usuario);

    expect(result.lineas[0].horas).toBe(24.5);
    expect(result.lineas[0].total).toBe(500000);
    expect(result.total_general).toBe(500000);
  });

  test('período inexistente → 404 (sin importar el rol)', async () => {
    TurnosEventualModel.obtenerPorId.mockResolvedValue(null);

    await expect(
      TurnosEventualService.liquidacion(7, 999, { sub: 1, rol: ROLES.ADMIN_EMPRESA })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
