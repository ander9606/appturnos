import { useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

// Nominatim solo permite ~1 req/seg y pide no golpearlo en bloque — por eso esto
// resuelve la dirección al toque (bajo demanda), no de una para todas las filas
// visibles, y cachea en memoria para no repetir la consulta si se vuelve a abrir.
const cache = new Map<string, string>();

interface Props {
  lat: number;
  lng: number;
  /** Ej. "Entrada" / "Salida" — antepuesto a la dirección resuelta. */
  label: string;
}

/** Link que resuelve lat/lng a una dirección legible (mismo servicio que LugarInput) y abre el mapa. */
export function UbicacionLink({ lat, lng, label }: Props) {
  const key = `${lat},${lng}`;
  const [direccion, setDireccion] = useState<string | null>(cache.get(key) ?? null);
  const [loading, setLoading] = useState(false);

  const resolver = async () => {
    if (direccion || loading) return;
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { 'Accept-Language': 'es' } },
      );
      const data = await res.json();
      const nombre: string = data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      cache.set(key, nombre);
      setDireccion(nombre);
    } catch {
      setDireccion(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } finally {
      setLoading(false);
    }
  };

  const mapsUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;

  if (!direccion) {
    return (
      <button
        type="button"
        onClick={resolver}
        disabled={loading}
        className="flex items-center gap-1 text-xs text-info hover:text-primary-600 font-medium disabled:opacity-60"
      >
        {loading ? <Loader2 size={11} className="animate-spin flex-shrink-0" /> : <MapPin size={11} className="flex-shrink-0" />}
        {label}: {loading ? 'Buscando…' : 'Ver ubicación'}
      </button>
    );
  }

  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-1 text-xs text-info hover:text-primary-600 font-medium truncate max-w-[240px]"
      title={direccion}
    >
      <MapPin size={11} className="flex-shrink-0" />
      {label}: {direccion}
    </a>
  );
}
