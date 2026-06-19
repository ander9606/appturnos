'use strict';

/**
 * Script de corrección única (one-shot).
 *
 * Los archivos 010_valor_hora_snapshot.sql y 016_nomina_tipo_marcacion.sql
 * fueron renombrados a 010b_* y 016b_* para eliminar prefijos duplicados.
 * Las BDs existentes tienen los nombres viejos en _migraciones; este script
 * los actualiza para que el runner no los vuelva a aplicar.
 *
 * Ejecutar UNA sola vez por BD afectada:
 *   node backend/scripts/fix-migration-names.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

const RENOMBRES = [
  ['010_valor_hora_snapshot.sql',  '010b_valor_hora_snapshot.sql'],
  ['016_nomina_tipo_marcacion.sql', '016b_nomina_tipo_marcacion.sql'],
];

async function corregir() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     Number(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'app_turnos',
  });

  try {
    for (const [viejo, nuevo] of RENOMBRES) {
      const [res] = await conn.query(
        'UPDATE _migraciones SET nombre = ? WHERE nombre = ?',
        [nuevo, viejo]
      );
      if (res.affectedRows > 0) {
        logger.info(`Renombrado: "${viejo}" → "${nuevo}"`);
      } else {
        logger.debug(`Sin cambio (no encontrado o ya actualizado): "${viejo}"`);
      }
    }
    logger.info('Corrección completada.');
  } finally {
    await conn.end();
  }
}

corregir().catch((err) => {
  logger.error('Error en fix-migration-names:', err.message);
  process.exit(1);
});
