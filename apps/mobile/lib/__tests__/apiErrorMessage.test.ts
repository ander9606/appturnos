import { ApiError } from '@api-client';
import { errorKind, isNetworkError } from '../apiErrorMessage';

describe('errorKind', () => {
  it('sin internet: fetch lanza TypeError("Network request failed") → offline', () => {
    expect(isNetworkError(new TypeError('Network request failed'))).toBe(true);
    expect(errorKind(new TypeError('Network request failed'))).toBe('offline');
    expect(errorKind(new TypeError('Failed to fetch'))).toBe('offline');
  });

  it('5xx del backend → server', () => {
    expect(errorKind(new ApiError('boom', undefined, 500))).toBe('server');
    expect(errorKind(new ApiError('bad gateway', undefined, 502))).toBe('server');
  });

  it('4xx, errores de código y valores raros → generic (nunca "sin conexión")', () => {
    expect(errorKind(new ApiError('Sin permiso', undefined, 403))).toBe('generic');
    expect(errorKind(new TypeError("Cannot read properties of undefined (reading 'x')"))).toBe('generic');
    expect(errorKind(undefined)).toBe('generic');
    expect(errorKind('texto')).toBe('generic');
  });

  it('un ApiError nunca cuenta como error de red aunque su mensaje lo mencione', () => {
    expect(isNetworkError(new ApiError('network error en proveedor', undefined, 502))).toBe(false);
  });
});
