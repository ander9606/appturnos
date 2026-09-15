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

// Mismo patrón que el bug de geofence_info arriba: obtenerConDetalles (vista
// gestor) traía trabajador_tipo para decidir contrato-vs-bono en turno/[id].tsx,
// pero listarPorTrabajador/listarPorUsuario ("mis-turnos", la vista que el propio
// trabajador usa) no lo traían — un trabajador_nomina viendo SU PROPIO turno
// eventual seguía viendo "Debes firmar el contrato para cobrar" pese al fix.
describe('AsignacionesModel — trabajador_tipo en listados "mis-turnos"', () => {
  // pool.query está mockeado: un test que solo revise la fila devuelta pasaría
  // igual aunque se borre el JOIN/columna real (el mock ya trae el campo puesto
  // a mano). Lo que protege contra el regreso del bug es el SQL en sí.
  test('listarPorTrabajador consulta trabajadores.tipo', async () => {
    pool.query.mockResolvedValue([[filaTipoLibre]]);
    await AsignacionesModel.listarPorTrabajador(1, 1);
    const sql = pool.query.mock.calls[0][0];
    expect(sql).toMatch(/t\.tipo AS trabajador_tipo/);
    expect(sql).toMatch(/JOIN trabajadores t\s+ON t\.id = a\.trabajador_id/);
  });

  test('listarPorUsuario consulta trabajadores.tipo', async () => {
    pool.query.mockResolvedValue([[filaTipoLibre]]);
    await AsignacionesModel.listarPorUsuario(1);
    const sql = pool.query.mock.calls[0][0];
    expect(sql).toMatch(/t\.tipo AS trabajador_tipo/);
    expect(sql).toMatch(/JOIN trabajadores t\s+ON t\.id = a\.trabajador_id/);
  });
});
