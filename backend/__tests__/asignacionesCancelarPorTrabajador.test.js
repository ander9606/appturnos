'use strict';

// El trabajador cancela su turno confirmado: libera la plaza siempre, pero solo
// recibe calificación baja si faltan menos de 12 h para el inicio. La
// cancelación del gestor (cancelar) nunca penaliza.
const mockConn = { query: jest.fn() };
jest.mock('../config/database', () => ({ pool: { query: jest.fn() } }));
jest.mock('../utils/enTransaccion', () => ({ enTransaccion: (fn) => fn(mockConn) }));
jest.mock('../modules/trabajadores/ranking.model', () => ({ recalcular: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../modules/contratos/contratos.model');

const RankingModel = require('../modules/trabajadores/ranking.model');
const Model = require('../modules/turnos/asignaciones/asignaciones.postulacion.model');

afterEach(() => jest.clearAllMocks());

const pad = (n) => String(n).padStart(2, '0');
// Inicio del turno a `horas` horas de ahora, en hora Colombia (UTC-5) como strings.
function inicioEn(horas) {
  const d = new Date(Date.now() - 5 * 3_600_000 + horas * 3_600_000);
  return {
    fecha: d.toISOString().slice(0, 10),
    hora_inicio: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`,
  };
}

function prepararConn(estado, horasParaInicio) {
  mockConn.query
    .mockResolvedValueOnce([[{ id: 5, estado, oferta_id: 1, puesto_id: 2, trabajador_id: 9 }]])
    .mockResolvedValueOnce([[inicioEn(horasParaInicio)]])
    .mockResolvedValue([{}]);
}

const insertsCalificacion = () =>
  mockConn.query.mock.calls.filter(([sql]) => sql.includes('INSERT INTO calificaciones_turno'));

describe('AsignacionesModel.cancelarPorTrabajador', () => {
  test('faltando 5 h: cancela, libera plaza y penaliza con calificación automática', async () => {
    prepararConn('confirmado', 5);
    const res = await Model.cancelarPorTrabajador(7, 5, 42);
    expect(res).toMatchObject({ ok: true, penalizado: true, trabajador_id: 9 });
    expect(insertsCalificacion()).toHaveLength(1);
    expect(RankingModel.recalcular).toHaveBeenCalledWith(mockConn, 7, 9);
  });

  test('faltando 30 h: cancela y libera plaza sin penalizar', async () => {
    prepararConn('confirmado', 30);
    const res = await Model.cancelarPorTrabajador(7, 5, 42);
    expect(res).toMatchObject({ ok: true, penalizado: false });
    expect(insertsCalificacion()).toHaveLength(0);
    expect(RankingModel.recalcular).not.toHaveBeenCalled();
    expect(mockConn.query.mock.calls.some(([sql]) => sql.includes('plazas_cubiertas - 1'))).toBe(true);
  });

  test('si no está confirmado devuelve motivo estado y no escribe nada', async () => {
    mockConn.query.mockResolvedValueOnce([[{ id: 5, estado: 'pendiente' }]]);
    expect(await Model.cancelarPorTrabajador(7, 5, 42)).toEqual({ ok: false, motivo: 'estado' });
    expect(mockConn.query).toHaveBeenCalledTimes(1);
  });
});
