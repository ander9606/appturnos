'use strict';

const AsignacionesModel = require('./asignaciones.model');

/**
 * Liquidación de turnos. Ver asignaciones.service.js para el resto de
 * AsignacionesService.
 */
module.exports = {
  async liquidacion(empresaId, { fecha_inicio, fecha_fin }) {
    return AsignacionesModel.liquidacion(empresaId, {
      fechaInicio: fecha_inicio,
      fechaFin:    fecha_fin,
    });
  },
};
