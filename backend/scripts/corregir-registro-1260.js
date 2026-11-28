'use strict';

/**
 * Corrección puntual del registro 1260 (empresa 4, trabajador 622, 2026-11-22): tiene 2
 * sesiones ese día (10:16→16:39 y 20:43→13:02 del lunes) que en total pasan de 24 h, así que
 * validarSesiones() las rechaza (guarda anti-typo, ver sesionesUtils.test.js) y corregir() no
 * se puede usar. Las sesiones ya están confirmadas correctas a mano — este script hace EL MISMO
 * cálculo que corregir() haría (calcularHorasSesiones + acumulado semanal real vía
 * sumarOrdinariasEnSemana/contextoFestivo) sin pasar por esa validación, y solo para este
 * registro. No usar como plantilla genérica: el fix de fondo (flag explícito de "cruza al día
 * siguiente", como ofertas_turno.fin_dia_siguiente) queda pendiente como mejora aparte.
 *
 * Uso: node scripts/corregir-registro-1260.js [--dry-run]
 */

require('dotenv').config();
const { pool } = require('../config/database');
const RegistrosModel = require('../modules/nomina/registros/registros.model');
const PeriodosModel = require('../modules/nomina/periodos/periodos.model');
const { contextoFestivo, getLunesDeSemana } = require('../modules/nomina/registros/registros.helpers');
const { calcularHorasSesiones } = require('../utils/sesionesUtils');

const EMPRESA_ID = 4;
const REGISTRO_ID = 1260;

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const registro = await RegistrosModel.obtenerPorId(EMPRESA_ID, REGISTRO_ID);
  if (!registro) { console.error('Registro no encontrado'); process.exit(1); }

  const periodo = await PeriodosModel.obtenerPorId(EMPRESA_ID, registro.periodo_id);
  if (periodo.estado !== 'abierto') { console.error('El período ya no está abierto'); process.exit(1); }

  const sesionesPrevias = registro.sesiones_detalle ?? [];
  const sesiones = [...sesionesPrevias, { hora_entrada: registro.hora_entrada, hora_salida: registro.hora_salida }];

  const lunes = getLunesDeSemana(registro.fecha);
  const { ordinarias: ordinariasAcum } =
    await RegistrosModel.sumarOrdinariasEnSemana(EMPRESA_ID, registro.trabajador_id, lunes, registro.fecha);
  const { sumarNocturnasFestivo, recargoFestivo } = await contextoFestivo(EMPRESA_ID, registro.trabajador_id, registro.fecha);

  const horas = calcularHorasSesiones({
    sesiones, fecha: registro.fecha, ordinariasAcum,
    jornadaContinua: Boolean(registro.jornada_continua), recargoFestivo, sumarNocturnasFestivo,
  });

  console.log('antes:   ', {
    horas_ordinarias: registro.horas_ordinarias, horas_nocturnas: registro.horas_nocturnas,
    horas_extra_diurnas: registro.horas_extra_diurnas, horas_extra_nocturnas: registro.horas_extra_nocturnas,
    horas_festivo: registro.horas_festivo, es_festivo: registro.es_festivo,
  });
  console.log('después: ', horas);

  if (dryRun) { console.log('\n(--dry-run: nada se escribió)'); process.exit(0); }

  const [[admin]] = await pool.query(
    "SELECT id FROM usuarios WHERE empresa_id = ? AND rol = 'admin_empresa' ORDER BY id LIMIT 1",
    [EMPRESA_ID],
  );
  if (!admin) { console.error('No hay admin_empresa en esa empresa'); process.exit(1); }

  const filas = await RegistrosModel.actualizar(EMPRESA_ID, REGISTRO_ID, {
    hora_entrada: registro.hora_entrada,
    hora_salida: registro.hora_salida,
    horas_ordinarias: horas.horas_ordinarias,
    horas_extra_diurnas: horas.horas_extra_diurnas,
    horas_extra_nocturnas: horas.horas_extra_nocturnas,
    horas_nocturnas: horas.horas_nocturnas,
    horas_festivo: horas.horas_festivo,
    es_festivo: horas.es_festivo,
    novedad: registro.novedad,
    tipo_dia: registro.tipo_dia,
    aprobado_por: admin.id,
    jornada_continua: Boolean(registro.jornada_continua),
    horas_acumuladas_semana: ordinariasAcum,
  });
  console.log(`\nFilas actualizadas: ${filas}`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
