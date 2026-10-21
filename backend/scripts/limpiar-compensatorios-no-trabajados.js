'use strict';

/**
 * Borra descansos_compensatorios creados por error para un domingo/festivo
 * que NO se trabajó (tipo_dia != 'ordinario' en el registro de origen —
 * descanso, vacación, licencia, incapacidad o ausencia). Bug: antes de este
 * fix, CompensatoriosService.crearSiCorresponde() no miraba tipo_dia, solo
 * si la fecha era domingo/festivo — ver registros.gestion.service.js,
 * registros.marcaje.service.js y compensatorios.service.js.
 *
 * Uso:
 *   node scripts/limpiar-compensatorios-no-trabajados.js <empresaId> [--dry-run]
 *   node scripts/limpiar-compensatorios-no-trabajados.js --todas [--dry-run]
 */

require('dotenv').config();
const { pool } = require('../config/database');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const todas = process.argv.includes('--todas');
  const empresaId = todas ? null : Number(process.argv[2]);
  if (!todas && !empresaId) {
    console.error('Uso: node scripts/limpiar-compensatorios-no-trabajados.js <empresaId> [--dry-run]');
    console.error('  o: node scripts/limpiar-compensatorios-no-trabajados.js --todas [--dry-run]');
    process.exit(1);
  }

  const [filas] = await pool.query(
    `SELECT dc.id, dc.empresa_id, dc.trabajador_id, dc.origen_fecha, dc.clasificacion, dc.estado,
            r.tipo_dia, r.id AS registro_id
     FROM descansos_compensatorios dc
     JOIN registros_diarios r ON r.id = dc.origen_registro_id
     WHERE r.tipo_dia != 'ordinario'
       ${todas ? '' : 'AND dc.empresa_id = ?'}
     ORDER BY dc.empresa_id, dc.trabajador_id, dc.origen_fecha`,
    todas ? [] : [empresaId]
  );

  if (filas.length === 0) {
    console.log('Sin compensatorios mal generados (ninguno con tipo_dia != ordinario).');
    process.exit(0);
  }

  console.log(`${filas.length} compensatorio(s) a borrar:\n`);
  for (const f of filas) {
    console.log(
      `  id=${f.id} empresa=${f.empresa_id} trabajador=${f.trabajador_id} fecha=${f.origen_fecha} ` +
      `tipo_dia=${f.tipo_dia} clasificacion=${f.clasificacion} estado=${f.estado}` +
      (f.estado !== 'pendiente' ? '  ⚠ ya asignado/tomado — revisar antes de borrar' : '')
    );
  }

  if (dryRun) {
    console.log('\n(--dry-run: nada se borró, corre sin esa bandera para aplicar)');
    process.exit(0);
  }

  const ids = filas.map((f) => f.id);
  await pool.query('DELETE FROM descansos_compensatorios WHERE id IN (?)', [ids]);
  console.log(`\nBorrados ${ids.length} compensatorio(s).`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
