'use strict';

// Regresión: generarParaAsignacion (y generarSiNoExiste, de donde se extrajo)
// llamaba a EmpresasModel.obtenerPorId, que no existe — EmpresasModel solo
// expone obtenerTipoContrato(). Cada vez que había que CREAR un contrato
// nuevo (no cuando ya existía), esto tiraba un TypeError síncrono. Los
// call-sites best-effort en asignaciones.service.js (marcarEgreso, corregir,
// cerrarMasivo) tragan ese error con .catch(), así que el contrato nunca se
// creaba y el turno completado no aparecía en "sin firmar".
jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../modules/turnos/asignaciones/asignaciones.model');
jest.mock('../modules/contratos/contratos.model');
jest.mock('../modules/empresas/empresas.model');

const AsignacionesModel = require('../modules/turnos/asignaciones/asignaciones.model');
const ContratosModel = require('../modules/contratos/contratos.model');
const EmpresasModel = require('../modules/empresas/empresas.model');
const ContratosService = require('../modules/contratos/contratos.service');

afterEach(() => jest.clearAllMocks());

describe('ContratosService.generarParaAsignacion', () => {
  const asignacion = {
    trabajador_id: 10,
    oferta_fecha: '2026-09-01',
    cargo_nombre: 'Operario',
    oferta_titulo: 'Turno bodega',
    tarifa_dia: 60000,
  };

  beforeEach(() => {
    ContratosModel.obtenerPorAsignacion.mockResolvedValue(null);
    AsignacionesModel.obtenerConDetalles.mockResolvedValue(asignacion);
    EmpresasModel.obtenerTipoContrato.mockResolvedValue('laboral');
    ContratosModel.contarPorTrabajadorUltimo12Meses.mockResolvedValue(0);
    ContratosModel.registrarAuditoria.mockResolvedValue(undefined);
    ContratosModel.crear.mockResolvedValue(123);
    ContratosModel.obtenerPorId.mockResolvedValue({ id: 123, tipo_contrato: 'LABORAL' });
  });

  test('crea el contrato leyendo el tipo vía obtenerTipoContrato, sin reventar', async () => {
    const contrato = await ContratosService.generarParaAsignacion(7, 500);

    expect(EmpresasModel.obtenerTipoContrato).toHaveBeenCalledWith(7);
    expect(ContratosModel.crear).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ asignacionId: 500, tipoContrato: 'LABORAL' })
    );
    expect(contrato).toEqual({ id: 123, tipo_contrato: 'LABORAL' });
  });

  test('si el contrato ya existe, no vuelve a crearlo', async () => {
    ContratosModel.obtenerPorAsignacion.mockResolvedValue({ id: 9, firmado_trabajador: 0 });

    const contrato = await ContratosService.generarParaAsignacion(7, 500);

    expect(ContratosModel.crear).not.toHaveBeenCalled();
    expect(contrato).toEqual({ id: 9, firmado_trabajador: 0 });
  });
});
