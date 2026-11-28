'use strict';

/**
 * Parte el registro 1260 (empresa 4, trabajador 622, 2026-11-22) en sus dos filas reales ahora
 * que corregir() soporta `sale_dia_siguiente` (PR #341). Antes de esto se corrigió a mano con
 * corregir-registro-1260.js (PR #340), que solo arregló el desglose de horas DENTRO de una sola
 * fila — el lunes seguía lumped en el registro del domingo.
 *
 * El lunes 23-nov es el primer día de una semana ISO nueva: su tope de 42h ordinarias arranca en
 * 0 (no sigue el acumulado casi agotado del domingo), así que el reparto ordinaria/extra de esa
 * porción puede salir distinto al de PR #340 — lo festivo del domingo no debería cambiar.
 *
 * Uso: node scripts/partir-registro-1260.js
 */

require('dotenv').config();
const RegistrosModel = require('../modules/nomina/registros/registros.model');
const RegistrosService = require('../modules/nomina/registros/registros.service');

const EMPRESA_ID = 4;
const REGISTRO_ID = 1260;

const TOTALES = (r) =>
  `ord ${r.horas_ordinarias} · noc ${r.horas_nocturnas} · extD ${r.horas_extra_diurnas} · extN ${r.horas_extra_nocturnas} · fest ${r.horas_festivo}`;

async function main() {
  const antes = await RegistrosModel.obtenerPorId(EMPRESA_ID, REGISTRO_ID);
  if (!antes) { console.error('Registro no encontrado'); process.exit(1); }
  console.log('antes (domingo, lumped):', TOTALES(antes));

  const [[admin]] = await require('../config/database').pool.query(
    "SELECT id FROM usuarios WHERE empresa_id = ? AND rol = 'admin_empresa' ORDER BY id LIMIT 1",
    [EMPRESA_ID],
  );
  if (!admin) { console.error('No hay admin_empresa en esa empresa'); process.exit(1); }

  await RegistrosService.corregir(EMPRESA_ID, { sub: admin.id }, REGISTRO_ID, {
    sesiones: [
      { hora_entrada: '10:16:14', hora_salida: '16:39:19' },
      { hora_entrada: '20:43:28', hora_salida: '13:02:09', sale_dia_siguiente: true },
    ],
  }, { notificar: false });

  const domingo = await RegistrosModel.obtenerPorId(EMPRESA_ID, REGISTRO_ID);
  const lunes = await RegistrosModel.obtenerPorFecha(EMPRESA_ID, antes.trabajador_id, '2026-11-23');
  console.log('después domingo (22):', TOTALES(domingo));
  console.log('después lunes    (23):', lunes ? TOTALES(lunes) : '(no se creó)');
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
