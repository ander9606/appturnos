'use strict';

// listarPorTrabajador/listarPorUsuario alimentan "mis-turnos", que el mobile usa
// para la pantalla de marcar ingreso (useGeofence). Hasta este fix no calculaban
// geofence_info (solo obtenerConDetalles, la vista gestor, lo hacía) — el cliente
// creía que esos turnos no tenían geofence, nunca pedía GPS, y el ingreso se
// mandaba con lat/lng en 0,0 (rechazado por el backend como "fuera del área").
jest.mock('../config/database', () => ({
  pool: { query: jest.fn() },
}));

const { pool } = require('../config/database');
const AsignacionesModel = require('../modules/turnos/asignaciones/asignaciones.consultas.model');

afterEach(() => jest.clearAllMocks());

const filaTipoOferta = { id: 1, tipo_geofence: 'oferta', lugar: 'Corferias', latitud: '4.6300000', longitud: '-74.0900000' };
const filaTipoFijo   = { id: 2, tipo_geofence: 'fijo', punto_nombre: 'Bodega Norte', punto_latitud: '4.7110000', punto_longitud: '-74.0721000', punto_radio: 150 };
const filaTipoLibre  = { id: 3, tipo_geofence: 'libre' };

describe('AsignacionesModel — geofence_info en listados "mis-turnos"', () => {
  test('listarPorTrabajador arma geofence_info tipo oferta con coords numéricas', async () => {
    pool.query.mockResolvedValue([[filaTipoOferta]]);
    const [fila] = await AsignacionesModel.listarPorTrabajador(1, 1);
    expect(fila.geofence_info).toEqual({ tipo: 'oferta', nombre: 'Corferias', latitud: 4.63, longitud: -74.09, radio_metros: 1000 });
  });

  test('listarPorUsuario arma geofence_info tipo fijo con el punto asociado', async () => {
    pool.query.mockResolvedValue([[filaTipoFijo]]);
    const [fila] = await AsignacionesModel.listarPorUsuario(1);
    expect(fila.geofence_info).toEqual({ tipo: 'fijo', nombre: 'Bodega Norte', latitud: 4.711, longitud: -74.0721, radio_metros: 150 });
  });

  test('tipo libre no exige coordenadas', async () => {
    pool.query.mockResolvedValue([[filaTipoLibre]]);
    const [fila] = await AsignacionesModel.listarPorTrabajador(1, 1);
    expect(fila.geofence_info).toEqual({ tipo: 'libre' });
  });
});
