'use strict';

/**
 * Emergencia: recalcula los registros de UN trabajador desde una fecha hasta el
 * fin de su período abierto, con las reglas ACTUALES de calcularHoras().
 *
 * Caso de uso: un turno que cruza medianoche (dom 20:43 → lun 13:02) se liquidó
 * con el festivo del domingo aplicado también al lunes. Tras desplegar el fix de
 * laboralUtils.js, este script reescribe el desglose de esos registros.
 *
 * Reutiliza RegistrosGestionService.corregir() (igual que una corrección manual y
 * que reprocesarPeriodoAbierto): mismo cálculo, acumulado semanal en orden
 * cronológico y compensatorios idempotentes. Solo períodos ABIERTOS (en uno
 * cerrado corregir() responde 409 y ese registro se omite).
 *
 * Uso:
 *   node scripts/recalcular-registros-trabajador.js <empresaId> <trabajadorId> <desdeFecha YYYY-MM-DD> [usuarioId] [--dry-run]
 *
 * `usuarioId` es quien queda como aprobador; por defecto, un admin_empresa de la empresa.
 * --dry-run solo lista los registros que tocaría (no escribe nada).
 */

require('dotenv').config();
const { pool } = require('../config/database');
const RegistrosGestionService = require('../modules/nomina/registros/registros.gestion.service');

const FILA = (r) => `${r.fecha} ${r.hora_entrada ?? '—'}→${r.hora_salida ?? '—'}`;
const TOTALES = (r) =>
  `ord ${r.horas_ordinarias} · noc ${r.horas_nocturnas} · extD ${r.horas_extra_diurnas} · extN ${r.horas_extra_nocturnas} · fest ${r.horas_festivo}`;

async function main() {
  const [empresaId, trabajadorId, desde] = process.argv.slice(2, 5).map((v) => v);
  const usuarioArg = process.argv.slice(5).find((a) => !a.startsWith('--'));
  const dryRun = process.argv.includes('--dry-run');
  if (!Number(empresaId) || !Number(trabajadorId) || !/^\d{4}-\d{2}-\d{2}$/.test(desde || '')) {
    console.error('Uso: node scripts/recalcular-registros-trabajador.js <empresaId> <trabajadorId> <desde YYYY-MM-DD> [usuarioId] [--dry-run]');
    process.exit(1);
  }

  let usuarioId = Number(usuarioArg);
  if (!usuarioId) {
    const [[admin]] = await pool.query(
      "SELECT id FROM usuarios WHERE empresa_id = ? AND rol = 'admin_empresa' ORDER BY id LIMIT 1",
      [empresaId],
    );
    if (!admin) { console.error('No hay admin_empresa en esa empresa; pasa usuarioId.'); process.exit(1); }
    usuarioId = admin.id;
  }

  const [registros] = await pool.query(
    `SELECT r.id, DATE_FORMAT(r.fecha, '%Y-%m-%d') AS fecha, r.hora_entrada, r.hora_salida, r.sesiones, r.sesiones_detalle,
            r.horas_ordinarias, r.horas_nocturnas, r.horas_extra_diurnas, r.horas_extra_nocturnas, r.horas_festivo
     FROM registros_diarios r
     JOIN periodos_nomina p ON p.id = r.periodo_id AND p.estado = 'abierto'
     WHERE r.empresa_id = ? AND r.trabajador_id = ? AND r.fecha >= ?
     ORDER BY r.fecha ASC`,
    [empresaId, trabajadorId, desde],
  );

  if (!registros.length) { console.log('Sin registros en período abierto desde esa fecha.'); process.exit(0); }

  const usuario = { sub: usuarioId };
  let cambiados = 0;
  for (const r of registros) {
    if (!r.hora_entrada || (r.sesiones === 1 && !r.hora_salida)) {
      console.log(`  omitido  ${FILA(r)} (sin horario o jornada en curso)`);
      continue;
    }
    if (dryRun) { console.log(`  tocaría  ${FILA(r)} | ${TOTALES(r)}`); continue; }

    const sesiones = typeof r.sesiones_detalle === 'string' ? JSON.parse(r.sesiones_detalle) : r.sesiones_detalle;
    const datos = r.sesiones > 1
      ? { sesiones: [...(sesiones ?? []), { hora_entrada: r.hora_entrada, hora_salida: r.hora_salida }] }
      : {};
    try {
      const nuevo = await RegistrosGestionService.corregir(empresaId, usuario, r.id, datos, { notificar: false });
      const igual = TOTALES(nuevo) === TOTALES(r);
      if (!igual) cambiados++;
      console.log(`  ${igual ? 'sin cambio' : 'CORREGIDO'} ${FILA(r)}\n      antes:   ${TOTALES(r)}\n      después: ${TOTALES(nuevo)}`);
    } catch (err) {
      console.error(`  ERROR    ${FILA(r)}: ${err.message}`);
    }
  }

  console.log(dryRun ? '\n(--dry-run: nada se escribió)' : `\nListo. ${cambiados} registro(s) cambiaron.`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
