'use strict';

const logger = require('../../utils/logger');
const AppError = require('../../utils/AppError');

/**
 * Proxy hacia Nominatim (OpenStreetMap). Su política de uso exige ≤1 req/s y
 * un User-Agent que identifique la app (operations.osmfoundation.org/policies/nominatim).
 * Desde el cliente móvil eso no es viable: en Android, `fetch` no logra fijar
 * un User-Agent propio (OkHttp lo pisa con el suyo salvo que se registre un
 * interceptor nativo), así que Nominatim terminaba bloqueando con 403. El
 * backend es la única fuente de tráfico hacia Nominatim: manda el header
 * correcto, serializa a 1 req/s con una cola, y cachea para no repetir.
 */

const USER_AGENT = 'Zaturno/1.0 (+https://zaturno.app)';
const MIN_INTERVALO_MS = 1100;

let colaProm = Promise.resolve();
let ultimoEnvio = 0;

function encolar(fn) {
  const resultado = colaProm.then(async () => {
    const espera = Math.max(0, MIN_INTERVALO_MS - (Date.now() - ultimoEnvio));
    if (espera > 0) await new Promise((r) => setTimeout(r, espera));
    ultimoEnvio = Date.now();
    return fn();
  });
  // Un rechazo no debe colgar la cola para las peticiones siguientes.
  colaProm = resultado.catch(() => {});
  return resultado;
}

// ponytail: Map sin TTL, se resetea entera si crece demasiado — upgrade
// path: LRU real si el volumen de direcciones distintas lo justifica.
const CACHE_MAX = 500;
const cache = new Map();

function cachear(key, valor) {
  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(key, valor);
}

async function llamarNominatim(url) {
  const res = await fetch(url, {
    headers: { 'Accept-Language': 'es', 'User-Agent': USER_AGENT },
  });
  if (!res.ok) {
    logger.warn(`[geocoding] Nominatim respondió ${res.status} para ${url}`);
    throw new AppError('Servicio de mapas no disponible, intenta de nuevo', 502);
  }
  return res.json();
}

const GeocodingService = {
  async buscar(q) {
    const key = `s:${q.toLowerCase()}`;
    if (cache.has(key)) return cache.get(key);
    const data = await encolar(() =>
      llamarNominatim(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&countrycodes=co`)
    );
    cachear(key, data);
    return data;
  },

  async reverse(lat, lon) {
    // Redondea a ~11 m — suficiente para compartir caché entre marcajes
    // cercanos sin perder utilidad real de la dirección resuelta.
    const key = `r:${lat.toFixed(4)},${lon.toFixed(4)}`;
    if (cache.has(key)) return cache.get(key);
    const data = await encolar(() =>
      llamarNominatim(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
    );
    cachear(key, data);
    return data;
  },
};

module.exports = GeocodingService;
