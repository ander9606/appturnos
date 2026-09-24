/**
 * useUbicacionLibre — fix de GPS puntual para geofence tipo 'libre'
 *
 * Sin puntos contra los que medir distancia, pero igual se exige un fix de
 * ubicación antes de habilitar el marcaje — sin esto, un trabajador con
 * geofence 'libre' podía marcar entrada/salida sin dejar ningún rastro de
 * ubicación (el fix anterior era best-effort y caía a lat/lng 0,0 si fallaba
 * o el permiso estaba negado). Un solo intento por activación alcanza — no
 * hace falta vigilar la posición en el tiempo como sí hace useGeofence para
 * fijo/zonal. Mismo criterio que useUbicacionParaLibre en
 * nomina/trabajador/useNominaTrabajador.ts.
 */
import { useState, useCallback, useEffect } from 'react';
import { AppState } from 'react-native';

export type EstadoUbicacionLibre = 'obteniendo' | 'lista' | 'denegada' | 'no_disponible';

export function useUbicacionLibre(activo: boolean) {
  const [estado, setEstado] = useState<EstadoUbicacionLibre>('obteniendo');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const intentar = useCallback(async () => {
    setEstado('obteniendo');
    try {
      const Location = await import('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setEstado('denegada');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      setEstado('lista');
    } catch {
      setEstado('no_disponible');
    }
  }, []);

  useEffect(() => {
    if (!activo) return;
    intentar();
    // Si el trabajador salió a Ajustes a conceder el permiso y vuelve, se
    // reintenta solo — sin esto quedaba trabado en 'denegada' hasta salir y
    // reentrar a la pantalla. Mismo patrón que useGeofence.
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') intentar();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo]);

  return { estado, coords, reintentar: intentar };
}
