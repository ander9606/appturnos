/**
 * Tests for apps/mobile/lib/geo.ts
 * Imported via the @/ alias (mapped to apps/mobile/) so ts-jest can resolve
 * the file without needing the mobile package's npm tree.
 */
import {
  haversineMeters,
  formatDistance,
  getGeofenceStatus,
  DEFAULT_GEOFENCE_RADIUS,
} from '@/lib/geo';

// ── haversineMeters ───────────────────────────────────────────────────────────

describe('haversineMeters', () => {
  test('same point → 0 m', () => {
    expect(haversineMeters(4.711, -74.0721, 4.711, -74.0721)).toBeCloseTo(0, 1);
  });

  test('Bogotá ↔ Medellín straight-line ≈ 238 km', () => {
    // Bogotá: 4.711°N, -74.072°W  |  Medellín: 6.244°N, -75.574°W
    // Haversine (straight-line) ≈ 238 km; driving distance is ~430 km.
    const d = haversineMeters(4.711, -74.0721, 6.2442, -75.5748);
    expect(d / 1000).toBeCloseTo(238, 0); // within 1 km
  });

  test('~100 m move north', () => {
    // Approx 1° lat ≈ 111 km → 0.0009° ≈ 100 m
    const d = haversineMeters(4.711, -74.0721, 4.7119, -74.0721);
    expect(d).toBeGreaterThan(90);
    expect(d).toBeLessThan(110);
  });

  test('symmetric (order of points does not matter)', () => {
    const d1 = haversineMeters(4.711, -74.0721, 6.2442, -75.5748);
    const d2 = haversineMeters(6.2442, -75.5748, 4.711, -74.0721);
    expect(d1).toBeCloseTo(d2, 2);
  });

  test('distance is always non-negative', () => {
    const d = haversineMeters(-33.8688, 151.2093, 51.5074, -0.1278); // Sydney ↔ London
    expect(d).toBeGreaterThan(0);
  });
});

// ── formatDistance ────────────────────────────────────────────────────────────

describe('formatDistance', () => {
  test('< 1000 m → meters', () => {
    expect(formatDistance(75)).toBe('75 m');
    expect(formatDistance(999)).toBe('999 m');
  });

  test('rounds to nearest meter', () => {
    expect(formatDistance(75.6)).toBe('76 m');
  });

  test('>= 1000 m → km with 1 decimal', () => {
    expect(formatDistance(1000)).toBe('1.0 km');
    expect(formatDistance(1500)).toBe('1.5 km');
    expect(formatDistance(12340)).toBe('12.3 km');
  });
});

// ── getGeofenceStatus ─────────────────────────────────────────────────────────

describe('getGeofenceStatus', () => {
  const R = DEFAULT_GEOFENCE_RADIUS; // 100 m

  test('null distance → unknown', () => {
    expect(getGeofenceStatus(null)).toBe('unknown');
  });

  test('exactly at radius → inside', () => {
    expect(getGeofenceStatus(R)).toBe('inside');
  });

  test('distance 0 → inside', () => {
    expect(getGeofenceStatus(0)).toBe('inside');
  });

  test('between radius and 2×radius → near', () => {
    expect(getGeofenceStatus(R + 1)).toBe('near');
    expect(getGeofenceStatus(R * 2)).toBe('near');
  });

  test('beyond 2×radius → outside', () => {
    expect(getGeofenceStatus(R * 2 + 1)).toBe('outside');
    expect(getGeofenceStatus(5000)).toBe('outside');
  });

  test('custom radius is respected', () => {
    expect(getGeofenceStatus(50, 200)).toBe('inside');
    expect(getGeofenceStatus(250, 200)).toBe('near');
    expect(getGeofenceStatus(450, 200)).toBe('outside');
  });
});
