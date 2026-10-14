import { api } from './axios';

export interface SugerenciaLugar {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export interface DireccionInversa {
  display_name: string;
}

interface Envelope<T> {
  success: boolean;
  data: T;
}

/**
 * Geocoding (Nominatim/OpenStreetMap) vía el backend — nunca directo desde el
 * browser. El backend (`backend/modules/geocoding/`) es el único que manda el
 * User-Agent que exige la política de uso de Nominatim, serializa a 1 req/s
 * y cachea; pegarle directo desde acá duplicaría ese trabajo sin ninguna de
 * esas protecciones. Mismo contrato que `geocodingApi` en `@api-client`
 * (usado por mobile), pero vía axios porque web no comparte ese cliente.
 */
export const geocodingApi = {
  buscar: (q: string) =>
    api.get<Envelope<SugerenciaLugar[]>>('/geocoding/buscar', { params: { q } }).then(r => r.data.data),

  reverse: (lat: number, lon: number) =>
    api.get<Envelope<DireccionInversa>>('/geocoding/reverse', { params: { lat, lon } }).then(r => r.data.data),
};
