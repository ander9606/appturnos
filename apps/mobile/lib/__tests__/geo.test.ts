import { haversineMeters, getGeofenceStatus, formatDistance, DEFAULT_GEOFENCE_RADIUS } from '../geo';

describe('haversineMeters', () => {
  it('devuelve 0 para el mismo punto', () => {
    expect(haversineMeters(4.6097, -74.0817, 4.6097, -74.0817)).toBe(0);
  });

  it('aproxima ~111 km por grado de latitud', () => {
    const d = haversineMeters(0, 0, 1, 0);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it('calcula ~2.4 km entre dos puntos de Bogotá conocidos', () => {
    // Parque Simón Bolívar → Torre Colpatria
    const d = haversineMeters(4.6579, -74.0948, 4.6097, -74.0817);
    expect(d).toBeGreaterThan(5_000);
    expect(d).toBeLessThan(6_500);
  });

  it('es simétrico', () => {
    const d1 = haversineMeters(4.6097, -74.0817, 6.2476, -75.5658);
    const d2 = haversineMeters(6.2476, -75.5658, 4.6097, -74.0817);
    expect(Math.abs(d1 - d2)).toBeLessThan(0.01);
  });
});

describe('getGeofenceStatus', () => {
  it('devuelve "unknown" para distancia null', () => {
    expect(getGeofenceStatus(null)).toBe('unknown');
  });

  it('devuelve "inside" cuando está dentro del radio', () => {
    expect(getGeofenceStatus(50, 100)).toBe('inside');
    expect(getGeofenceStatus(100, 100)).toBe('inside');
  });

  it('devuelve "near" entre radio y 2×radio', () => {
    expect(getGeofenceStatus(150, 100)).toBe('near');
    expect(getGeofenceStatus(199, 100)).toBe('near');
  });

  it('devuelve "outside" más allá de 2×radio', () => {
    expect(getGeofenceStatus(201, 100)).toBe('outside');
    expect(getGeofenceStatus(5000, 100)).toBe('outside');
  });

  it('usa DEFAULT_GEOFENCE_RADIUS si no se pasa radio', () => {
    expect(getGeofenceStatus(DEFAULT_GEOFENCE_RADIUS - 1)).toBe('inside');
    expect(getGeofenceStatus(DEFAULT_GEOFENCE_RADIUS + 1)).toBe('near');
  });
});

describe('formatDistance', () => {
  it('usa metros para distancias menores de 1 km', () => {
    expect(formatDistance(42)).toBe('42 m');
    expect(formatDistance(999)).toBe('999 m');
  });

  it('usa km para distancias >= 1000 m', () => {
    expect(formatDistance(1000)).toBe('1.0 km');
    expect(formatDistance(2500)).toBe('2.5 km');
  });
});
