import { api } from './client';

export interface SugerenciaLugar {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export interface DireccionInversa {
  display_name: string;
}

/**
 * Geocoding (Nominatim/OpenStreetMap) vía el backend, no directo desde el
 * cliente — Nominatim exige 1 req/s y un User-Agent identificable, y en
 * Android `fetch` no logra fijar un User-Agent propio. El backend hace de
 * proxy único: ver backend/modules/geocoding/geocoding.service.js.
 */
export const geocodingApi = {
  buscar(q: string): Promise<SugerenciaLugar[]> {
    return api.get<SugerenciaLugar[]>(`/api/geocoding/buscar?q=${encodeURIComponent(q)}`);
  },

  reverse(lat: number, lon: number): Promise<DireccionInversa> {
    return api.get<DireccionInversa>(`/api/geocoding/reverse?lat=${lat}&lon=${lon}`);
  },
};
