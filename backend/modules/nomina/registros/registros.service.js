'use strict';

// RegistrosService se reparte por responsabilidad, igual que asignaciones y ofertas: cada sub-service es un
// archivo y esta fachada los reúne para que controllers y otros services sigan usando `RegistrosService.xxx`.
const gestion = require('./registros.gestion.service');
const marcaje = require('./registros.marcaje.service');
const reingreso = require('./registros.reingreso.service');

module.exports = {
  ...gestion,
  ...marcaje,
  ...reingreso,
};
