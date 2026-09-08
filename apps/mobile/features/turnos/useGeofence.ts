/**
 * useGeofence — hook de proximidad GPS
 *
 * Solicita permiso de ubicación, vigila la posición en tiempo real y
 * calcula la distancia al punto (o al más cercano de varios puntos).
 *
 * Retorna:
 *  - distanceM:   distancia en metros al punto más cercano (null = no disponible)
 *  - status:      'inside' | 'near' | 'outside' | 'unknown'
 *  - canMark:     true si está dentro del radio de algún punto, o si no hay geofence
 *  - permissionDenied: true si el usuario rechazó el permiso
 */
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';

import {
  haversineMeters,
  getGeofenceStatus,
  radioEscaladoPorEspera,
  DEFAULT_GEOFENCE_RADIUS,
  type GeofenceStatus,
} from '@/lib/geo';

export interface GeofenceTarget {
  lat: number;
  lng: number;
  radiusM?: number;
}

interface UseGeofenceOptions {
  /**
   * Lista de puntos de marcaje válidos.
   * - null / [] = sin geofence (tipo 'libre' o sin coords) → siempre canMark.
   * - Un único elemento → geofence simple (tipo 'oferta' o 'fijo').
   * - Varios elementos → geofence zonal: válido si está dentro de CUALQUIERA.
   */
  targets: GeofenceTarget[] | null;
  /** Activar la vigilancia de posición (default true). */
  enabled?: boolean;
}

interface GeofenceResult {
  distanceM: number | null;
  status: GeofenceStatus;
  canMark: boolean;
  permissionDenied: boolean;
  locationUnavailable: boolean;
  currentLocation: { lat: number; lng: number } | null;
}

