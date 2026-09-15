'use strict';

/**
 * Lógica de negocio de asignaciones de turno: notificaciones, validaciones
 * cross-módulo (traslapes entre empresas, geofence, contratos) y eventos a
 * logiq360, por encima de AsignacionesModel.
 *
 * La implementación está partida por responsabilidad — este archivo solo
 * agrega los métodos, la interfaz pública (`AsignacionesService.metodo(...)`)
 * no cambia:
 *   - asignaciones.postulacion.service.js: máquina de estados (confirmar,
 *     cancelar, rechazar, asignarDirecto, marcarNoPresentado, calificar).
 *   - asignaciones.marcaje.service.js: ingreso/egreso, geofence, sospechoso,
 *     corrección manual, cierre masivo y bono.
 *   - asignaciones.consultas.service.js: lecturas y listados.
 *   - asignaciones.liquidacion.service.js: liquidación por trabajador.
 *   - asignaciones.helpers.js: helpers privados compartidos entre submódulos
 *     (no forman parte de la interfaz pública).
 */
const postulacion = require('./asignaciones.postulacion.service');
const marcaje = require('./asignaciones.marcaje.service');
const consultas = require('./asignaciones.consultas.service');
const liquidacion = require('./asignaciones.liquidacion.service');

module.exports = {
  ...postulacion,
  ...marcaje,
  ...consultas,
  ...liquidacion,
};
