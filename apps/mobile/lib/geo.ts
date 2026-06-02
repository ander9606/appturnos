/**
 * Geo utilities — AppTurnos
 * Haversine distance, geofence check, formatting.
 */

const EARTH_RADIUS_M = 6_371_000;

/** Haversine distance in meters between two GPS coordinates. */
export function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Default geofence radius in meters (matches backend default — 1 km for rural tolerance). */
export const DEFAULT_GEOFENCE_RADIUS = 1000;

/** Human-readable distance string. */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export type GeofenceStatus = 'inside' | 'near' | 'outside' | 'unknown';

/** Classify distance relative to geofence radius. */
export function getGeofenceStatus(
  distanceM: number | null,
  radiusM: number = DEFAULT_GEOFENCE_RADIUS,
): GeofenceStatus {
  if (distanceM === null) return 'unknown';
  if (distanceM <= radiusM) return 'inside';
  if (distanceM <= radiusM * 2) return 'near';
  return 'outside';
}
