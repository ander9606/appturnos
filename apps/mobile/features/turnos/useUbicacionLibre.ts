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
import { useState, useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

export type EstadoUbicacionLibre = 'obteniendo' | 'lista' | 'denegada' | 'no_disponible';

// Mismo timeout/antigüedad que useGeofence.ts — ver comentarios ahí.
const FIX_TIMEOUT_MS = 8_000;
const LAST_KNOWN_TIMEOUT_MS = 3_000;
const MAX_EDAD_UBICACION_MS = 2 * 60_000;

const conTimeout = <T,>(promesa: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promesa,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);

export function useUbicacionLibre(activo: boolean) {
  const [estado, setEstado] = useState<EstadoUbicacionLibre>('obteniendo');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const estadoRef = useRef(estado);
  estadoRef.current = estado;

  const intentar = useCallback(async () => {
    setEstado('obteniendo');
    try {
      const Location = await import('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setEstado('denegada');
        return;
      }
      try {
        // mayShowUserSettingsDialog (default true en Android) abre un diálogo del
        // sistema pidiendo "ubicación mejorada" cuando el modo de ubicación no
        // satisface accuracy High — ese diálogo pausa/reanuda la Activity, dispara
        // el listener de AppState de abajo y reinicia este intentar() en bucle sin
        // dejar nunca llegar a 'lista' (bug reportado: "se reinicia el cálculo
        // varias veces y nunca permite marcar"). Igual se le pone timeout porque
        // getCurrentPositionAsync puede quedar colgado sin resolver en señal débil.
        const loc = await conTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, mayShowUserSettingsDialog: false }),
          FIX_TIMEOUT_MS
        );
        setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        setEstado('lista');
      } catch {
        const last = await conTimeout(
          Location.getLastKnownPositionAsync({ maxAge: MAX_EDAD_UBICACION_MS }),
          LAST_KNOWN_TIMEOUT_MS
        );
        if (!last) throw new Error('sin ultima ubicacion');
        setCoords({ lat: last.coords.latitude, lng: last.coords.longitude });
        setEstado('lista');
      }
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
    // Solo reintenta si antes falló: en Android, abrir el modal de firma al
    // marcar salida dispara un 'active' espurio de AppState, y si ya había un
    // fix bueno ('lista') esto lo botaba y volvía a mostrar "Obteniendo
    // ubicación…" justo cuando el trabajador iba a cerrar el turno.
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && (estadoRef.current === 'denegada' || estadoRef.current === 'no_disponible')) {
        intentar();
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo]);

  return { estado, coords, reintentar: intentar };
}
