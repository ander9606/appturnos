'use strict';

/**
 * Recalcula, en orden cronológico real, si cada domingo trabajado por cada
 * trabajador de una empresa fue ocasional (<=2 en el mes calendario, Art. 180
 * CST — sin recargo) o habitual (3+, Art. 181 — con recargo), y corrige
 * horas_ordinarias/horas_festivo del registro y clasificacion del
 * compensatorio asociado para que coincidan.
 *
 * Pensado para datos sembrados por los scripts de seed (seed.js,
 * seed-plataforma-turnos.js, seed-datos-prueba.js), que insertan
 * registros_diarios festivos directo por SQL sin pasar por
 * registros.service.js#clasificarDiaFestivo — por eso pueden quedar todos
 * marcados con recargo sin importar cuál domingo del mes era para ese
 * trabajador.
 *
 * Uso:
 *   node scripts/reclasificar-domingos.js <empresaId> [--dry-run]
 */

require('dotenv').config();
const { pool } = require('../config/database');

async function main() {
  const empresaId = Number(process.argv[2]);
  const dryRun = process.argv.includes('--dry-run');
  if (!empresaId) {
    console.error('Uso: node scripts/reclasificar-domingos.js <empresaId> [--dry-run]');
    process.exit(1);
  }

  const [domingos] = await pool.query(
    `SELECT id, trabajador_id, fecha, horas_ordinarias, horas_festivo
     FROM registros_diarios
     WHERE empresa_id = ? AND DAYOFWEEK(fecha) = 1 AND hora_salida IS NOT NULL
       AND (horas_ordinarias + horas_extra_diurnas + horas_extra_nocturnas + horas_nocturnas + horas_festivo) > 0
     ORDER BY trabajador_id, fecha ASC`,
    [empresaId]
  );

  if (domingos.length === 0) {
    console.log(`Sin domingos trabajados para la empresa ${empresaId}.`);
    process.exit(0);
  }

  const conteoPorTrabajadorMes = new Map(); // `${trabajador_id}-${YYYY-MM}` -> cuántos domingos van

  for (const r of domingos) {
    const mesKey = `${r.trabajador_id}-${r.fecha.slice(0, 7)}`;
    const numeroDomingo = (conteoPorTrabajadorMes.get(mesKey) || 0) + 1;
    conteoPorTrabajadorMes.set(mesKey, numeroDomingo);

    const clasificacion = numeroDomingo >= 3 ? 'habitual' : 'ocasional';
    const horasTrabajadas = Number(r.horas_ordinarias) + Number(r.horas_festivo);
    const nuevo = clasificacion === 'habitual'
      ? { horas_ordinarias: 0, horas_festivo: horasTrabajadas }
      : { horas_ordinarias: horasTrabajadas, horas_festivo: 0 };

    const cambia = Number(r.horas_festivo) !== nuevo.horas_festivo;
    console.log(
      `trabajador ${r.trabajador_id} · ${r.fecha} · domingo #${numeroDomingo} del mes → ${clasificacion}` +
      (cambia ? '  [CAMBIA]' : '  [ya estaba bien]')
    );

    if (!dryRun && cambia) {
      await pool.query(
        `UPDATE registros_diarios SET horas_ordinarias = ?, horas_festivo = ? WHERE id = ?`,
        [nuevo.horas_ordinarias, nuevo.horas_festivo, r.id]
      );
      const [res] = await pool.query(
        `UPDATE descansos_compensatorios SET clasificacion = ? WHERE empresa_id = ? AND origen_registro_id = ?`,
        [clasificacion, empresaId, r.id]
      );
      if (res.affectedRows === 0) {
        console.log(`  (sin descanso compensatorio asociado a este registro — solo se corrigieron las horas)`);
      }
    }
  }

  console.log(dryRun ? '\n(--dry-run: nada se escribió, corre sin esa bandera para aplicar)' : '\nListo.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
