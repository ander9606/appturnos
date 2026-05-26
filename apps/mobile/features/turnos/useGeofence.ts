/**
 * useGeofence — hook de proximidad GPS
 *
 * Solicita permiso de ubicación, vigila la posición en tiempo real y
 * calcula la distancia al punto de trabajo de la oferta.
 *
 * Retorna:
 *  - distanceM:   distancia en metros (null = no disponible)
 *  - status:      'inside' | 'near' | 'outside' | 'unknown'
 *  - canMark:     true si está dentro del radio o si la oferta no tiene coords
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

interface UseGeofenceOptions {
  /** Latitud del punto de trabajo. null = sin geofence. */
  targetLat: number | null;
  /** Longitud del punto de trabajo. */
  targetLng: number | null;
  /** Radio en metros (default 100). */
  radiusM?: number;
  /** Activar la vigilancia de posición (default true). */
  enabled?: boolean;
}

interface GeofenceResult {
  distanceM: number | null;
  status: GeofenceStatus;
  canMark: boolean;
  permissionDenied: boolean;
  currentLocation: { lat: number; lng: number } | null;
}

export function useGeofence({
  targetLat,
  targetLng,
  radiusM = DEFAULT_GEOFENCE_RADIUS,
  enabled = true,
}: UseGeofenceOptions): GeofenceResult {
  const [distanceM, setDistanceM]         = useState<number | null>(null);
  const [permissionDenied, setPermission] = useState(false);
  const [currentLocation, setLocation]    = useState<{ lat: number; lng: number } | null>(null);

  const subRef = useRef<Location.LocationSubscription | null>(null);

  // No coords on offer → no geofence, always allow
  const hasTarget = targetLat !== null && targetLng !== null;

  useEffect(() => {
    if (!enabled || !hasTarget) {
      setDistanceM(null);
      return;
    }

    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;

      if (status !== 'granted') {
        setPermission(true);
        return;
      }

      setPermission(false);

      subRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 5,   // update every 5 m movement
          timeInterval: 5_000,   // or every 5 s
        },
        (loc) => {
          if (cancelled) return;
          const { latitude: lat, longitude: lng } = loc.coords;
          setLocation({ lat, lng });
          const dist = haversineMeters(lat, lng, targetLat!, targetLng!);
          setDistanceM(dist);
        },
      );
    })();

    return () => {
      cancelled = true;
      subRef.current?.remove();
      subRef.current = null;
    };
  }, [enabled, hasTarget, targetLat, targetLng]);

  const status = hasTarget ? getGeofenceStatus(distanceM, radiusM) : 'unknown';

  // canMark: inside geofence, OR the offer has no GPS coordinates
  const canMark = !hasTarget || status === 'inside' || status === 'near';

  return { distanceM, status, canMark, permissionDenied, currentLocation };
}
