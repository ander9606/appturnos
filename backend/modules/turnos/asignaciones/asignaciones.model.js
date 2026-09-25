'use strict';

/**
 * Acceso a datos de asignaciones de turno (tabla asignaciones_turno).
 * `confirmar` abarca también ofertas_turno porque debe ajustar
 * plazas_cubiertas de forma atómica.
 *
 * La implementación está partida por responsabilidad — este archivo solo
 * agrega los métodos, la interfaz pública (`AsignacionesModel.metodo(...)`)
 * no cambia:
 *   - asignaciones.postulacion.model.js: máquina de estados (crear, confirmar,
 *     cancelar, rechazar, asignarDirecto, marcarNoPresentado, calificar).
 *   - asignaciones.marcaje.model.js: ingreso/egreso, geofence, sospechoso,
 *     cierre masivo y ajustes de pago.
 *   - asignaciones.consultas.model.js: lecturas y listados.
 *   - asignaciones.liquidacion.model.js: liquidación agrupada por trabajador.
 */
const postulacion = require('./asignaciones.postulacion.model');
const marcaje = require('./asignaciones.marcaje.model');
const consultas = require('./asignaciones.consultas.model');
const liquidacion = require('./asignaciones.liquidacion.model');

module.exports = {
  ...postulacion,
  ...marcaje,
  ...consultas,
  ...liquidacion,
};
