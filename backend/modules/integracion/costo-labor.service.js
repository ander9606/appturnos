'use strict';

const OfertasModel = require('../turnos/ofertas/ofertas.model');
const AsignacionesModel = require('../turnos/asignaciones/asignaciones.model');
const IntegracionService = require('./integracion.service');
const logger = require('../../utils/logger');

/**
 * Formatea horas decimales a "Xh YYmin" para el payload (spec 05-INTEGRACION).
 * Ej: 10.05 → "10h 03min".
 */
function formatearHoras(horasDecimal) {
  if (horasDecimal == null) return '0h 00min';
  const totalMinutos = Math.round(Number(horasDecimal) * 60);
  const h = Math.floor(totalMinutos / 60);
  const m = totalMinutos % 60;
  return `${h}h ${String(m).padStart(2, '0')}min`;
}

// Estados que se consideran "cerrados" para efectos del cálculo.
const TERMINALES = new Set(['completado', 'cancelado', 'no_presentado']);

const CostoLaborService = {
  /**
   * Si todos los contratos de una oferta están en estado terminal y al menos
   * uno se completó, emite `costo_labor.calculado` a logiq360 y marca la
   * oferta como `completada`.
   *
   * Idempotencia: una oferta ya en estado `completada` no vuelve a emitir.
   * Best-effort: si algo falla, se loguea pero no interrumpe el flujo
   * principal (típicamente el egreso del trabajador).
   *
   * Reglas:
   * - Solo emite si la oferta tiene `external_ref` (origen logiq360).
   * - Postulaciones en estado `pendiente` (nunca confirmadas) se ignoran.
   * - Si todas las asignaciones confirmadas terminaron canceladas/no presentadas
   *   (cero `completado`), no se emite — no hay costo a reportar.
   */
  async verificarYEmitir(empresaId, ofertaId) {
    try {
      const oferta = await OfertasModel.obtenerPorId(empresaId, ofertaId);
      if (!oferta) return;
      if (!oferta.external_ref) return;
      if (oferta.estado === 'completada') return;

      const asignaciones = await AsignacionesModel.listarConTrabajadorRef(
        empresaId,
        ofertaId
      );
      if (!asignaciones.length) return;

      // Las pendientes (postulaciones nunca confirmadas) no bloquean el cierre.
      const relevantes = asignaciones.filter((a) => a.estado !== 'pendiente');
      if (!relevantes.length) return;

      const todosTerminales = relevantes.every((a) => TERMINALES.has(a.estado));
      if (!todosTerminales) return;

      const completados = relevantes.filter((a) => a.estado === 'completado');
      if (!completados.length) return;

      const resumen = completados.map((a) => ({
        empleado_ref: a.trabajador_external_ref || null,
        empleado_nombre: `${a.trabajador_nombre} ${a.trabajador_apellido || ''}`.trim(),
        valor: Number(a.pago_total) || 0,
        horas: formatearHoras(a.horas_trabajadas),
      }));

      const totalPagado = completados.reduce(
        (sum, a) => sum + (Number(a.pago_total) || 0),
        0
      );

      await IntegracionService.emitir(empresaId, 'costo_labor.calculado', {
        external_ref: oferta.external_ref,
        alquiler_ref: oferta.alquiler_ref || null,
        total_pagado: totalPagado,
        total_trabajadores: completados.length,
        resumen,
      });

      // Marca la oferta como completada — actúa también como flag de idempotencia.
      await OfertasModel.cambiarEstado(empresaId, ofertaId, 'completada');

      logger.info(
        `[costo_labor] emitido para oferta ${ofertaId} (${completados.length} trabajadores, $${totalPagado})`
      );
    } catch (err) {
      logger.error(
        `[costo_labor] error verificando oferta ${ofertaId}: ${err.message}`
      );
    }
  },

  // Exportado para tests / uso fuera del flujo de egreso.
  formatearHoras,
};

module.exports = CostoLaborService;
