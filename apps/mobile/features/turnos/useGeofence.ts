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
import * as Location from 'expo-location';

import {
  haversineMeters,
  getGeofenceStatus,
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

  // ponytail: polling instead of watchPositionAsync — avoids expo-keep-awake crash on some devices
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasTargets = targets !== null && targets.length > 0;

  useEffect(() => {
    if (!enabled || !hasTargets) {
      setDistanceM(null);
      return;
    }

    let cancelled = false;

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

    const poll = async () => {
      if (cancelled) return;
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        aplicarFix(loc.coords.latitude, loc.coords.longitude);
      } catch {
        // Google Play Services a veces no entrega un fix "fresco" (GPS débil, emulador, etc.)
        // — se usa el último conocido por el SO como respaldo antes de declarar indisponible.
        try {
          const last = await Location.getLastKnownPositionAsync({});
          if (cancelled) return;
          if (last) aplicarFix(last.coords.latitude, last.coords.longitude);
          else setUnavailable(true);
        } catch {
          if (!cancelled) setUnavailable(true);
        }
      }
    };

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;

      if (status !== 'granted') {
        setPermission(true);
        return;
      }

      setPermission(false);
      await poll();
      intervalRef.current = setInterval(poll, 5_000);
    })();

    return () => {
      cancelled = true;
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, hasTargets]);

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

  // canMark: inside/near geofence of any target, OR no geofence required
  const canMark = !hasTargets || status === 'inside' || status === 'near';

  return { distanceM, status, canMark, permissionDenied, locationUnavailable, currentLocation };
}
