'use strict';

// Golden master de las transacciones de AsignacionesPostulacionModel.calificar y de
// OfertasModel.crear / actualizar / cancelar / marcarFallida, generado con el código ANTES de
// pasarlas a enTransaccion(). Fija, para cada método: el SQL y los parámetros de cada consulta,
// su orden, begin/commit/rollback/release, lo que devuelve, y qué pasa si falla cada consulta,
// el begin, el commit, el rollback o la conexión. Ver __tests__/helpers/transaccionGolden.js.
jest.mock('../config/database', () => ({ pool: { query: jest.fn(), getConnection: jest.fn() } }));
jest.mock('../utils/fechaColombia', () => ({ ahoraColombiaSQL: jest.fn(() => '2026-06-10 17:00:00') }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { pool } = require('../config/database');
const { verificarGolden, escenariosDe } = require('./helpers/transaccionGolden');
const AsignacionesPostulacionModel = require('../modules/turnos/asignaciones/asignaciones.postulacion.model');
const OfertasModel = require('../modules/turnos/ofertas/ofertas.model');

const OFERTA_COMPLETA = {
  titulo: 'Montaje', descripcion: 'd', fecha: '2026-06-20', hora_inicio: '08:00:00', hora_fin_estimada: '16:00:00',
  lugar: 'Bodega', latitud: 4.6, longitud: -74.1, estado: 'borrador', para_quien: 'turnos', visibilidad: 'dirigida',
  external_ref: 'lq:1', alquiler_ref: 'al:1', externo_notas: 'n',
  puestos: [{ cargo_id: 3, plazas: 2, tarifa_dia: 80000, notas: 'a' }, { cargo_id: 4, tarifa_dia: 90000 }],
  trabajador_ids: [11, 12],
  punto_marcaje_ids: [21, 22],
};

const CASOS = {
  'postulacion.calificar': () => AsignacionesPostulacionModel.calificar(1, 30, { trabajadorId: 5, calificacion: 4, comentario: 'bien', calificadoPor: 10 }),
  'postulacion.calificar (del sistema, sin comentario)': () => AsignacionesPostulacionModel.calificar(1, 30, { trabajadorId: 5, calificacion: 0 }),
  'ofertas.crear (completa: puestos, destinatarios y puntos)': () => OfertasModel.crear(1, OFERTA_COMPLETA, 10),
  'ofertas.crear (mínima)': () => OfertasModel.crear(1, { titulo: 'T', fecha: '2026-06-20', hora_inicio: '08:00:00' }, 10),
  'ofertas.crear (abierta con puestos, sin destinatarios)': () => OfertasModel.crear(1, { titulo: 'T', fecha: '2026-06-20', hora_inicio: '08:00:00', visibilidad: 'abierta', puestos: [{ cargo_id: 3, tarifa_dia: 1 }], trabajador_ids: [9] }, 10),
  'ofertas.actualizar (campos y puntos)': () => OfertasModel.actualizar(1, 50, { titulo: 'Nuevo', punto_marcaje_ids: [3, 4] }),
  'ofertas.actualizar (solo campos)': () => OfertasModel.actualizar(1, 50, { titulo: 'Nuevo' }),
  'ofertas.actualizar (solo puntos)': () => OfertasModel.actualizar(1, 50, { punto_marcaje_ids: [] }),
  'ofertas.actualizar (nada que cambiar: ni abre conexión)': () => OfertasModel.actualizar(1, 50, {}),
  'ofertas.cancelar': () => OfertasModel.cancelar(1, 50),
  'ofertas.marcarFallida (con compensaciones)': () => OfertasModel.marcarFallida(1, 50, [{ asignacionId: 1, monto: 100 }, { asignacionId: 2, monto: 50 }], 'fuerza mayor', 10),
  'ofertas.marcarFallida (sin compensaciones)': () => OfertasModel.marcarFallida(1, 50, [], 'fuerza mayor', 10),
};

test('las transacciones de calificar y de ofertas se comportan igual que el golden (éxito y cada falla)', async () => {
  const { escrito, actual, golden } = await verificarGolden(pool, CASOS, 'transaccionesModelsT1.golden.json');
  if (escrito) return;
  expect(Object.keys(actual)).toEqual(Object.keys(golden));
  for (const nombre of Object.keys(golden)) {
    expect({ nombre, escenarios: actual[nombre] }).toEqual({ nombre, escenarios: golden[nombre] });
  }
});

// Comprobaciones explícitas de lo esencial, para que el golden no sea una caja negra.
test('forma de la transacción en el camino feliz y ante una falla (lectura directa)', async () => {
  const esc = await escenariosDe(pool, CASOS['ofertas.cancelar']);
  const nombres = (e) => e.log.map((l) => l[0]);
  expect(nombres(esc.ok)).toEqual(['getConnection', 'begin', 'query', 'query', 'commit', 'release']);
  expect(nombres(esc.falla_consulta_1)).toEqual(['getConnection', 'begin', 'query', 'query', 'rollback', 'release']);
  expect(nombres(esc.falla_begin)).toEqual(['getConnection', 'begin', 'rollback', 'release']);
  expect(nombres(esc.falla_commit)).toEqual(['getConnection', 'begin', 'query', 'query', 'commit', 'rollback', 'release']);
  expect(nombres(esc.falla_getConnection)).toEqual(['getConnection']);
});
