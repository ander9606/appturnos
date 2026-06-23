/**
 * Auth store — Zustand
 *
 * Responsabilidades:
 * - Guardar la sesión en memoria y en expo-secure-store
 * - Exponer acciones login / logout / activarCuenta / rehydrate
 * - Ser la única fuente de verdad sobre si el usuario está autenticado
 */
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { authApi, initApiClient, type UsuarioPerfil } from '@api-client';
import { secureTokenStore } from '@/lib/secureStore';

// ── Constants ─────────────────────────────────────────────────────────────

const KEY_USUARIO = 'appturnos.usuario';

const _envUrl = process.env.EXPO_PUBLIC_API_URL;
if (!_envUrl) {
  throw new Error('EXPO_PUBLIC_API_URL no está configurado. Crea apps/mobile/.env con EXPO_PUBLIC_API_URL=http://...');
}

/**
 * Resuelve la URL base del API según el entorno de ejecución.
 * - Emulador Android  → reemplaza la IP local con 10.0.2.2 (gateway del host)
 * - Dispositivo físico / simulador iOS → usa la URL del .env tal cual
 */
function resolveApiUrl(url: string): string {
  if (Platform.OS === 'android' && !Constants.isDevice) {
    return url.replace(
      /(?:192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|localhost|127\.0\.0\.1)/,
      '10.0.2.2'
    );
  }
  return url;
}

const API_BASE_URL = resolveApiUrl(_envUrl);

// ── Types ─────────────────────────────────────────────────────────────────

type AuthStatus = 'unknown' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: AuthStatus;
  usuario: UsuarioPerfil | null;

  /** Llama initApiClient + lee tokens del secure store al arrancar la app */
  rehydrate(): Promise<void>;

  /** Login normal con email + contraseña */
  login(email: string, password: string): Promise<void>;

  /** Activar cuenta de trabajador con cédula + email + contraseña */
  activarCuenta(params: {
    cedula: string;
    email: string;
    password: string;
  }): Promise<void>;

  /** Registro público de empresa nueva + auto-login como admin_empresa */
  registrarEmpresa(params: {
    nombre_empresa: string;
    nit?: string;
    nombre: string;
    apellido?: string;
    email: string;
    password: string;
  }): Promise<void>;

  /** Registro libre para trabajador_turnos (marketplace) */
  registrar(params: {
    nombre: string;
    apellido?: string;
    email: string;
    password: string;
  }): Promise<void>;

  /** Actualiza el usuario en memoria y en SecureStore (tras edición de perfil) */
  setUsuario(usuario: UsuarioPerfil): Promise<void>;

  /** Cierra sesión: revoca refresh token + limpia store */
  logout(): Promise<void>;
}

// ── Store ─────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()((set, get) => ({
  status: 'unknown',
  usuario: null,

  // ── rehydrate ─────────────────────────────────────────────────────────
  async rehydrate() {
    // Initialize the API client (only needed once, but safe to call repeatedly)
    initApiClient({
      baseUrl: API_BASE_URL,
      tokenStore: secureTokenStore,
      onAuthExpired: () => {
        set({ status: 'unauthenticated', usuario: null });
      },
    });

    const [accessToken, cachedUsuario] = await Promise.all([
      secureTokenStore.getAccessToken(),
      SecureStore.getItemAsync(KEY_USUARIO),
    ]);

    if (!accessToken) {
      set({ status: 'unauthenticated' });
      return;
    }

    // Paint from cache immediately so the UI loads fast
    if (cachedUsuario) {
      try {
        const usuario: UsuarioPerfil = JSON.parse(cachedUsuario);
        set({ status: 'authenticated', usuario });
      } catch {
        // corrupted — continue to server fetch
      }
    }

    // Validate token with the server in the background
    try {
      const usuario = await authApi.me();
      await SecureStore.setItemAsync(KEY_USUARIO, JSON.stringify(usuario));
      set({ status: 'authenticated', usuario });
    } catch {
      // Token may be expired; tryRefresh inside apiFetch will handle it.
      // If it fails completely, onAuthExpired fires and sets unauthenticated.
    }
  },

  // ── login ─────────────────────────────────────────────────────────────
  async login(email, password) {
    const { access_token, refresh_token, usuario } = await authApi.login(email, password);
    await secureTokenStore.setTokens(access_token, refresh_token);
    await SecureStore.setItemAsync(KEY_USUARIO, JSON.stringify(usuario));
    set({ status: 'authenticated', usuario });
  },

  // ── activarCuenta ─────────────────────────────────────────────────────
  async activarCuenta({ cedula, email, password }) {
    // Activation only creates the account; it does NOT return tokens.
    // After success we do a regular login so the user lands logged in.
    await authApi.activarCuenta({ cedula, email, password });
    await get().login(email, password);
  },

  // ── registrarEmpresa ──────────────────────────────────────────────────
  async registrarEmpresa({ nombre_empresa, nit, nombre, apellido, email, password }) {
    const { access_token, refresh_token, usuario } = await authApi.registrarEmpresa({
      nombre_empresa, nit, nombre, apellido, email, password,
    });
    await secureTokenStore.setTokens(access_token, refresh_token);
    await SecureStore.setItemAsync(KEY_USUARIO, JSON.stringify(usuario));
    set({ status: 'authenticated', usuario });
  },

  // ── registrar ─────────────────────────────────────────────────────────
  async registrar({ nombre, apellido, email, password }) {
    const { access_token, refresh_token, usuario } = await authApi.registrar({
      nombre, apellido, email, password,
    });
    await secureTokenStore.setTokens(access_token, refresh_token);
    await SecureStore.setItemAsync(KEY_USUARIO, JSON.stringify(usuario));
    set({ status: 'authenticated', usuario });
  },

  // ── setUsuario ────────────────────────────────────────────────────────
  async setUsuario(usuario: UsuarioPerfil) {
    await SecureStore.setItemAsync(KEY_USUARIO, JSON.stringify(usuario));
    set({ usuario });
  },

  // ── logout ────────────────────────────────────────────────────────────
  async logout() {
    const refreshToken = await secureTokenStore.getRefreshToken();
    if (refreshToken) {
      // Fire-and-forget — even if it fails we clear local state
      authApi.logout(refreshToken).catch(() => {});
    }
    await Promise.all([
      secureTokenStore.clearTokens(),
      SecureStore.deleteItemAsync(KEY_USUARIO),
    ]);
    set({ status: 'unauthenticated', usuario: null });
  },
}));
