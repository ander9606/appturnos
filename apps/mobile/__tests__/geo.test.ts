import {
  haversineMeters,
  getGeofenceStatus,
  formatDistance,
  DEFAULT_GEOFENCE_RADIUS,
} from '../lib/geo';

// ── haversineMeters ───────────────────────────────────────────────────────────

describe('haversineMeters', () => {
  it('returns 0 for the same point', () => {
    expect(haversineMeters(4.7110, -74.0721, 4.7110, -74.0721)).toBe(0);
  });

  it('returns ~111 km for 1 degree of latitude at the equator', () => {
    const dist = haversineMeters(0, 0, 1, 0);
    expect(dist).toBeGreaterThan(110_000);
    expect(dist).toBeLessThan(112_000);
  });

  it('returns ~242 km for Bogotá → Medellín', () => {
    // Bogotá: 4.711°N 74.072°W  |  Medellín: 6.244°N 75.574°W
    const dist = haversineMeters(4.711, -74.072, 6.244, -75.574);
    expect(dist).toBeGreaterThan(238_000);
    expect(dist).toBeLessThan(246_000);
  });

  it('is symmetric', () => {
    const a = haversineMeters(4.7, -74.1, 6.2, -75.5);
    const b = haversineMeters(6.2, -75.5, 4.7, -74.1);
    expect(Math.abs(a - b)).toBeLessThan(0.001);
  });

  it('returns ~100 m for a small offset', () => {
    // ~0.0009° lat ≈ 100 m
    const dist = haversineMeters(4.7110, -74.0721, 4.7119, -74.0721);
    expect(dist).toBeGreaterThan(90);
    expect(dist).toBeLessThan(110);
  });
});

// ── getGeofenceStatus ─────────────────────────────────────────────────────────

describe('getGeofenceStatus', () => {
  it('returns "unknown" when distance is null', () => {
    expect(getGeofenceStatus(null)).toBe('unknown');
  });

  it('returns "inside" when distance equals radius', () => {
    expect(getGeofenceStatus(1000, 1000)).toBe('inside');
  });

  it('returns "inside" when distance is 0', () => {
    expect(getGeofenceStatus(0)).toBe('inside');
  });

  it('returns "inside" when well within radius', () => {
    expect(getGeofenceStatus(500, 1000)).toBe('inside');
  });

  it('returns "near" when between 1× and 2× radius', () => {
    expect(getGeofenceStatus(1500, 1000)).toBe('near');
  });

  it('returns "near" at exactly 2× radius', () => {
    expect(getGeofenceStatus(2000, 1000)).toBe('near');
  });

  it('returns "outside" beyond 2× radius', () => {
    expect(getGeofenceStatus(2001, 1000)).toBe('outside');
  });

  it('uses DEFAULT_GEOFENCE_RADIUS (1000 m) when no radius provided', () => {
    expect(DEFAULT_GEOFENCE_RADIUS).toBe(1000);
    expect(getGeofenceStatus(999)).toBe('inside');
    expect(getGeofenceStatus(1001)).toBe('near');
  });
});

// ── formatDistance ────────────────────────────────────────────────────────────

describe('formatDistance', () => {
  it('formats sub-km as meters', () => {
    expect(formatDistance(500)).toBe('500 m');
  });

  it('rounds to nearest meter', () => {
    expect(formatDistance(123.7)).toBe('124 m');
  });

  it('formats 1000 m as km', () => {
    expect(formatDistance(1000)).toBe('1.0 km');
  });

  it('formats with one decimal place', () => {
    expect(formatDistance(1500)).toBe('1.5 km');
  });

  it('formats large distances', () => {
    expect(formatDistance(242000)).toBe('242.0 km');
  });
});
