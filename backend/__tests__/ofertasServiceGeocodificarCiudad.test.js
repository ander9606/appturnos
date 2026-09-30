'use strict';

// El directorio de empresas filtra por ciudad, pero empresas.ciudad es un
// solo valor autoreportado — una empresa con sede en una ciudad puede
// publicar turnos en otra. Al crear una oferta con coordenadas, se resuelve
// (best-effort, sin bloquear la respuesta) la ciudad real vía Nominatim y se
// guarda en ofertas_turno.ciudad.
jest.mock('../config/database', () => ({
  pool: { query: jest.fn().mockResolvedValue([[]]) },
}));
jest.mock('../modules/turnos/ofertas/ofertas.model');
jest.mock('../modules/turnos/asignaciones/asignaciones.model');
jest.mock('../modules/cargos/cargos.model');
jest.mock('../modules/puntos-marcaje/puntos-marcaje.model');
jest.mock('../modules/trabajadores/trabajadores.service');
jest.mock('../modules/geocoding/geocoding.service');
jest.mock('../modules/notificaciones/notificaciones.service', () => ({
  notificarVarios: jest.fn().mockResolvedValue(undefined),
}));

const OfertasModel = require('../modules/turnos/ofertas/ofertas.model');
const CargosModel = require('../modules/cargos/cargos.model');
const GeocodingService = require('../modules/geocoding/geocoding.service');
const OfertasService = require('../modules/turnos/ofertas/ofertas.service');

const EMPRESA_ID = 7;
const datosBase = {
  titulo: 'Turno bodega', fecha: '2099-01-01', hora_inicio: '08:00:00', puestos: [],
};

function flush() {
  return new Promise((r) => setImmediate(r));
}

beforeEach(() => {
  jest.clearAllMocks();
  CargosModel.contarActivosPorEmpresa.mockResolvedValue(99); // nunca falta personal en estos tests
  OfertasModel.crear.mockResolvedValue(1);
});

describe('OfertasService.crear — geocodificación de ciudad', () => {
  test('con coordenadas, resuelve la ciudad y la guarda (sin bloquear la respuesta)', async () => {
    OfertasModel.obtenerPorId.mockResolvedValue({
      id: 1, empresa_id: EMPRESA_ID, latitud: 4.65, longitud: -74.05, ubicacion_libre: 0, puestos: [],
    });
    GeocodingService.reverse.mockResolvedValue({ address: { city: 'Bogotá' } });

    const oferta = await OfertasService.crear(EMPRESA_ID, { ...datosBase, latitud: 4.65, longitud: -74.05 }, 1);
    await flush();

    expect(oferta.id).toBe(1); // la respuesta no esperó a la geocodificación
    expect(GeocodingService.reverse).toHaveBeenCalledWith(4.65, -74.05);
    expect(OfertasModel.actualizarCiudad).toHaveBeenCalledWith(1, 'Bogotá');
  });

  test('sin "city", cae a town/municipality/village en ese orden', async () => {
    OfertasModel.obtenerPorId.mockResolvedValue({
      id: 2, empresa_id: EMPRESA_ID, latitud: 6.2, longitud: -75.6, ubicacion_libre: 0, puestos: [],
    });
    GeocodingService.reverse.mockResolvedValue({ address: { municipality: 'Envigado' } });

    await OfertasService.crear(EMPRESA_ID, { ...datosBase, latitud: 6.2, longitud: -75.6 }, 1);
    await flush();

    expect(OfertasModel.actualizarCiudad).toHaveBeenCalledWith(2, 'Envigado');
  });

  test('ubicación libre (sin coordenadas fijas) no geocodifica', async () => {
    OfertasModel.obtenerPorId.mockResolvedValue({
      id: 3, empresa_id: EMPRESA_ID, latitud: null, longitud: null, ubicacion_libre: 1, puestos: [],
    });

    await OfertasService.crear(EMPRESA_ID, datosBase, 1);
    await flush();

    expect(GeocodingService.reverse).not.toHaveBeenCalled();
    expect(OfertasModel.actualizarCiudad).not.toHaveBeenCalled();
  });

  test('si Nominatim falla, no rompe la creación ni guarda ciudad', async () => {
    OfertasModel.obtenerPorId.mockResolvedValue({
      id: 4, empresa_id: EMPRESA_ID, latitud: 4.65, longitud: -74.05, ubicacion_libre: 0, puestos: [],
    });
    GeocodingService.reverse.mockRejectedValue(new Error('Nominatim caído'));

    const oferta = await OfertasService.crear(EMPRESA_ID, { ...datosBase, latitud: 4.65, longitud: -74.05 }, 1);
    await flush();

    expect(oferta.id).toBe(4);
    expect(OfertasModel.actualizarCiudad).not.toHaveBeenCalled();
  });
});
