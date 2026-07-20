/**
 * Auth store — Zustand
 *
 * Responsabilidades:
 * - Guardar la sesión en memoria y en expo-secure-store
 * - Exponer acciones login / logout / activarCuenta / rehydrate
 * - Ser la única fuente de verdad sobre si el usuario está autenticado
 */
import { create } from 'zustand';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { authApi, initApiClient, type UsuarioPerfil } from '@api-client';
import { secureTokenStore, webSafeSecureStore as SecureStore } from '@/lib/secureStore';
import { unregisterPushNotifications } from '@/lib/pushNotifications';
import { queryClient } from '@/lib/queryClient';

// ── Constants ─────────────────────────────────────────────────────────────

const KEY_USUARIO      = 'appturnos.usuario';
const KEY_HAS_LAUNCHED = 'appturnos.hasLaunched';

// ponytail: SecureStore (Keychain/Keystore) tiene un límite práctico de ~2048 bytes.
// foto_perfil es un avatar en base64 que puede superarlo por sí solo, así que no se
// cachea — se vuelve a traer del server en el fetch de fondo de rehydrate().
// Upgrade path: si se necesita offline-first para la foto, mover este cache a AsyncStorage.
function cacheUsuario(usuario: UsuarioPerfil) {
  return SecureStore.setItemAsync(KEY_USUARIO, JSON.stringify({ ...usuario, foto_perfil: null }));
}

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
  hasLaunched: boolean;

  /** Llama initApiClient + lee tokens del secure store al arrancar la app */
  rehydrate(): Promise<void>;

  /** Marca que el usuario ya vio la pantalla de bienvenida */
  markLaunched(): Promise<void>;

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
    actividad?: string;
    descripcion?: string;
    telefono?: string;
    email_empresa?: string;
    direccion?: string;
    ciudad?: string;
    nombre: string;
    apellido?: string;
    email: string;
    password: string;
    email_token: string;
  }): Promise<void>;

  /** Registro libre para trabajador_turnos (marketplace) */
  registrar(params: {
    nombre: string;
    apellido?: string;
    email: string;
    telefono: string;
    password: string;
    email_token: string;
    telefono_token: string;
  }): Promise<void>;

  /** Login / registro vía Google OAuth. Devuelve `tipo` para que el caller sepa si fue registro. */
  loginConGoogle(idToken: string): Promise<'login' | 'vinculacion' | 'registro'>;

  /** Actualiza el usuario en memoria y en SecureStore (tras edición de perfil) */
  setUsuario(usuario: UsuarioPerfil): Promise<void>;

  /** Cierra sesión: revoca refresh token + limpia store */
  logout(): Promise<void>;
}

// ── Store ─────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()((set, get) => ({
  status: 'unknown',
  usuario: null,
  hasLaunched: false,

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

    const [accessToken, cachedUsuario, launched] = await Promise.all([
      secureTokenStore.getAccessToken(),
      SecureStore.getItemAsync(KEY_USUARIO),
      SecureStore.getItemAsync(KEY_HAS_LAUNCHED),
    ]);
    if (launched) set({ hasLaunched: true });

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
      await cacheUsuario(usuario);
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
    await cacheUsuario(usuario);
    queryClient.clear(); // evita que errores/datos de una sesión anterior (incluso de otra cuenta) se filtren a esta
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
  async registrarEmpresa({ nombre_empresa, nit, actividad, descripcion, telefono, email_empresa, direccion, ciudad, nombre, apellido, email, password, email_token }) {
    const { access_token, refresh_token, usuario } = await authApi.registrarEmpresa({
      nombre_empresa, nit, actividad, descripcion, telefono, email_empresa, direccion, ciudad, nombre, apellido, email, password, email_token,
    });
    await secureTokenStore.setTokens(access_token, refresh_token);
    await cacheUsuario(usuario);
    queryClient.clear();
    set({ status: 'authenticated', usuario });
  },

  // ── registrar ─────────────────────────────────────────────────────────
  async registrar({ nombre, apellido, email, telefono, password, email_token, telefono_token }) {
    const { access_token, refresh_token, usuario } = await authApi.registrar({
      nombre, apellido, email, telefono, password, email_token, telefono_token,
    });
    await secureTokenStore.setTokens(access_token, refresh_token);
    await cacheUsuario(usuario);
    queryClient.clear();
    set({ status: 'authenticated', usuario });
  },

  // ── loginConGoogle ────────────────────────────────────────────────────
  async loginConGoogle(idToken) {
    const { access_token, refresh_token, usuario, tipo } = await authApi.loginConProvider('google', idToken);
    await secureTokenStore.setTokens(access_token, refresh_token);
    await cacheUsuario(usuario);
    queryClient.clear();
    set({ status: 'authenticated', usuario });
    return tipo;
  },

  // ── setUsuario ────────────────────────────────────────────────────────
  async setUsuario(usuario: UsuarioPerfil) {
    await cacheUsuario(usuario);
    set({ usuario });
  },

  // ── markLaunched ──────────────────────────────────────────────────────
  async markLaunched() {
    await SecureStore.setItemAsync(KEY_HAS_LAUNCHED, '1');
    set({ hasLaunched: true });
  },

  // ── logout ────────────────────────────────────────────────────────────
  async logout() {
    unregisterPushNotifications(); // best-effort, fire-and-forget
    const refreshToken = await secureTokenStore.getRefreshToken();
    if (refreshToken) {
      // Fire-and-forget — even if it fails we clear local state
      authApi.logout(refreshToken).catch(() => {});
    }
    await Promise.all([
      secureTokenStore.clearTokens(),
      SecureStore.deleteItemAsync(KEY_USUARIO),
    ]);
    queryClient.clear(); // evita que datos/errores de esta sesión se filtren a la siguiente cuenta
    set({ status: 'unauthenticated', usuario: null });
  },
}));
