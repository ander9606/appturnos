'use strict';

// Caracterización de recalcularRanking / recalcularRankingStandalone y de los dos sitios que
// los usan dentro de una transacción (AsignacionesPostulacionModel.calificar y
// marcarNoPresentado), ANTES de sacar ese SQL de utils/rankingUtils.js a un model.
// Simula solo el borde (pool/conexión) y anota todo en un único registro.
// (Escrito antes del refactor contra utils/rankingUtils.js; las expectativas no cambiaron al mover el SQL.)
jest.mock('../config/database', () => ({ pool: { query: jest.fn(), getConnection: jest.fn() } }));

const { pool } = require('../config/database');
const AsignacionesPostulacionModel = require('../modules/turnos/asignaciones/asignaciones.postulacion.model');

const { recalcular: recalcularRanking, recalcularStandalone: recalcularRankingStandalone } = require('../modules/trabajadores/ranking.model');

const sql = (s) => s.replace(/\s+/g, ' ').trim();
const SQL_STATS = 'SELECT ROUND(AVG(calificacion), 2) AS promedio, COUNT(*) AS total FROM calificaciones_turno WHERE empresa_id = ? AND trabajador_id = ?';
const SQL_UPDATE = 'UPDATE trabajadores SET ranking = ?, total_calificaciones = ? WHERE id = ? AND empresa_id = ?';

let log;
let respuestas; // [regex, valor | Error | función]
let fallas;
let conn;

beforeEach(() => {
  log = [];
  respuestas = [];
  fallas = {};
  conn = {
    query: jest.fn(async (texto, params) => {
      log.push(['q', sql(texto), params]);
      for (const [re, valor] of respuestas) {
        if (re.test(texto)) {
          const v = typeof valor === 'function' ? valor() : valor;
          if (v instanceof Error) throw v;
          return v;
        }
      }
      return [[]];
    }),
    beginTransaction: jest.fn(async () => { log.push(['begin']); }),
    commit: jest.fn(async () => { log.push(['commit']); }),
    rollback: jest.fn(async () => { log.push(['rollback']); }),
    release: jest.fn(() => { log.push(['release']); }),
  };
  pool.getConnection.mockImplementation(async () => {
    log.push(['getConnection']);
    if (fallas.getConnection) throw fallas.getConnection;
    return conn;
  });
});

