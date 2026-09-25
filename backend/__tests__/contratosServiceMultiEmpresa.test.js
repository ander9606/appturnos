'use strict';

// Regresión: listarSinFirmar/listarMisContratos resolvían "la" empresa del
// trabajador con TrabajadoresService.resolverTrabajadorPorUsuario, que para un
// usuario con fila de trabajador en más de una empresa (marketplace
// multi-empresa) solo devuelve UNA fila (ORDER BY id DESC LIMIT 1). Un
// trabajador con turnos completados sin firmar en dos empresas distintas solo
// veía los de la empresa que ganaba esa carrera — los de la otra quedaban
// invisibles para siempre. El fix agrega por usuario_id a través de todas sus
// empresas activas (mismo patrón ya usado en AsignacionesModel.listarPorUsuario).
jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../modules/contratos/contratos.model');
jest.mock('../modules/turnos/asignaciones/asignaciones.model');

const ContratosModel = require('../modules/contratos/contratos.model');
const AsignacionesModel = require('../modules/turnos/asignaciones/asignaciones.model');
const ContratosService = require('../modules/contratos/contratos.service');

afterEach(() => jest.clearAllMocks());

describe('ContratosService — multi-empresa (trabajador_turnos)', () => {
  test('listarSinFirmar consulta por usuario_id, no por una empresa resuelta de antemano', async () => {
    ContratosModel.listarSinFirmarPorUsuario.mockResolvedValue([
      { asignacion_id: 1 }, // empresa 3
      { asignacion_id: 2 }, // empresa 4
    ]);

    const resultado = await ContratosService.listarSinFirmar(null, { sub: 69 });

    expect(ContratosModel.listarSinFirmarPorUsuario).toHaveBeenCalledWith(69);
    expect(resultado).toHaveLength(2);
  });

  test('listarMisContratos consulta por usuario_id, no por una empresa resuelta de antemano', async () => {
    ContratosModel.listarPorUsuario.mockResolvedValue([{ id: 1 }, { id: 2 }]);

    await ContratosService.listarMisContratos(null, { sub: 69 });

    expect(ContratosModel.listarPorUsuario).toHaveBeenCalledWith(69);
  });

  test('obtenerPorAsignacion no requiere resolver un trabajador antes de buscar', async () => {
    ContratosModel.obtenerPorAsignacion.mockResolvedValue({
      id: 9, trabajador_usuario_id: 69, empresa_id: 3,
    });

    const contrato = await ContratosService.obtenerPorAsignacion(null, 500, {
      sub: 69, rol: 'trabajador_turnos',
    });

    // Se busca directo por asignacion_id (empresaId null → sin acotar por empresa)
    expect(ContratosModel.obtenerPorAsignacion).toHaveBeenCalledWith(null, 500);
    expect(contrato.empresa_id).toBe(3);
  });

  test('generarSiNoExiste deriva la empresa real de la asignación, no de un trabajador adivinado', async () => {
    ContratosModel.obtenerPorAsignacion.mockResolvedValue(null);
    AsignacionesModel.obtenerConDetalles.mockResolvedValue({
      empresa_id: 3, usuario_id: 69, tarifa_dia: 60000,
      oferta_fecha: '2026-09-01', cargo_nombre: 'Operario', oferta_titulo: 'Turno',
      trabajador_id: 61,
    });
    const generarSpy = jest
      .spyOn(ContratosService, 'generarParaAsignacion')
      .mockResolvedValue({ id: 5, trabajador_usuario_id: 69, empresa_id: 3 });

    await ContratosService.generarSiNoExiste(null, 500, { sub: 69, rol: 'trabajador_turnos' });

    // La empresa usada para generar es la 3 (la real de la asignación),
    // nunca una empresa distinta "adivinada" por resolverTrabajadorPorUsuario.
    expect(generarSpy).toHaveBeenCalledWith(3, 500);
    generarSpy.mockRestore();
  });

  test('generarSiNoExiste rechaza a un trabajador que no es dueño de la asignación', async () => {
    ContratosModel.obtenerPorAsignacion.mockResolvedValue(null);
    AsignacionesModel.obtenerConDetalles.mockResolvedValue({
      empresa_id: 3, usuario_id: 99, tarifa_dia: 60000, oferta_fecha: '2026-09-01',
    });

    await expect(
      ContratosService.generarSiNoExiste(null, 500, { sub: 69, rol: 'trabajador_turnos' })
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
