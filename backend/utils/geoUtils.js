'use strict';

const EARTH_RADIUS_M = 6_371_000;

/**
 * Distancia entre dos coordenadas GPS usando la fórmula de Haversine.
 * @returns distancia en metros
 */
function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Verifica si (lat, lng) está dentro del radio de alguno de los puntos dados.
 * @param {number} lat
 * @param {number} lng
 * @param {Array<{latitud, longitud, radio_metros}>} puntos
 * @returns {{ ok: boolean, punto?: object, distanciaM?: number }}
 */
function estaEnAlgunPunto(lat, lng, puntos) {
  for (const p of puntos) {
    const dist = haversineMetros(lat, lng, p.latitud, p.longitud);
    if (dist <= p.radio_metros) {
      return { ok: true, punto: p, distanciaM: Math.round(dist) };
    }
  }
  return { ok: false };
}

// Alias interno
function haversineMetros(lat1, lng1, lat2, lng2) {
  return haversineMeters(lat1, lng1, lat2, lng2);
}

module.exports = { haversineMeters, haversineMetros, estaEnAlgunPunto };