const nombres = () => log.map((l) => l[0]);
const stats = (promedio, total) => [/SELECT ROUND\(AVG/, [[{ promedio, total }]]];

// ── recalcularRanking ────────────────────────────────────────────────────────

describe('recalcularRanking', () => {
  test('lee el promedio y el total, los guarda en el trabajador y los devuelve (promedio como number)', async () => {
    respuestas = [stats('4.50', 6)];
    await expect(recalcularRanking(conn, 1, 5)).resolves.toEqual({ ranking: 4.5, total: 6 });
    expect(log).toEqual([
      ['q', SQL_STATS, [1, 5]],
      ['q', SQL_UPDATE, [4.5, 6, 5, 1]],
    ]);
  });

  test.each([
    ['promedio null (sin calificaciones)', null, 0, { ranking: null, total: 0 }, [null, 0, 5, 1]],
    ['promedio 0.00 (solo no presentados) NO es null', '0.00', 2, { ranking: 0, total: 2 }, [0, 2, 5, 1]],
    ['promedio ya numérico', 3, 1, { ranking: 3, total: 1 }, [3, 1, 5, 1]],
    ['promedio numérico 0 (no es null)', 0, 2, { ranking: 0, total: 2 }, [0, 2, 5, 1]],
  ])('%s', async (_n, promedio, total, esperado, params) => {
    respuestas = [stats(promedio, total)];
    await expect(recalcularRanking(conn, 1, 5)).resolves.toEqual(esperado);
    expect(log[1]).toEqual(['q', SQL_UPDATE, params]);
  });

  test('el total se pasa tal como viene (sin castear)', async () => {
    respuestas = [stats('5.00', '3')];
    await expect(recalcularRanking(conn, 1, 5)).resolves.toEqual({ ranking: 5, total: '3' });
  });

  test('si falla la lectura no escribe; si falla la escritura propaga el error; no maneja transacción', async () => {
    respuestas = [[/SELECT ROUND\(AVG/, new Error('lectura')]];
    await expect(recalcularRanking(conn, 1, 5)).rejects.toThrow('lectura');
    expect(nombres()).toEqual(['q']);

    log.length = 0;
    respuestas = [stats('4.00', 1), [/^UPDATE trabajadores/, new Error('escritura')]];
    await expect(recalcularRanking(conn, 1, 5)).rejects.toThrow('escritura');
    expect(nombres()).toEqual(['q', 'q']); // ni begin, ni commit, ni rollback, ni release
  });
});

// ── recalcularRankingStandalone ──────────────────────────────────────────────

describe('recalcularRankingStandalone', () => {
  test('abre su conexión, recalcula con ella y la libera; SIN transacción', async () => {
    respuestas = [stats('3.50', 4)];
    await expect(recalcularRankingStandalone(2, 9)).resolves.toEqual({ ranking: 3.5, total: 4 });
    expect(nombres()).toEqual(['getConnection', 'q', 'q', 'release']);
    expect(log[1]).toEqual(['q', SQL_STATS, [2, 9]]);
    expect(log[2]).toEqual(['q', SQL_UPDATE, [3.5, 4, 9, 2]]);
  });

  test('si falla al recalcular: libera la conexión y propaga el error', async () => {
    respuestas = [[/SELECT ROUND\(AVG/, new Error('lectura')]];
    await expect(recalcularRankingStandalone(2, 9)).rejects.toThrow('lectura');
    expect(nombres()).toEqual(['getConnection', 'q', 'release']);
  });

  test('si no consigue conexión: rechaza sin liberar nada', async () => {
    fallas.getConnection = new Error('pool agotado');
    await expect(recalcularRankingStandalone(2, 9)).rejects.toThrow('pool agotado');
    expect(nombres()).toEqual(['getConnection']);
  });
});

// ── AsignacionesPostulacionModel.calificar ───────────────────────────────────

describe('AsignacionesPostulacionModel.calificar', () => {
  const SQL_INSERT = 'INSERT INTO calificaciones_turno (empresa_id, asignacion_id, trabajador_id, calificacion, comentario, calificado_por) VALUES (?, ?, ?, ?, ?, ?)';

  test('begin → INSERT de la calificación → recalcular ranking → commit → release; devuelve el ranking', async () => {
    respuestas = [stats('4.00', 2)];
    const r = await AsignacionesPostulacionModel.calificar(1, 30, { trabajadorId: 5, calificacion: 4, comentario: 'bien', calificadoPor: 10 });
    expect(r).toEqual({ ranking: 4, total: 2 });
    expect(log).toEqual([
      ['getConnection'], ['begin'],
      ['q', SQL_INSERT, [1, 30, 5, 4, 'bien', 10]],
      ['q', SQL_STATS, [1, 5]],
      ['q', SQL_UPDATE, [4, 2, 5, 1]],
      ['commit'], ['release'],
    ]);
  });

  test('comentario y calificadoPor ausentes se guardan como null (calificación del sistema)', async () => {
    respuestas = [stats('0.00', 1)];
    await AsignacionesPostulacionModel.calificar(1, 30, { trabajadorId: 5, calificacion: 0 });
    expect(log[2][2]).toEqual([1, 30, 5, 0, null, null]);
  });

  test.each([
    ['el INSERT (p. ej. ya calificada: ER_DUP_ENTRY)', [/^INSERT INTO calificaciones_turno/, Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' })], ['getConnection', 'begin', 'q', 'rollback', 'release']],
    ['la lectura del ranking', [/SELECT ROUND\(AVG/, new Error('lectura')], ['getConnection', 'begin', 'q', 'q', 'rollback', 'release']],
    ['la escritura del ranking', [/^UPDATE trabajadores/, new Error('escritura')], ['getConnection', 'begin', 'q', 'q', 'q', 'rollback', 'release']],
  ])('si falla %s: rollback, sin commit y libera la conexión', async (_n, falla, esperado) => {
    respuestas = [falla, stats('4.00', 1)];
    await expect(AsignacionesPostulacionModel.calificar(1, 30, { trabajadorId: 5, calificacion: 4 })).rejects.toThrow();
    expect(nombres()).toEqual(esperado);
  });
});

// ── AsignacionesPostulacionModel.marcarNoPresentado ──────────────────────────

describe('AsignacionesPostulacionModel.marcarNoPresentado', () => {
  const asig = (estado = 'confirmado') => [/FROM asignaciones_turno WHERE id = \? AND empresa_id = \? FOR UPDATE/, [[{ id: 30, estado, puesto_id: 8, trabajador_id: 5, oferta_id: 70 }]]];
  const sinCalificacion = [/SELECT id FROM calificaciones_turno WHERE asignacion_id/, [[]]];
  const conCalificacion = [/SELECT id FROM calificaciones_turno WHERE asignacion_id/, [[{ id: 1 }]]];

  test('sin calificación previa: estado, plaza, INSERT de 0 estrellas y recalcular ranking, en ese orden', async () => {
    respuestas = [asig(), sinCalificacion, stats('0.00', 1)];
    await expect(AsignacionesPostulacionModel.marcarNoPresentado(1, 30)).resolves.toEqual({ ok: true, trabajador_id: 5, oferta_id: 70 });
    expect(log).toEqual([
      ['getConnection'], ['begin'],
      ['q', 'SELECT * FROM asignaciones_turno WHERE id = ? AND empresa_id = ? FOR UPDATE', [30, 1]],
      ['q', "UPDATE asignaciones_turno SET estado = 'no_presentado' WHERE id = ?", [30]],
      ['q', 'UPDATE oferta_puestos SET plazas_cubiertas = GREATEST(0, plazas_cubiertas - 1) WHERE id = ?', [8]],
      ['q', 'SELECT id FROM calificaciones_turno WHERE asignacion_id = ? LIMIT 1', [30]],
      ['q', 'INSERT INTO calificaciones_turno (empresa_id, asignacion_id, trabajador_id, calificacion, calificado_por) VALUES (?, ?, ?, 0, NULL)', [1, 30, 5]],
      ['q', SQL_STATS, [1, 5]],
      ['q', SQL_UPDATE, [0, 1, 5, 1]],
      ['commit'], ['release'],
    ]);
  });

  test('ya calificada: no inserta ni recalcula el ranking', async () => {
    respuestas = [asig('en_progreso'), conCalificacion];
    await expect(AsignacionesPostulacionModel.marcarNoPresentado(1, 30)).resolves.toMatchObject({ ok: true });
    expect(log.some((l) => l[1]?.startsWith?.('INSERT INTO calificaciones_turno'))).toBe(false);
    expect(log.some((l) => l[1] === SQL_STATS)).toBe(false);
    expect(nombres().slice(-2)).toEqual(['commit', 'release']);
  });

  test.each([
    ['asignación inexistente', [], 'no_existe'],
    ['estado que no admite no_presentado', 'cancelado', 'estado'],
  ])('%s: rollback y {ok:false, motivo}', async (_n, fila, motivo) => {
    respuestas = [Array.isArray(fila) ? [/FOR UPDATE/, [[]]] : asig(fila)];
    await expect(AsignacionesPostulacionModel.marcarNoPresentado(1, 30)).resolves.toEqual({ ok: false, motivo });
    expect(nombres()).toEqual(['getConnection', 'begin', 'q', 'rollback', 'release']);
  });

  test('si falla el recalcular el ranking: rollback, sin commit', async () => {
    respuestas = [asig(), sinCalificacion, [/SELECT ROUND\(AVG/, new Error('lectura')]];
    await expect(AsignacionesPostulacionModel.marcarNoPresentado(1, 30)).rejects.toThrow('lectura');
    expect(nombres().slice(-2)).toEqual(['rollback', 'release']);
    expect(nombres()).not.toContain('commit');
  });
});
