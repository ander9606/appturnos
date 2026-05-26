/**
 * TokenStore implementation usando expo-secure-store.
 * Inyectado en initApiClient() al arrancar la app.
 */
import * as SecureStore from 'expo-secure-store';
import type { TokenStore } from '@api-client';

const KEY_ACCESS  = 'appturnos.access_token';
const KEY_REFRESH = 'appturnos.refresh_token';

export const secureTokenStore: TokenStore = {
  async getAccessToken() {
    return SecureStore.getItemAsync(KEY_ACCESS);
  },
  async getRefreshToken() {
    return SecureStore.getItemAsync(KEY_REFRESH);
  },
  async setTokens(accessToken, refreshToken) {
    await Promise.all([
      SecureStore.setItemAsync(KEY_ACCESS, accessToken),
      SecureStore.setItemAsync(KEY_REFRESH, refreshToken),
    ]);
  },
  async clearTokens() {
    await Promise.all([
      SecureStore.deleteItemAsync(KEY_ACCESS),
      SecureStore.deleteItemAsync(KEY_REFRESH),
    ]);
  },
};
