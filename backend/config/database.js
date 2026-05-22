'use strict';

const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

/**
 * Pool de conexiones MySQL compartido por toda la app.
 * Se usa mysql2/promise para soportar async/await en los modelos.
 */
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'app_turnos',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  dateStrings: true, // devuelve DATE/DATETIME como string, evita desfases de zona horaria
});

/**
 * Verifica la conectividad con la base de datos al arrancar.
 * Lanza si no puede conectar, para no levantar el server con la DB caída.
 */
async function verificarConexion() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
    logger.info(`DB conectada: ${process.env.DB_NAME || 'app_turnos'}`);
  } finally {
    conn.release();
  }
}

module.exports = { pool, verificarConexion };
