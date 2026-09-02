#!/usr/bin/env node

/**
 * Script para identificar y limpiar períodos vacíos (sin registros_diarios).
 *
 * Uso:
 *   npm run limpiar-periodos-vacios        # Mostrar períodos vacíos
 *   npm run limpiar-periodos-vacios delete # Eliminar períodos vacíos
 */

'use strict';

const { pool } = require('../config/database');

async function main() {
  const accion = process.argv[2];

  try {
    // Encontrar períodos vacíos (sin registros_diarios)
    const [periodosVacios] = await pool.query(`
      SELECT
        pn.id,
        pn.empresa_id,
        pn.fecha_inicio,
        pn.fecha_fin,
        pn.tipo,
        pn.estado,
        pn.created_at,
        COUNT(rd.id) AS registros
      FROM periodos_nomina pn
      LEFT JOIN registros_diarios rd ON rd.periodo_id = pn.id
      GROUP BY pn.id
      HAVING COUNT(rd.id) = 0
      ORDER BY pn.created_at DESC
    `);

    if (periodosVacios.length === 0) {
      console.log('✓ No hay períodos vacíos.');
      process.exit(0);
    }

    console.log(`\n📋 Encontrados ${periodosVacios.length} período(s) vacío(s):\n`);
    periodosVacios.forEach((p, i) => {
      console.log(`  ${i + 1}. [ID: ${p.id}] ${p.fecha_inicio} → ${p.fecha_fin} (${p.tipo}, ${p.estado}) - Creado: ${p.created_at}`);
    });

    if (accion === 'delete') {
      const ids = periodosVacios.map(p => p.id);
      const result = await pool.query(
        `DELETE FROM periodos_nomina WHERE id IN (${ids.join(',')})`,
        []
      );
      console.log(`\n✓ Eliminados ${result[0].affectedRows} período(s) vacío(s).`);
    } else {
      console.log(`\n💡 Ejecuta con 'delete' para eliminarlos: npm run limpiar-periodos-vacios delete`);
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
