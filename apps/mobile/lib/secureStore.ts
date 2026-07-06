/**
 * TokenStore implementation usando expo-secure-store.
 * Inyectado en initApiClient() al arrancar la app.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { TokenStore } from '@api-client';

const KEY_ACCESS  = 'appturnos.access_token';
const KEY_REFRESH = 'appturnos.refresh_token';

// ponytail: expo-secure-store ships a no-op stub on web — fall back to localStorage there.
// Upgrade path: none needed, this app doesn't ship to web.
const isWeb = Platform.OS === 'web';

/** Drop-in replacement for `expo-secure-store` — safe to import anywhere in the app. */
export const webSafeSecureStore = {
  getItemAsync: (k: string) => isWeb ? Promise.resolve(localStorage.getItem(k)) : SecureStore.getItemAsync(k),
  setItemAsync: (k: string, v: string) => isWeb ? Promise.resolve(localStorage.setItem(k, v)) : SecureStore.setItemAsync(k, v),
  deleteItemAsync: (k: string) => isWeb ? Promise.resolve(localStorage.removeItem(k)) : SecureStore.deleteItemAsync(k),
};

export const secureTokenStore: TokenStore = {
  async getAccessToken() {
    return webSafeSecureStore.getItemAsync(KEY_ACCESS);
  },
  async getRefreshToken() {
    return webSafeSecureStore.getItemAsync(KEY_REFRESH);
  },
  async setTokens(accessToken, refreshToken) {
    await Promise.all([
      webSafeSecureStore.setItemAsync(KEY_ACCESS, accessToken),
      webSafeSecureStore.setItemAsync(KEY_REFRESH, refreshToken),
    ]);
  },
  async clearTokens() {
    await Promise.all([
      webSafeSecureStore.deleteItemAsync(KEY_ACCESS),
      webSafeSecureStore.deleteItemAsync(KEY_REFRESH),
    ]);
  },
};
