'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

const DB_NAME = process.env.DB_NAME || 'app_turnos';

async function reset() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  try {
    logger.info(`Eliminando base de datos ${DB_NAME}...`);
    await conn.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\``);
    logger.info('Base de datos eliminada. Ejecuta npm run migrate para recrearla.');
  } catch (err) {
    logger.error('Error al reiniciar la base de datos:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

reset();
