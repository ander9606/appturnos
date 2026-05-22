'use strict';

const LiquidacionModel = require('./liquidacion.model');
const PeriodosModel = require('../periodos/periodos.model');
const AppError = require('../../../utils/AppError');
const { RECARGOS, HORAS_MES_NOMINA } = require('../../../config/constants');

/**
 * Valor de la hora ordinaria del trabajador. Para track Turnos suele venir
 * `tarifa_hora`; para track Nómina se deriva del salario mensual.
 */
function valorHoraDe(trabajador) {
  if (trabajador.tarifa_hora != null) return Number(trabajador.tarifa_hora);
  if (trabajador.salario_base != null) {
    return Number(trabajador.salario_base) / HORAS_MES_NOMINA;
  }
  return 0;
}

function redondear(n) {
  return Math.round(n * 100) / 100;
}

const LiquidacionService = {
  /**
   * Resumen de liquidación de un período: una línea por trabajador con sus
   * horas acumuladas y el total a pagar según los recargos de ley.
   */
  async generar(empresaId, periodoId) {
    const periodo = await PeriodosModel.obtenerPorId(empresaId, periodoId);
    if (!periodo) throw new AppError('Período no encontrado', 404);

    const filas = await LiquidacionModel.resumenPorPeriodo(empresaId, periodoId);

    let totalGeneral = 0;
    const lineas = filas.map((f) => {
      const ord = Number(f.horas_ordinarias) || 0;
      const extraDiurnas = Number(f.horas_extra_diurnas) || 0;
      const extraNocturnas = Number(f.horas_extra_nocturnas) || 0;
      const nocturnas = Number(f.horas_nocturnas) || 0;
      const festivo = Number(f.horas_festivo) || 0;
      const valorHora = valorHoraDe(f);

      // Las horas ordinarias se pagan a 1.0; el resto aplica su recargo.
      const total = redondear(
        valorHora *
          (ord +
            RECARGOS.NOCTURNA * nocturnas +
            RECARGOS.EXTRA_DIURNA * extraDiurnas +
            RECARGOS.EXTRA_NOCTURNA * extraNocturnas +
            RECARGOS.FESTIVO_DIURNO * festivo)
      );
      totalGeneral += total;

      return {
        trabajador_id: f.trabajador_id,
        nombre: f.nombre,
        apellido: f.apellido,
        cedula: f.cedula,
        dias_registrados: f.dias_registrados,
        horas_ordinarias: ord,
        horas_extra_diurnas: extraDiurnas,
        horas_extra_nocturnas: extraNocturnas,
        horas_nocturnas: nocturnas,
        horas_festivo: festivo,
        valor_hora: redondear(valorHora),
        total,
      };
    });

    return {
      periodo,
      lineas,
      totales: { trabajadores: lineas.length, total_general: redondear(totalGeneral) },
    };
  },
};

module.exports = LiquidacionService;
