'use strict';

// Regresión: el trabajador solo ve los puestos de cargos que tiene certificados en la
// empresa de la oferta. Las dirigidas (invitación manual) no se filtran.
jest.mock('../config/database', () => ({
  pool: { query: jest.fn().mockResolvedValue([[]]) },
}));
jest.mock('../modules/turnos/ofertas/ofertas.model');
jest.mock('../modules/turnos/asignaciones/asignaciones.model');
jest.mock('../modules/trabajadores/trabajadores.model');
jest.mock('../modules/trabajador-empresa/trabajador-empresa.model');
jest.mock('../modules/cargos/cargos.model');

const OfertasModel      = require('../modules/turnos/ofertas/ofertas.model');
const AsignacionesModel = require('../modules/turnos/asignaciones/asignaciones.model');
const TrabajadoresModel = require('../modules/trabajadores/trabajadores.model');
const OfertasService    = require('../modules/turnos/ofertas/ofertas.service');

const PUESTOS = [
  { id: 10, cargo_id: 1, tarifa_dia: 100000 },
  { id: 11, cargo_id: 2, tarifa_dia: 150000 },
];
const usuario = { rol: 'trabajador_turnos', sub: 42 };

beforeEach(() => {
  jest.clearAllMocks();
  OfertasModel.obtenerEmpresaId.mockResolvedValue(7);
  TrabajadoresModel.obtenerPorUsuarioId.mockResolvedValue({ id: 5, ranking: 3 });
  AsignacionesModel.listarPorOferta.mockResolvedValue([]);
});

describe('OfertasService.obtener — puestos según cargos certificados', () => {
  test('oferta abierta: solo los puestos del cargo certificado en esa empresa', async () => {
    OfertasModel.obtenerPorId.mockResolvedValue({ id: 1, empresa_id: 7, visibilidad: 'abierta', puestos: PUESTOS });
    OfertasModel.cargosCertificadosDeUsuario.mockResolvedValue([
      { empresa_id: 7, cargo_id: 1 },
      { empresa_id: 8, cargo_id: 2 }, // certificado en otra empresa: no cuenta
    ]);

    const result = await OfertasService.obtener(null, 1, usuario, [7, 8]);

    expect(result.puestos.map((p) => p.id)).toEqual([10]);
  });

  test('oferta dirigida: no filtra puestos aunque no tenga el cargo certificado', async () => {
    OfertasModel.obtenerPorId.mockResolvedValue({ id: 1, empresa_id: 7, visibilidad: 'dirigida', puestos: PUESTOS });
    OfertasModel.esDestinatario.mockResolvedValue(true);
    OfertasModel.cargosCertificadosDeUsuario.mockResolvedValue([]);

    const result = await OfertasService.obtener(null, 1, usuario, [7]);

    expect(result.puestos.map((p) => p.id)).toEqual([10, 11]);
  });

  test('trabajador: solo recibe sus propias asignaciones, no las de otros', async () => {
    OfertasModel.obtenerPorId.mockResolvedValue({ id: 1, empresa_id: 7, visibilidad: 'abierta', puestos: PUESTOS });
    OfertasModel.cargosCertificadosDeUsuario.mockResolvedValue([{ empresa_id: 7, cargo_id: 1 }]);
    AsignacionesModel.listarPorOferta.mockResolvedValue([
      { id: 1, trabajador_id: 5, pago_total: 100000 },
      { id: 2, trabajador_id: 9, pago_total: 999999 },
    ]);

    const result = await OfertasService.obtener(null, 1, usuario, [7]);

    expect(result.asignaciones.map((a) => a.id)).toEqual([1]);
  });
});
