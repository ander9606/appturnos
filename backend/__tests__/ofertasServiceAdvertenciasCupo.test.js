'use strict';

// Cuando falta personal certificado para un puesto (advertenciasCapacidad),
// el aviso debe decir qué hacer: invitar desde el Banco de talento si aún hay
// cupo en el plan, o subir de plan si ya está en el tope — antes solo
// avisaba que faltaba gente, sin indicar el siguiente paso.
jest.mock('../config/database', () => ({
  pool: { query: jest.fn().mockResolvedValue([[]]) },
}));
jest.mock('../modules/turnos/ofertas/ofertas.model');
jest.mock('../modules/turnos/asignaciones/asignaciones.model');
jest.mock('../modules/cargos/cargos.model');
jest.mock('../modules/puntos-marcaje/puntos-marcaje.model');
jest.mock('../modules/trabajadores/trabajadores.service');
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const OfertasModel = require('../modules/turnos/ofertas/ofertas.model');
const CargosModel = require('../modules/cargos/cargos.model');
const TrabajadoresService = require('../modules/trabajadores/trabajadores.service');
const OfertasService = require('../modules/turnos/ofertas/ofertas.service');

afterEach(() => jest.clearAllMocks());

const EMPRESA_ID = 7;
const CARGO = { id: 3, nombre: 'Mesero', activo: 1, empresa_id: null };
const ofertaBase = {
  id: 1, empresa_id: EMPRESA_ID, titulo: 'Turno bodega', fecha: '2099-01-01',
  hora_inicio: '08:00:00', hora_fin_estimada: null, lugar: null,
  estado: 'abierta', puestos: [], destinatarios: [], puntos_marcaje: [],
};
const datosBase = {
  titulo: 'Turno bodega', fecha: '2099-01-01', hora_inicio: '08:00:00',
  puestos: [{ cargo_id: 3, plazas: 5, tarifa_dia: 50000 }],
};

beforeEach(() => {
  CargosModel.obtenerPorId.mockResolvedValue(CARGO);
  OfertasModel.crear.mockResolvedValue(1);
  OfertasModel.obtenerPorId.mockResolvedValue(ofertaBase);
});

describe('OfertasService.crear — advertencia de personal + cupo de plan', () => {
  test('con cupo disponible, sugiere el banco de talento', async () => {
    CargosModel.contarActivosPorEmpresa.mockResolvedValue(2); // pide 5, hay 2
    TrabajadoresService.obtenerCupoPlan.mockResolvedValue({ plan: 'basico', limite: 10, total: 3, alTope: false });

    const oferta = await OfertasService.crear(EMPRESA_ID, datosBase, 1);

    expect(oferta.cupo_lleno).toBe(false);
    expect(oferta.advertencias[0]).toMatch(/Banco de talento/);
    expect(oferta.advertencias[0]).not.toMatch(/tope/);
  });

  test('en el tope del plan, sugiere ampliar el plan en vez del banco de talento', async () => {
    CargosModel.contarActivosPorEmpresa.mockResolvedValue(2);
    TrabajadoresService.obtenerCupoPlan.mockResolvedValue({ plan: 'basico', limite: 10, total: 10, alTope: true });

    const oferta = await OfertasService.crear(EMPRESA_ID, datosBase, 1);

    expect(oferta.cupo_lleno).toBe(true);
    expect(oferta.advertencias[0]).toMatch(/tope de trabajadores de tu plan \(10\)/);
    expect(oferta.advertencias[0]).not.toMatch(/Banco de talento/);
  });

  test('con personal suficiente, no hay advertencias ni se consulta el cupo', async () => {
    CargosModel.contarActivosPorEmpresa.mockResolvedValue(5); // alcanza para las 5 plazas

    const oferta = await OfertasService.crear(EMPRESA_ID, datosBase, 1);

    expect(oferta.advertencias).toEqual([]);
    expect(oferta.cupo_lleno).toBe(false);
    expect(TrabajadoresService.obtenerCupoPlan).not.toHaveBeenCalled();
  });
});
