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
