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
const { calcularHoras, valorHora, calcularPagoNomina } = require('../utils/laboralUtils');

const dryRun = process.argv[2] === 'dry-run';

async function main() {
  console.log(`\nRecalculando pagos de turnos completados... (${dryRun ? 'DRY RUN' : 'REAL'})\n`);

  try {
    // Obtener todos los turnos completados con pago_total NULL o 0
    const [turnos] = await pool.query(`
      SELECT
        a.id, a.empresa_id, a.trabajador_id, a.oferta_id,
        a.hora_ingreso_real, a.hora_egreso_real, a.pago_total,
        o.fecha AS oferta_fecha,
        t.tarifa_hora, t.salario_base
      FROM asignaciones_turno a
      JOIN ofertas_turno o ON o.id = a.oferta_id
      JOIN trabajadores t ON t.id = a.trabajador_id
      WHERE a.estado = 'completado'
        AND a.hora_ingreso_real IS NOT NULL
        AND a.hora_egreso_real IS NOT NULL
        AND (a.pago_total IS NULL OR a.pago_total = 0)
      ORDER BY a.id DESC
      LIMIT 1000
    `);

    console.log(`Encontrados ${turnos.length} turnos con pago_total sin calcular\n`);

    if (turnos.length === 0) {
      console.log('✓ No hay turnos para recalcular');
      process.exit(0);
    }

    const extractTime = (dt) => {
      const s = dt instanceof Date ? dt.toISOString() : String(dt);
      return s.slice(11, 19);
    };

    let actualizados = 0;
    let errores = 0;

    for (const turno of turnos) {
      try {
        const desglose = calcularHoras({
          horaEntrada: extractTime(turno.hora_ingreso_real),
          horaSalida: extractTime(turno.hora_egreso_real),
          fecha: turno.oferta_fecha,
        });

        const vhora = turno.tarifa_hora
          ? Number(turno.tarifa_hora)
          : turno.salario_base
          ? Number(turno.salario_base) / 240 // HORAS_MES_NOMINA
          : 0;

        if (vhora <= 0) {
          console.log(
            `⚠️  Asignación ${turno.id} (empresa ${turno.empresa_id}): ` +
            `tarifa_hora y salario_base no configurados`
          );
          errores++;
          continue;
        }

        const pagoTotal = calcularPagoNomina(desglose, vhora);
        console.log(
          `✓ Asignación ${turno.id}: pago $${pagoTotal.toLocaleString('es-CO')} ` +
          `(${desglose.horas_ordinarias.toFixed(1)}h ordinarias)`
        );

        if (!dryRun) {
          await pool.query(
            'UPDATE asignaciones_turno SET pago_total = ? WHERE id = ?',
            [pagoTotal, turno.id]
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
