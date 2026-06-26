'use strict';

const LiquidacionModel = require('./liquidacion.model');
const PeriodosModel = require('../periodos/periodos.model');
const AppError = require('../../../utils/AppError');
const { valorHora, calcularPagoNomina } = require('../../../utils/laboralUtils');

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

    // Salario mínimo proporcional al período (salario_base es mensual / 30 días conv.)
    const diasPeriodo = Math.round(
      (new Date(periodo.fecha_fin + 'T12:00:00Z') - new Date(periodo.fecha_inicio + 'T12:00:00Z')) / 86_400_000
    ) + 1;

    let totalGeneral = 0;
    const lineas = filas.map((f) => {
      const desglose = {
        horas_ordinarias: Number(f.horas_ordinarias) || 0,
        horas_extra_diurnas: Number(f.horas_extra_diurnas) || 0,
        horas_extra_nocturnas: Number(f.horas_extra_nocturnas) || 0,
        horas_nocturnas: Number(f.horas_nocturnas) || 0,
        horas_festivo: Number(f.horas_festivo) || 0,
      };
      const vh = f.valor_hora_snapshot != null
        ? Number(f.valor_hora_snapshot)
        : valorHora(f);
      const pagoPorHoras = redondear(calcularPagoNomina(desglose, vh));

      // Garantía: el trabajador no puede ganar menos que su salario proporcional al período.
      const salarioMinPeriodo = redondear(Number(f.salario_base) / 30 * diasPeriodo);
      const ajusteMinimo      = Math.max(0, redondear(salarioMinPeriodo - pagoPorHoras));
      const total             = redondear(pagoPorHoras + ajusteMinimo);

      totalGeneral += total;

      return {
        trabajador_id: f.trabajador_id,
        nombre: f.nombre,
        apellido: f.apellido,
        cedula: f.cedula,
        dias_registrados: f.dias_registrados,
        ...desglose,
        valor_hora: redondear(vh),
        pago_por_horas: pagoPorHoras,
        salario_minimo_periodo: salarioMinPeriodo,
        ajuste_minimo: ajusteMinimo,
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
