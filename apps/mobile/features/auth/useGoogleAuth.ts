/**
 * Hook que encapsula el flujo OAuth con Google vía expo-auth-session.
 *
 * Uso:
 *   const { promptAsync, loading } = useGoogleAuth();
 *   <Button onPress={promptAsync} label="Continuar con Google" loading={loading} />
 *
 * Variables de entorno requeridas en apps/mobile/.env:
 *   EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB      — web client ID (para Expo Go / navegador)
 *   EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS      — iOS client ID (para build nativo)
 *   EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID  — Android client ID (para build nativo)
 */
import React from 'react';
import { Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useAuthStore } from './useAuthStore';

// Requerido por expo-auth-session para cerrar el popup del navegador correctamente.
WebBrowser.maybeCompleteAuthSession();

// Google solo acepta el esquema "reverso" del client ID nativo como redirect URI
// (com.googleusercontent.apps.<client_id>:/...) — el default de expo-auth-session
// usa el package name de la app, que Google rechaza con "custom URI scheme is not
// enabled for your Android client". Ese mismo esquema debe estar en app.json → scheme.
const nativeClientId = Platform.OS === 'ios'
  ? process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS
  : process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID;
const redirectUri = nativeClientId
  ? `com.googleusercontent.apps.${nativeClientId.replace('.apps.googleusercontent.com', '')}:/oauthredirect`
  : undefined;

export function useGoogleAuth(onError?: (msg: string) => void) {
  const loginConGoogle = useAuthStore((s) => s.loginConGoogle);
  const [loading, setLoading] = React.useState(false);

  const [, response, promptAsync] = Google.useAuthRequest({
    clientId:         process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
    iosClientId:      process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
    androidClientId:  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
    ...(redirectUri ? { redirectUri } : {}),
  });

  React.useEffect(() => {
    if (!response) return;
    if (response.type !== 'success') return;

    const idToken = response.authentication?.idToken;
    if (!idToken) {
      onError?.('Google no devolvió un id_token. Revisa los Client IDs configurados.');
      return;
    }

    setLoading(true);
    loginConGoogle(idToken)
      .catch((err) => onError?.(err?.message ?? 'Error al autenticar con Google.'))
      .finally(() => setLoading(false));
  }, [response]);

  return { promptAsync, loading };
}
