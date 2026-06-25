'use strict';

/**
 * Barrel de re-exports — mantiene retrocompatibilidad con importadores externos
 * (integracion.worker.js, costo-labor.service.js, asignaciones.service.js, etc.).
 * La lógica real vive en services/*.service.js.
 */
const ConfiguracionService = require('./services/configuracion.service');
const ConciliacionService  = require('./services/conciliacion.service');
const EntrantesService     = require('./services/entrantes.service');
const SalientesService     = require('./services/salientes.service');

module.exports = {
  ...ConfiguracionService,
  ...ConciliacionService,
  ...EntrantesService,
  ...SalientesService,
};
