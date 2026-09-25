'use strict';

/**
 * Lógica de negocio de ofertas de turno: visibilidad (ranking, dirigidas,
 * multi-empresa), ciclo de vida gestionado por jefe/admin, y postulación del
 * trabajador.
 *
 * La implementación está partida por responsabilidad — este archivo solo
 * agrega los métodos, la interfaz pública (`OfertasService.metodo(...)`)
 * no cambia:
 *   - ofertas.gestion.service.js: ciclo de vida (crear, actualizar, publicar,
 *     cancelar, completar, eliminarDefinitivo, duplicar).
 *   - ofertas.consultas.service.js: lecturas (listar, obtener).
 *   - ofertas.postulacion.service.js: postulación del trabajador (aplicar,
 *     retirar).
 *   - ofertas.helpers.js: helpers privados compartidos entre submódulos
 *     (resolverTrabajador, validarAceptaExtras) — no forman parte de la
 *     interfaz pública.
 */
const gestion = require('./ofertas.gestion.service');
const consultas = require('./ofertas.consultas.service');
const postulacion = require('./ofertas.postulacion.service');

module.exports = {
  ...gestion,
  ...consultas,
  ...postulacion,
};
