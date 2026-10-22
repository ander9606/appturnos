'use strict';

const { pool } = require('../config/database');

/**
 * Corre fn(conn) dentro de una transacción propia: commit si termina, rollback si lanza
 * (o si falla el commit), y la conexión siempre vuelve al pool. Devuelve lo que devuelva fn.
 */
async function enTransaccion(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const resultado = await fn(conn);
    await conn.commit();
    return resultado;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { enTransaccion };
