#!/usr/bin/env node
/**
 * Script para recalcular pago_total en asignaciones completadas
 * que tengan valores NULL o 0 (turnos creados antes del fix).
 *
 * Uso:
 *   node backend/scripts/recalcular-pagos-turnos.js [dry-run]
 *
 * Parámetros:
 *   dry-run: Si se pasa este parámetro, solo muestra qué se actualizaría sin hacer cambios
 */
'use strict';

const { pool } = require('../config/database');

const dryRun = process.argv[2] === 'dry-run';

async function main() {
  console.log(`\nRecalculando pagos de turnos completados... (${dryRun ? 'DRY RUN' : 'REAL'})\n`);

  try {
    // Obtener todos los turnos completados con pago_total NULL o 0.
    // pago_total es la tarifa del PUESTO al que postuló el trabajador (mismo
    // criterio que registrarEgreso/cerrarMasivo y que contratos_diarios.valor_dia)
    // — no un valor hora/salario, que pertenece al modelo de nómina tradicional
    // y no aplica a trabajadores del marketplace de turnos.
    const [turnos] = await pool.query(`
      SELECT a.id, a.empresa_id, p.tarifa_dia
      FROM asignaciones_turno a
      JOIN oferta_puestos p ON p.id = a.puesto_id
      WHERE a.estado = 'completado'
        AND (a.pago_total IS NULL OR a.pago_total = 0)
      ORDER BY a.id DESC
      LIMIT 1000
    `);

    console.log(`Encontrados ${turnos.length} turnos con pago_total sin calcular\n`);

    if (turnos.length === 0) {
      console.log('✓ No hay turnos para recalcular');
      process.exit(0);
    }

    let actualizados = 0;
    let errores = 0;

    for (const turno of turnos) {
      try {
        if (!turno.tarifa_dia || Number(turno.tarifa_dia) <= 0) {
          console.log(`⚠️  Asignación ${turno.id} (empresa ${turno.empresa_id}): tarifa_dia del puesto no configurada`);
          errores++;
          continue;
        }

        console.log(`✓ Asignación ${turno.id}: pago $${Number(turno.tarifa_dia).toLocaleString('es-CO')}`);

        if (!dryRun) {
          await pool.query(
            'UPDATE asignaciones_turno SET pago_total = ? WHERE id = ?',
            [turno.tarifa_dia, turno.id]
          );
        }
        actualizados++;
      } catch (err) {
        console.error(`✗ Error en asignación ${turno.id}:`, err.message);
        errores++;
      }
    }

    console.log(
      `\n${dryRun ? '[DRY RUN] ' : ''}Se habrían actualizado ${actualizados} asignaciones ` +
      `(${errores} errores)\n`
    );

    if (actualizados > 0 && !dryRun) {
      console.log('✓ Actualización completada\n');
    }

    process.exit(errores > 0 ? 1 : 0);
  } catch (err) {
    console.error('Error en script:', err);
    process.exit(1);
  }
}

main();
