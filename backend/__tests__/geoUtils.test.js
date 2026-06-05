'use strict';

const { haversineMeters, haversineMetros, estaEnAlgunPunto } = require('../utils/geoUtils');

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
    const dist = haversineMeters(4.711, -74.072, 6.244, -75.574);
    expect(dist).toBeGreaterThan(238_000);
    expect(dist).toBeLessThan(246_000);
  });

  it('is symmetric', () => {
    const a = haversineMeters(4.7, -74.1, 6.2, -75.5);
    const b = haversineMeters(6.2, -75.5, 4.7, -74.1);
    expect(Math.abs(a - b)).toBeLessThan(0.001);
  });

  it('haversineMetros is an alias returning the same value', () => {
    const a = haversineMeters(4.7, -74.1, 6.2, -75.5);
    const b = haversineMetros(4.7, -74.1, 6.2, -75.5);
    expect(a).toBe(b);
  });
});

// ── estaEnAlgunPunto ──────────────────────────────────────────────────────────

describe('estaEnAlgunPunto', () => {
  const bogota = { latitud: 4.7110, longitud: -74.0721, radio_metros: 500 };

  it('returns ok=true when point is inside radius', () => {
    // Same coordinates → distance = 0, within any radius
    const result = estaEnAlgunPunto(4.7110, -74.0721, [bogota]);
    expect(result.ok).toBe(true);
    expect(result.punto).toBe(bogota);
    expect(result.distanciaM).toBe(0);
  });

  it('returns ok=true when point is well within radius', () => {
    // ~0.0020° lat ≈ 220 m, well within 500 m
    const result = estaEnAlgunPunto(4.7130, -74.0721, [bogota]);
    expect(result.ok).toBe(true);
  });

  it('returns ok=false when point is outside radius', () => {
    // Medellín is ~242 km away from Bogotá
    const result = estaEnAlgunPunto(6.244, -75.574, [bogota]);
    expect(result.ok).toBe(false);
    expect(result.punto).toBeUndefined();
  });

  it('returns ok=false for empty points list', () => {
    const result = estaEnAlgunPunto(4.7110, -74.0721, []);
    expect(result.ok).toBe(false);
  });

  it('returns the first matching punto when multiple points provided', () => {
    const farPoint = { latitud: 6.244, longitud: -75.574, radio_metros: 500 };
    const result = estaEnAlgunPunto(4.7110, -74.0721, [farPoint, bogota]);
    expect(result.ok).toBe(true);
    expect(result.punto).toBe(bogota);
  });

  it('rounds distanciaM to nearest integer', () => {
    const result = estaEnAlgunPunto(4.7112, -74.0721, [bogota]);
    expect(Number.isInteger(result.distanciaM)).toBe(true);
  });
});
