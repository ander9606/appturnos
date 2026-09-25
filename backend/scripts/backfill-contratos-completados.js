#!/usr/bin/env node

/**
 * Backfill único: genera el contrato diario de turnos que quedaron
 * 'completado' sin pasar por confirmar()/asignarDirecto() (p. ej. corregidos
 * por un gestor o cerrados en masa antes del fix), y por eso nunca
 * aparecían en "sin firmar" aunque el turno ya estaba completo.
 *
 * Se registra en _migraciones bajo MARCA — si ya corrió, no vuelve a hacer nada.
 * Reintentar tras un fallo a mitad de camino es seguro: generarParaAsignacion
 * se salta cualquier asignación que ya tenga contrato.
 *
 * Uso: npm run backfill-contratos
 */

'use strict';

require('dotenv').config();
const { pool } = require('../config/database');
const ContratosService = require('../modules/contratos/contratos.service');

const MARCA = 'backfill-contratos-completados-2026-09';

async function main() {
  const [[ya]] = await pool.query('SELECT 1 FROM _migraciones WHERE nombre = ? LIMIT 1', [MARCA]);
  if (ya) {
    console.log(`✓ Ya se ejecutó (${MARCA}). Nada que hacer.`);
    process.exit(0);
  }

  const [pendientes] = await pool.query(`
    SELECT a.id, a.empresa_id
    FROM asignaciones_turno a
    LEFT JOIN contratos_diarios c ON c.asignacion_id = a.id
    WHERE a.estado = 'completado' AND c.id IS NULL
  `);

  if (pendientes.length === 0) {
    console.log('✓ No hay turnos completados sin contrato.');
    await pool.query('INSERT INTO _migraciones (nombre) VALUES (?)', [MARCA]);
    process.exit(0);
  }

  console.log(`📋 ${pendientes.length} turno(s) completado(s) sin contrato. Generando...\n`);

  let ok = 0;
  const fallos = [];
  for (const { id, empresa_id } of pendientes) {
    try {
      await ContratosService.generarParaAsignacion(empresa_id, id);
      ok++;
    } catch (err) {
      fallos.push({ id, motivo: err.message });
    }
  }

  console.log(`\n✓ Generados: ${ok}/${pendientes.length}`);
  if (fallos.length > 0) {
    console.log(`⚠ Fallidos (revisar manualmente):`);
    fallos.forEach((f) => console.log(`  asignacion ${f.id}: ${f.motivo}`));
  }

  // Se marca como ejecutado igual: los fallos son de datos (p. ej. salario
  // bajo el mínimo) y no se resuelven solos reintentando el script completo.
  await pool.query('INSERT INTO _migraciones (nombre) VALUES (?)', [MARCA]);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
