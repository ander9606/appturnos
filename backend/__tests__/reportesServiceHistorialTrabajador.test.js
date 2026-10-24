'use strict';

// Seguridad: historialTrabajador() era el único reporte que no respetaba verPagos
// (costos/resumen/personas sí) — jefe_turnos podía leer horas extra/nocturnas/
// festivas y la novedad (notas médicas) de cualquier trabajador vía
// GET /api/reportes/trabajador/:id. Con verPagos=false, registros_nomina debe
// quedar null sin siquiera consultar la tabla.
jest.mock('./../modules/reportes/reportes.model');
jest.mock('./../modules/trabajadores/trabajadores.model');

const ReportesModel = require('../modules/reportes/reportes.model');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const ReportesService = require('../modules/reportes/reportes.service');

const TRABAJADOR = { id: 7, nombre: 'Ana', apellido: 'Pérez', cedula: '123', tipo: 'nomina', cargo: 'Auxiliar' };
const RANGO = { desde: '2026-01-01', hasta: '2026-01-31' };

beforeEach(() => {
  jest.clearAllMocks();
  TrabajadoresModel.obtenerPorId.mockResolvedValue(TRABAJADOR);
  ReportesModel.turnosDeTrabajador.mockResolvedValue([]);
  ReportesModel.registrosDeTrabajador.mockResolvedValue([{ fecha: '2026-01-05', novedad: 'incapacidad médica' }]);
});

describe('ReportesService.historialTrabajador — verPagos', () => {
  test('verPagos=false (jefe_turnos): registros_nomina queda null, sin consultar la tabla', async () => {
    const r = await ReportesService.historialTrabajador(1, 7, RANGO, { verPagos: false });

    expect(ReportesModel.registrosDeTrabajador).not.toHaveBeenCalled();
    expect(r.registros_nomina).toBeNull();
    expect(r.resumen.dias_nomina).toBeNull();
  });

  test('verPagos=true (admin/jefe_nomina/nomina): registros_nomina viene completo', async () => {
    const r = await ReportesService.historialTrabajador(1, 7, RANGO, { verPagos: true });

    expect(ReportesModel.registrosDeTrabajador).toHaveBeenCalledWith(1, 7, RANGO.desde, RANGO.hasta);
    expect(r.registros_nomina).toEqual([{ fecha: '2026-01-05', novedad: 'incapacidad médica' }]);
    expect(r.resumen.dias_nomina).toBe(1);
  });
});
