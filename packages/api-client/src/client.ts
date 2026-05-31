import { ApiError, ApiResponse } from './types';

// ── Token store interface (injected by the consumer) ─────────────────────
// The mobile app uses expo-secure-store; the client itself is storage-agnostic.

export interface TokenStore {
  getAccessToken(): Promise<string | null>;
  getRefreshToken(): Promise<string | null>;
  setTokens(accessToken: string, refreshToken: string): Promise<void>;
  clearTokens(): Promise<void>;
}

let tokenStore: TokenStore | null = null;
let baseUrl = '';
let onAuthExpired: (() => void) | null = null;

// ── Initializer ───────────────────────────────────────────────────────────

export function initApiClient(options: {
  baseUrl: string;
  tokenStore: TokenStore;
  onAuthExpired?: () => void;
}) {
  baseUrl = options.baseUrl.replace(/\/$/, '');
  tokenStore = options.tokenStore;
  onAuthExpired = options.onAuthExpired ?? null;
}

// ── Silent token refresh ──────────────────────────────────────────────────

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

function drainRefreshQueue(token: string | null) {
  refreshQueue.forEach((cb) => cb(token));
  refreshQueue = [];
}

async function tryRefresh(): Promise<string | null> {
  if (!tokenStore) return null;

  if (isRefreshing) {
    return new Promise((resolve) => {
      refreshQueue.push(resolve);
    });
  }

  isRefreshing = true;
  try {
    const refreshToken = await tokenStore.getRefreshToken();
    if (!refreshToken) {
      drainRefreshQueue(null);
      return null;
    }

    const res = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      await tokenStore.clearTokens();
      drainRefreshQueue(null);
      onAuthExpired?.();
      return null;
    }

    const body: ApiResponse<{ access_token: string; refresh_token: string }> =
      await res.json();
    await tokenStore.setTokens(body.data.access_token, body.data.refresh_token);
    drainRefreshQueue(body.data.access_token);
    return body.data.access_token;
  } catch {
    drainRefreshQueue(null);
    return null;
  } finally {
    isRefreshing = false;
  }
}

// ── Core fetch ────────────────────────────────────────────────────────────

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface FetchOptions {
  /** Include Authorization header (default: true) */
  authenticated?: boolean;
  /** X-Empresa-Slug header for multi-tenant requests */
  empresaSlug?: string;
  signal?: AbortSignal;
}

async function apiFetch<T>(
  method: HttpMethod,
  path: string,
  body?: unknown,
  opts: FetchOptions = {},
): Promise<T> {
  const { authenticated = true, empresaSlug, signal } = opts;

  const buildHeaders = (token?: string): Record<string, string> => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (empresaSlug) h['X-Empresa-Slug'] = empresaSlug;
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  };

  const doRequest = async (token?: string) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: buildHeaders(token),
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });

  // Attach current access token if auth required
  let token: string | null = null;
  if (authenticated && tokenStore) {
    token = await tokenStore.getAccessToken();
  }

  let res = await doRequest(token ?? undefined);

  // 401 → try silent refresh once
  if (res.status === 401 && authenticated) {
    const newToken = await tryRefresh();
    if (newToken) {
      res = await doRequest(newToken);
    } else {
      throw new ApiError('Sesión expirada. Inicia sesión de nuevo.', 'AUTH_EXPIRED', 401);
    }
  }

  // Parse JSON (graceful fallback for non-JSON error bodies)
  const json: ApiResponse<T> = await res.json().catch(() => ({
    success: false,
    data: null as unknown as T,
    message: `Error inesperado (HTTP ${res.status})`,
  }));

  if (!json.success) {
    throw new ApiError(json.message, undefined, res.status);
  }

  return json.data;
}

// ── Public helpers ────────────────────────────────────────────────────────

export const api = {
  get: <T>(path: string, opts?: FetchOptions) =>
    apiFetch<T>('GET', path, undefined, opts),
  post: <T>(path: string, body?: unknown, opts?: FetchOptions) =>
    apiFetch<T>('POST', path, body, opts),
  put: <T>(path: string, body?: unknown, opts?: FetchOptions) =>
    apiFetch<T>('PUT', path, body, opts),
  patch: <T>(path: string, body?: unknown, opts?: FetchOptions) =>
    apiFetch<T>('PATCH', path, body, opts),
  delete: <T>(path: string, body?: unknown, opts?: FetchOptions) =>
    apiFetch<T>('DELETE', path, body, opts),
};
