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
function respuestaGenerica() {
  const filas = [{ id: 1, empresa_id: 1, trabajador_id: 5, estado: 'confirmado', total: 1, promedio: null }];
  filas.insertId = 77;
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
async function correrEscenario(pool, llamar, falla, vacio = false) {
  const respuesta = vacio ? respuestaVacia : respuestaGenerica;
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

/** Todos los escenarios de un método: éxito, falla en cada consulta, begin, commit, rollback, getConnection. */
async function escenariosDe(pool, llamar) {
  const res = {};
  res.ok = await correrEscenario(pool, llamar, null);
  res.ok_respuestas_vacias = await correrEscenario(pool, llamar, null, true);
  const n = res.ok.consultas;
  for (let k = 0; k < n; k++) res[`falla_consulta_${k}`] = await correrEscenario(pool, llamar, { query: k });
  res.falla_begin = await correrEscenario(pool, llamar, { tipo: 'begin' });
  res.falla_commit = await correrEscenario(pool, llamar, { tipo: 'commit' });
  res.falla_rollback = await correrEscenario(pool, llamar, { tipo: 'rollback' });
  res.falla_getConnection = await correrEscenario(pool, llamar, { tipo: 'getConnection' });
  return res;
}

/** Corre todos los casos { nombre: () => promesa } y compara con (o escribe) el golden. */
async function verificarGolden(pool, casos, archivoGolden) {
  const actual = {};
  for (const [nombre, llamar] of Object.entries(casos)) actual[nombre] = await escenariosDe(pool, llamar);
  const ruta = path.join(__dirname, '..', 'fixtures', archivoGolden);
  if (process.env.UPDATE_GOLDEN === '1') {
    fs.writeFileSync(ruta, JSON.stringify(actual, null, 1) + '\n');
    return { escrito: true, actual };
  }
  return { escrito: false, actual, golden: JSON.parse(fs.readFileSync(ruta, 'utf8')) };
}

module.exports = { verificarGolden, correrEscenario, escenariosDe };
