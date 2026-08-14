'use strict';

const LiquidacionModel = require('./liquidacion.model');
const PeriodosModel = require('../periodos/periodos.model');
const EmpresasModel = require('../../empresas/empresas.model');
const TrabajadoresModel = require('../../trabajadores/trabajadores.model');
const DescuentosModel = require('../descuentos/descuentos.model');
const AppError = require('../../../utils/AppError');
const { ROLES, HORAS_MES_NOMINA } = require('../../../config/constants');
const { valorHora, calcularPagoNomina, calcularDeducciones, calcularSubsidioTransporte } = require('../../../utils/laboralUtils');

function redondear(n) {
  return Math.round(n * 100) / 100;
}

const LiquidacionService = {
  /**
   * Resumen de liquidación de un período: una línea por trabajador con sus
   * horas acumuladas y el total a pagar según los recargos de ley.
   *
   * `usuario` es opcional: si es un trabajador_nomina, el resultado se filtra
   * a su propia línea únicamente — nunca ve la liquidación de sus compañeros.
   */
  async generar(empresaId, periodoId, usuario) {
    const periodo = await PeriodosModel.obtenerPorId(empresaId, periodoId);
    if (!periodo) throw new AppError('Período no encontrado', 404);

    let trabajadorId;
    if (usuario?.rol === ROLES.TRABAJADOR_NOMINA) {
      const trabajador = await TrabajadoresModel.obtenerPorUsuarioId(empresaId, usuario.sub);
      if (!trabajador) throw new AppError('Tu usuario no está vinculado a un trabajador activo', 403);
      trabajadorId = trabajador.id;
    }

    const tipoContrato = await EmpresasModel.obtenerTipoContrato(empresaId);
    const filas = await LiquidacionModel.resumenPorPeriodo(empresaId, periodoId, trabajadorId);

    // Descuentos manuales ya aceptados por el trabajador (préstamos, inasistencias, etc.)
    // — los pendientes/rechazados no afectan el neto, se gestionan aparte.
    const descuentosAceptados = await DescuentosModel.aceptadosPorPeriodo(empresaId, periodoId);
    const descuentosPorTrabajador = new Map();
    for (const d of descuentosAceptados) {
      const lista = descuentosPorTrabajador.get(d.trabajador_id) ?? [];
      lista.push({ id: d.id, tipo: d.tipo, motivo: d.motivo, monto: Number(d.monto) });
      descuentosPorTrabajador.set(d.trabajador_id, lista);
    }

    // Salario mínimo proporcional al período (salario_base es mensual / 30 días conv.)
    const diasPeriodo = Math.round(
      (new Date(periodo.fecha_fin + 'T12:00:00Z') - new Date(periodo.fecha_inicio + 'T12:00:00Z')) / 86_400_000
    ) + 1;

    let totalGeneral = 0;
    let totalNetoGeneral = 0;
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

      // Descuentos de ley: solo si la empresa contrata por nómina laboral.
      // Prestación de servicios se autoliquida — no calculamos ese descuento aquí.
      const deducciones = tipoContrato === 'laboral'
        ? calcularDeducciones(total)
        : { salud: 0, pension: 0, total: 0, neto: total };

      const otrosDescuentos = descuentosPorTrabajador.get(f.trabajador_id) ?? [];
      const otrosDescuentosTotal = redondear(otrosDescuentos.reduce((s, d) => s + d.monto, 0));
      const sueldo = redondear(deducciones.neto - otrosDescuentosTotal);

      // Auxilio de transporte: solo contrato laboral, no es IBC (no lleva descuentos).
      const subsidioTransporte = tipoContrato === 'laboral'
        ? redondear(calcularSubsidioTransporte(vh * HORAS_MES_NOMINA, diasPeriodo))
        : 0;
      const neto = redondear(sueldo + subsidioTransporte);

      totalGeneral += total;
      totalNetoGeneral += neto;

      return {
        trabajador_id: f.trabajador_id,
        nombre: f.nombre,
        apellido: f.apellido,
        cedula: f.cedula,
        banco: f.banco,
        tipo_cuenta: f.tipo_cuenta,
        numero_cuenta: f.numero_cuenta,
        dias_registrados: f.dias_registrados,
        ...desglose,
        valor_hora: redondear(vh),
        pago_por_horas: pagoPorHoras,
        salario_minimo_periodo: salarioMinPeriodo,
        ajuste_minimo: ajusteMinimo,
        total,
        descuento_salud: redondear(deducciones.salud),
        descuento_pension: redondear(deducciones.pension),
        otros_descuentos: otrosDescuentos,
        otros_descuentos_total: otrosDescuentosTotal,
        sueldo,
        subsidio_transporte: subsidioTransporte,
        neto,
      };
    });

    return {
      periodo,
      tipo_contrato: tipoContrato,
      lineas,
      totales: {
        trabajadores: lineas.length,
        total_general: redondear(totalGeneral),
        total_neto_general: redondear(totalNetoGeneral),
      },
    };
  },
};

module.exports = LiquidacionService;
