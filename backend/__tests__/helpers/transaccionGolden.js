'use strict';

/**
 * Arnés para fijar CÓMO se abre, se cierra y se deshace una transacción de un método de model,
 * con independencia de cómo esté escrita (a mano con pool.getConnection o con enTransaccion).
 *
 * Ejecuta el método con una conexión simulada que anota TODO en un único registro
 * (getConnection, begin, cada consulta con su SQL y parámetros, commit, rollback, release) y
 * repite la ejecución inyectando una falla en cada consulta, en begin, en commit, en rollback
 * y al pedir la conexión. El resultado completo (valor devuelto o error, más el registro) se
 * compara con un archivo "golden" generado con el código ANTES de refactorizar.
 *
 * Regenerar el golden (solo si se cambia a propósito el comportamiento):
 *   UPDATE_GOLDEN=1 npx jest <archivo>
 */
const fs = require('fs');
const path = require('path');

const norm = (s) => String(s).replace(/\s+/g, ' ').trim();

/** Respuesta genérica de conn.query: sirve para `[res]`, `[[fila]]` y `[filas]`. */
function respuestaGenerica(fila = {}, insertId = 77) {
  const filas = [{ id: 1, empresa_id: 1, trabajador_id: 5, estado: 'confirmado', total: 1, promedio: null, ...fila }];
  filas.insertId = insertId;
  filas.affectedRows = 1;
  return [filas];
}

/** Respuesta "vacía": ninguna fila y ninguna fila afectada (p. ej. un UPDATE que no encontró nada). */
function respuestaVacia() {
  const filas = [];
  filas.insertId = 0;
  filas.affectedRows = 0;
  return [filas];
}

/** Ejecuta `llamar()` con la falla indicada y devuelve { resultado | error, log }. */
async function correrEscenario(pool, llamar, falla, vacio = false, fila = {}, idsDistintos = false) {
  let nRespuesta = 0;
  // idsDistintos: cada consulta devuelve un insertId propio (77, 78, 79…) para distinguir cuál se usa
  const respuesta = vacio ? respuestaVacia : () => respuestaGenerica(fila, idsDistintos ? 77 + nRespuesta++ : 77);
  const log = [];
  let nQuery = 0;
  const conn = {
    query: async (sql, params) => {
      log.push(['query', norm(sql), params]);
      const k = nQuery++;
      // 'rollback': la consulta 0 falla (para que se llegue al rollback) y el rollback también falla.
      if (falla && (falla.query === k || (falla.tipo === 'rollback' && k === 0))) {
        throw new Error(`falla en la consulta ${k}`);
      }
      return respuesta();
    },
    beginTransaction: async () => { log.push(['begin']); if (falla?.tipo === 'begin') throw new Error('falla en begin'); },
    commit: async () => { log.push(['commit']); if (falla?.tipo === 'commit') throw new Error('falla en commit'); },
    rollback: async () => { log.push(['rollback']); if (falla?.tipo === 'rollback') throw new Error('rollback roto'); },
    release: () => { log.push(['release']); },
  };
  pool.getConnection.mockReset();
  pool.query.mockReset();
  pool.query.mockImplementation(async (sql, params) => { log.push(['pool.query', norm(sql), params]); return respuesta(); });
  pool.getConnection.mockImplementation(async () => {
    log.push(['getConnection']);
    if (falla?.tipo === 'getConnection') throw new Error('pool agotado');
    return conn;
  });
  let salida;
  try {
    salida = { resultado: JSON.parse(JSON.stringify(await llamar(), (k, v) => (v === undefined ? '__undefined__' : v))) };
  } catch (e) {
    salida = { error: e.message };
  }
  return { ...salida, log, consultas: nQuery };
}

/**
 * Todos los escenarios de un método: éxito, falla en cada consulta, begin, commit, rollback, getConnection.
 * opciones.fila     → campos extra de la fila genérica que devuelve conn.query.
 * opciones.ids      → true: cada consulta devuelve un insertId distinto (77, 78, …).
 * opciones.muestra  → solo inyecta fallas en una muestra de consultas (primera, segunda, central,
 *                     penúltima y última): para métodos con decenas de consultas.
 */
async function escenariosDe(pool, llamar, opciones = {}) {
  const fila = opciones.fila || {};
  const ids = Boolean(opciones.ids);
  const res = {};
  res.ok = await correrEscenario(pool, llamar, null, false, fila, ids);
  res.ok_respuestas_vacias = await correrEscenario(pool, llamar, null, true);
  const n = res.ok.consultas;
  const indices = opciones.muestra
    ? [...new Set([0, 1, Math.floor(n / 2), n - 2, n - 1])].filter((k) => k >= 0 && k < n)
    : Array.from({ length: n }, (_, k) => k);
  for (const k of indices) res[`falla_consulta_${k}`] = await correrEscenario(pool, llamar, { query: k }, false, fila, ids);
  res.falla_begin = await correrEscenario(pool, llamar, { tipo: 'begin' }, false, fila, ids);
  res.falla_commit = await correrEscenario(pool, llamar, { tipo: 'commit' }, false, fila, ids);
  res.falla_rollback = await correrEscenario(pool, llamar, { tipo: 'rollback' }, false, fila, ids);
  res.falla_getConnection = await correrEscenario(pool, llamar, { tipo: 'getConnection' }, false, fila, ids);
  return res;
}

/** Corre todos los casos { nombre: () => promesa } y compara con (o escribe) el golden. */
async function verificarGolden(pool, casos, archivoGolden) {
  const actual = {};
  for (const [nombre, caso] of Object.entries(casos)) {
    // un caso es una función, o { llamar, fila?, muestra? }
    const { llamar, ...opciones } = typeof caso === 'function' ? { llamar: caso } : caso;
    actual[nombre] = await escenariosDe(pool, llamar, opciones);
  }
  const ruta = path.join(__dirname, '..', 'fixtures', archivoGolden);
  if (process.env.UPDATE_GOLDEN === '1') {
    fs.writeFileSync(ruta, JSON.stringify(actual, null, 1) + '\n');
    return { escrito: true, actual };
  }
  return { escrito: false, actual, golden: JSON.parse(fs.readFileSync(ruta, 'utf8')) };
}

module.exports = { verificarGolden, correrEscenario, escenariosDe };
