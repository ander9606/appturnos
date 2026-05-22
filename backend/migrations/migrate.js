'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

/**
 * Runner de migraciones.
 *
 * 1. Se conecta a MySQL SIN seleccionar base de datos.
 * 2. Crea la base de datos si no existe.
 * 3. Crea la tabla de control `_migraciones`.
 * 4. Aplica, en orden, los archivos .sql de ./sql que aún no se hayan
 *    ejecutado, y registra cada uno como aplicado.
 *
 * Es idempotente: ejecutarlo de nuevo solo aplica lo pendiente.
 *
 * Uso:  npm run migrate
 */

const DB_NAME = process.env.DB_NAME || 'app_turnos';
const DIR_SQL = path.join(__dirname, 'sql');

async function ejecutar() {
  // El runner usa su propia conexión (no el pool) para poder habilitar
  // multipleStatements y conectar sin base de datos seleccionada.
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  try {
    // 1-2. Crear la base de datos.
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`
       CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await conn.changeUser({ database: DB_NAME });
    logger.info(`Base de datos lista: ${DB_NAME}`);

    // 3. Tabla de control de migraciones.
    await conn.query(`
      CREATE TABLE IF NOT EXISTS _migraciones (
        id INT PRIMARY KEY AUTO_INCREMENT,
        nombre VARCHAR(255) NOT NULL UNIQUE,
        aplicada_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    const [filas] = await conn.query('SELECT nombre FROM _migraciones');
    const aplicadas = new Set(filas.map((f) => f.nombre));

    // 4. Archivos .sql ordenados por nombre (prefijo numérico).
    const archivos = fs
      .readdirSync(DIR_SQL)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let nuevas = 0;
    for (const archivo of archivos) {
      if (aplicadas.has(archivo)) {
        logger.debug(`· ${archivo} (ya aplicada)`);
        continue;
      }
      const sql = fs.readFileSync(path.join(DIR_SQL, archivo), 'utf8');
      logger.info(`Aplicando ${archivo}...`);
      await conn.query(sql);
      await conn.query('INSERT INTO _migraciones (nombre) VALUES (?)', [archivo]);
      nuevas++;
    }

    logger.info(
      nuevas > 0
        ? `Migraciones completadas: ${nuevas} nueva(s) aplicada(s).`
        : 'Sin migraciones pendientes; la base de datos está al día.'
    );
  } finally {
    await conn.end();
  }
}

ejecutar().catch((err) => {
  logger.error('Fallo en la migración:', err.message);
  process.exit(1);
});