export function useGeofence({
  targets,
  enabled = true,
}: UseGeofenceOptions): GeofenceResult {
  const [distanceM, setDistanceM]         = useState<number | null>(null);
  const [permissionDenied, setPermission] = useState(false);
  const [locationUnavailable, setUnavailable] = useState(false);
  const [currentLocation, setLocation]    = useState<{ lat: number; lng: number } | null>(null);
  // Fuerza un re-render cada poll aunque distanceM no cambie, para que el radio
  // escalado por tiempo (ver ESCALADA_RADIO abajo) se recalcule con el reloj real.
  const [, setTick] = useState(0);

  // ponytail: polling instead of watchPositionAsync — avoids expo-keep-awake crash on some devices
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const hasTargets = targets !== null && targets.length > 0;

  useEffect(() => {
    if (!enabled || !hasTargets) {
      setDistanceM(null);
      return;
    }

    let cancelled = false;
    // getCurrentPositionAsync no tiene opción de timeout — si el proveedor de
    // ubicación nunca resuelve (GPS frío, señal débil), el await queda colgado
    // sin límite. Este "carrera contra un timeout" le pone techo a la espera.
    const FIX_TIMEOUT_MS = 8_000;
    // Momento en que arrancó a intentar obtener ubicación en esta sesión de
    // pantalla — referencia para la escalada de radio por tiempo (más abajo).
    startedAtRef.current = Date.now();

    const aplicarFix = (lat: number, lng: number) => {
      setLocation({ lat, lng });
      let minDist = Infinity;
      for (const t of targets!) {
        const d = haversineMeters(lat, lng, t.lat, t.lng);
        if (d < minDist) minDist = d;
      }
      setDistanceM(minDist === Infinity ? null : minDist);
      setUnavailable(false);
    };

    // Evita fixes solapados: si un poll() tarda más que el intervalo de 5 s,
    // el setInterval de abajo dispararía otro por encima sin esperar a que
    // termine el anterior, y ambos compiten por el mismo proveedor de ubicación
    // — eso alarga la espera real en vez de acortarla.
    let enCurso = false;

    const poll = async () => {
      if (cancelled || enCurso) return;
      enCurso = true;
      setTick((t) => t + 1); // recalcula la escalada de radio aunque el fix no cambie
      try {
        const loc = await Promise.race([
          // mayShowUserSettingsDialog (default true en Android) puede abrir un diálogo
          // del sistema pidiendo "ubicación mejorada" — no tiene sentido en un poll de
          // fondo que nadie está mirando, y puede sumar una espera extra si aparece.
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, mayShowUserSettingsDialog: false }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), FIX_TIMEOUT_MS)
          ),
        ]);
        if (cancelled) return;
        aplicarFix(loc.coords.latitude, loc.coords.longitude);
      } catch {
        // Fix fresco no llegó a tiempo (señal débil, emulador, o superó el timeout)
        // — se usa el último conocido por el SO como respaldo antes de declarar indisponible.
        try {
          const last = await Location.getLastKnownPositionAsync({});
          if (cancelled) return;
          if (last) aplicarFix(last.coords.latitude, last.coords.longitude);
          else setUnavailable(true);
        } catch {
          if (!cancelled) setUnavailable(true);
        }
      } finally {
        enCurso = false;
      }
    };

    const startIfGranted = async (status: Location.PermissionStatus) => {
      if (status !== 'granted') {
        setPermission(true);
        return;
      }
      setPermission(false);
      if (intervalRef.current) return; // already polling
      // ponytail: muestra la última ubicación conocida (casi instantánea) mientras se
      // resuelve el fix fresco, para no dejar "Calculando distancia…" varios segundos.
      try {
        const last = await Location.getLastKnownPositionAsync({});
        if (!cancelled && last) aplicarFix(last.coords.latitude, last.coords.longitude);
      } catch {
        // sin respaldo — poll() de abajo sigue intentando el fix fresco
      }
      await poll();
      intervalRef.current = setInterval(poll, 5_000);
    };

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      await startIfGranted(status);
    })();

    // ponytail: no re-prompt on resume, just re-check silently — request*Async only shows
    // a system dialog when status is undetermined, so this is safe to call repeatedly.
    const sub = AppState.addEventListener('change', async (next) => {
      if (next !== 'active' || cancelled) return;
      const { status } = await Location.getForegroundPermissionsAsync();
      if (cancelled) return;
      await startIfGranted(status);
    });

    return () => {
      cancelled = true;
      sub.remove();
      startedAtRef.current = null;
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, hasTargets]);

  // El backend vuelve a validar con el radio real configurado al marcar — esto
  // solo relaja qué tan pronto se habilita el botón cuando el GPS tarda en dar
  // un fix confiable, sin inflar la etiqueta "cerca/dentro" que se le muestra
  // al trabajador (esa sigue reflejando la distancia real).
  const radioEscalado = startedAtRef.current === null
    ? 0
    : radioEscaladoPorEspera(Date.now() - startedAtRef.current);

  // Determine status against the nearest target's radius
  const nearestRadius = (() => {
    if (!hasTargets || distanceM === null) return DEFAULT_GEOFENCE_RADIUS;
    // Find the target that is closest to current location
    let minDist = Infinity;
    let radius = DEFAULT_GEOFENCE_RADIUS;
    if (currentLocation && targets) {
      for (const t of targets) {
        const d = haversineMeters(currentLocation.lat, currentLocation.lng, t.lat, t.lng);
        if (d < minDist) { minDist = d; radius = t.radiusM ?? DEFAULT_GEOFENCE_RADIUS; }
      }
    }
    return radius;
  })();

  const status: GeofenceStatus = hasTargets
    ? getGeofenceStatus(distanceM, nearestRadius)
    : 'unknown';

  // canMark: inside/near geofence de verdad, O fuera de rango pero dentro del
  // radio escalado por espera, O sin geofence requerido.
  const canMark =
    !hasTargets ||
    status === 'inside' ||
    status === 'near' ||
    (distanceM !== null && radioEscalado > 0 && distanceM <= radioEscalado);

  return { distanceM, status, canMark, permissionDenied, locationUnavailable, currentLocation };
}
