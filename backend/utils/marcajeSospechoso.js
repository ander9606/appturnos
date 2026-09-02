'use strict';

const { haversineMetros } = require('./geoUtils');

// Umbral compartido por nómina (registros_diarios) y turnos (asignaciones_turno):
// dos marcajes de trabajadores distintos, mismo dispositivo o a pocos metros,
// dentro de esta ventana de tiempo → posible "buddy punching".
const RADIO_METROS = 50;
const VENTANA_SEG = 5 * 60;

/**
 * Busca, entre candidatos {id, lat, lng, device} de OTROS trabajadores, uno que
 * matchee con el marcaje actual por AMBAS condiciones a la vez: mismo device_id
 * Y proximidad GPS. Cualquiera de las dos por separado tiene falsos positivos
 * razonables (mismo teléfono compartido legítimamente entre turnos distintos;
 * dos compañeros reales llegando juntos) — exigir las dos reduce el ruido.
 * @returns {object|null} el candidato que matchea, o null.
 */
function buscarMatch(candidatos, { latitud, longitud, deviceId }) {
  if (deviceId == null || latitud == null || longitud == null) return null;
  return candidatos.find((c) =>
    c.device === deviceId &&
    c.lat != null && c.lng != null &&
    haversineMetros(latitud, longitud, c.lat, c.lng) <= RADIO_METROS
  ) ?? null;
}

module.exports = { buscarMatch, RADIO_METROS, VENTANA_SEG };
