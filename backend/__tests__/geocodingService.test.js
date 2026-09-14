'use strict';

// GeocodingService cachea, serializa a ~1 req/s hacia Nominatim, y un fallo
// de una consulta no debe dejar la cola trabada para las siguientes.

beforeEach(() => {
  jest.resetModules();
  global.fetch = jest.fn();
});

describe('GeocodingService', () => {
  test('cachea resultados: la segunda consulta igual no vuelve a llamar a fetch', async () => {
    const GeocodingService = require('../modules/geocoding/geocoding.service');
    global.fetch.mockResolvedValue({ ok: true, json: async () => [{ place_id: 1 }] });

    await GeocodingService.buscar('parque central');
    await GeocodingService.buscar('parque central');

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('un fallo de Nominatim no traba la cola: la siguiente consulta sigue funcionando', async () => {
    const GeocodingService = require('../modules/geocoding/geocoding.service');
    global.fetch
      .mockResolvedValueOnce({ ok: false, status: 403 })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ place_id: 2 }] });

    await expect(GeocodingService.buscar('a')).rejects.toThrow();
    const data = await GeocodingService.buscar('b');

    expect(data).toEqual([{ place_id: 2 }]);
  });

  test('serializa a ~1 req/s: dos consultas distintas tardan al menos 1s en total', async () => {
    const GeocodingService = require('../modules/geocoding/geocoding.service');
    global.fetch.mockResolvedValue({ ok: true, json: async () => [] });

    const inicio = Date.now();
    await GeocodingService.buscar('x'); // cache miss, sale de inmediato
    await GeocodingService.buscar('y'); // cache miss distinto, debe esperar la cola
    const transcurrido = Date.now() - inicio;

    expect(transcurrido).toBeGreaterThanOrEqual(1000);
  }, 3000);
});
