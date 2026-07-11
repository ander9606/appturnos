import { ApiError } from '@api-client';

/** Mensaje real del backend si está disponible; si no, un fallback genérico. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}
