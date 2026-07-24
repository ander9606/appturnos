'use strict';

const OfertasModel = require('../turnos/ofertas/ofertas.model');
const AsignacionesModel = require('../turnos/asignaciones/asignaciones.model');
const IntegracionService = require('./integracion.service');
const logger = require('../../utils/logger');

const ACTIVAS = new Set(['confirmado', 'en_progreso', 'completado']);

const CoberturaService = {
  /**
   * Si todos los puestos de una oferta (originada en logiq360) llegaron a
   * plazas_cubiertas >= plazas, emite `oferta.cubierta` una sola vez.
   *
   * Se llama tras cada confirmación/asignación directa exitosa — idempotente
   * vía `cobertura_notificada` (mismo patrón que `alerta_personal_enviada`).
   * Best-effort: nunca debe interrumpir el flujo de confirmar/asignar.
   */
  async verificarYEmitir(empresaId, ofertaId) {
    try {
      const oferta = await OfertasModel.obtenerPorId(empresaId, ofertaId);
      if (!oferta) return;
      if (!oferta.external_ref) return;
      if (oferta.cobertura_notificada) return;
      if (!oferta.puestos || oferta.puestos.length === 0) return;

      const todoCubierto = oferta.puestos.every(
        (p) => Number(p.plazas_cubiertas) >= Number(p.plazas)
      );
      if (!todoCubierto) return;

      const cuposRequeridos = oferta.puestos.reduce((s, p) => s + Number(p.plazas || 0), 0);
      const cuposCubiertos = oferta.puestos.reduce((s, p) => s + Number(p.plazas_cubiertas || 0), 0);

      const asignaciones = await AsignacionesModel.listarConTrabajadorRef(empresaId, ofertaId);
      const trabajadores = asignaciones
        .filter((a) => ACTIVAS.has(a.estado))
        .map((a) => ({
          nombre: `${a.trabajador_nombre} ${a.trabajador_apellido || ''}`.trim(),
          external_ref: a.trabajador_external_ref || null,
          rol: a.cargo_codigo || null,
        }));

      await IntegracionService.emitir(empresaId, 'oferta.cubierta', {
        external_ref: oferta.external_ref,
        cupos_requeridos: cuposRequeridos,
        cupos_cubiertos: cuposCubiertos,
        trabajadores,
      });

      // Actúa también como flag de idempotencia.
      await OfertasModel.marcarCoberturaNotificada(empresaId, ofertaId);
    } catch (err) {
      logger.error(`[cobertura] error verificando oferta ${ofertaId}: ${err.message}`);
    }
  },
};

module.exports = CoberturaService;
