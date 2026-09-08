#!/usr/bin/env node
/**
 * Reparación puntual (2026-09-08): usuario 69 tiene dos identidades de
 * trabajador legítimas — 61 (empresa 3, "Auxiliar") y 114 (empresa 4, sin
 * cargo). Un bug ya corregido en ofertas.service.js (commit 563a743,
 * 2026-09-02: resolvía el trabajador con el empresa_id del JWT en vez del
 * dueño de la oferta) hizo que 10 postulaciones a ofertas de EMPRESA 3
 * quedaran enganchadas al trabajador 114 (empresa 4) en vez del 61.
 * Confirmado por diagnóstico: esas 10 filas tienen trabajador_id=114 pero
 * empresa_id=3 — inconsistente, ya que el resto de filas de 114 sí son de
 * empresa_id=4. Los otros 2 turnos genuinos de 114 (empresa 4) NO se tocan.
 *
 * No es un script genérico de "fusionar trabajadores" — es la reparación
 * de este incidente puntual. Uso: node scripts/reparar-trabajador-114-vs-61.js
 */
'use strict';

const { pool } = require('../config/database');
const { recalcularRankingStandalone } = require('../utils/rankingUtils');

const MARCA = 'reparar-trabajador-114-vs-61-2026-09';
const TRABAJADOR_INCORRECTO = 114;
const TRABAJADOR_CORRECTO = 61;
const EMPRESA_AFECTADA = 3;
const EMPRESA_LEGITIMA_114 = 4;

async function main() {
  const [[ya]] = await pool.query('SELECT 1 FROM _migraciones WHERE nombre = ? LIMIT 1', [MARCA]);
  if (ya) {
    console.log(`✓ Ya se ejecutó (${MARCA}). Nada que hacer.`);
    process.exit(0);
  }

  const [afectadas] = await pool.query(
    'SELECT id FROM asignaciones_turno WHERE trabajador_id = ? AND empresa_id = ?',
    [TRABAJADOR_INCORRECTO, EMPRESA_AFECTADA]
  );
  console.log(`Encontradas ${afectadas.length} asignaciones mal atribuidas:`, afectadas.map((a) => a.id));

  if (afectadas.length === 0) {
    console.log('Nada que reparar.');
    await pool.query('INSERT INTO _migraciones (nombre) VALUES (?)', [MARCA]);
    process.exit(0);
  }

  const [res] = await pool.query(
    'UPDATE asignaciones_turno SET trabajador_id = ? WHERE trabajador_id = ? AND empresa_id = ?',
    [TRABAJADOR_CORRECTO, TRABAJADOR_INCORRECTO, EMPRESA_AFECTADA]
  );
  console.log(`✓ Reasignadas ${res.affectedRows} asignaciones a trabajador ${TRABAJADOR_CORRECTO}`);

  const rankingCorrecto = await recalcularRankingStandalone(EMPRESA_AFECTADA, TRABAJADOR_CORRECTO);
  console.log(`✓ Ranking recalculado trabajador ${TRABAJADOR_CORRECTO} (empresa ${EMPRESA_AFECTADA}):`, rankingCorrecto);

  const rankingIncorrecto = await recalcularRankingStandalone(EMPRESA_LEGITIMA_114, TRABAJADOR_INCORRECTO);
  console.log(`✓ Ranking recalculado trabajador ${TRABAJADOR_INCORRECTO} (empresa ${EMPRESA_LEGITIMA_114}):`, rankingIncorrecto);

  await pool.query('INSERT INTO _migraciones (nombre) VALUES (?)', [MARCA]);
  console.log('✓ Reparación completada');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
