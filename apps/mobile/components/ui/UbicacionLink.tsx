import { useState } from 'react';
import { TouchableOpacity, Text, Linking, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Nominatim solo permite ~1 req/seg y pide no golpearlo en bloque — por eso esto
// resuelve la dirección al toque (bajo demanda), no de una para todas las filas
// visibles, y cachea en memoria para no repetir la consulta si se vuelve a abrir.
// Mismo servicio y misma caché-por-sesión que el equivalente en web
// (apps/web/src/shared/components/UbicacionLink.tsx).
const cache = new Map<string, string>();

interface Props {
  lat: number;
  lng: number;
  /** Ej. "Entrada" / "Salida" — antepuesto a la dirección resuelta. */
  label: string;
}

/** Botón que resuelve lat/lng a una dirección legible y abre el mapa nativo. */
export function UbicacionLink({ lat, lng, label }: Props) {
  const key = `${lat},${lng}`;
  const [direccion, setDireccion] = useState<string | null>(cache.get(key) ?? null);
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    if (direccion) {
      Linking.openURL(`https://www.google.com/maps?q=${lat},${lng}`);
      return;
    }
    if (loading) return;
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

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={loading}
      className="flex-row items-center gap-1 py-0.5"
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator size="small" color="#3B82F6" />
      ) : (
        <Ionicons name="location-outline" size={13} color="#3B82F6" />
      )}
      <Text numberOfLines={1} className="text-xs font-semibold text-info flex-shrink">
        {label}: {loading ? 'Buscando…' : (direccion ?? 'Ver ubicación')}
      </Text>
    </TouchableOpacity>
  );
}
