import { ApiError } from '@api-client';

/** Mensaje real del backend si está disponible; si no, un fallback genérico. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/**
 * 4xx (400-499): el request está mal formado o el rol no tiene permiso — repetirlo
 * no lo arregla, es un bug de código (falta un gate de rol) o algo intencional.
 * Nunca "no hay conexión" ni "el server falló". Reintentar/avisar al usuario no ayuda.
 */
export function isClientError(err: unknown): boolean {
  return err instanceof ApiError && err.status >= 400 && err.status < 500;
}

/** 404: el recurso no existe (o no es de esta empresa). No es un fallo: reintentar no lo arregla. */
export function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}

/** Sin red: `fetch` no llega a abrir la conexión y lanza un TypeError ("Network request failed"), nunca un ApiError. */
export function isNetworkError(err: unknown): boolean {
  return err instanceof Error && !(err instanceof ApiError)
    && /network request failed|failed to fetch|network error|timed out|aborted/i.test(err.message);
}

export type ErrorKind = 'offline' | 'server' | 'generic';

/** Qué ilustración y texto mostrar: sin conexión, falla nuestra (5xx) u otro (4xx, desconocido). */
export function errorKind(err: unknown): ErrorKind {
  if (isNetworkError(err)) return 'offline';
  if (err instanceof ApiError && err.status >= 500) return 'server';
  return 'generic';
}
