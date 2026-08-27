/**
 * Hook que encapsula el login con Google vía el SDK nativo
 * (@react-native-google-signin/google-signin).
 *
 * En Android, este SDK valida por SHA-1 + package name registrados en Google
 * Cloud Console — no requiere redirect URIs ni Client ID de Android en el
 * código (Play Services lo resuelve por la firma de la app). Solo hace falta
 * el webClientId, el mismo que usa el backend para verificar el id_token.
 *
 * En iOS no existe ese mecanismo de validación por firma — el SDK necesita
 * el iosClientId explícito para completar el flujo. Sin él, `signIn()` falla
 * en cuanto se ejecuta en un dispositivo/simulador iOS.
 * ponytail: iosClientId queda undefined hasta crear el OAuth client iOS en
 * Google Cloud Console (mismo proyecto que el webClientId) — la app sigue
 * funcionando en Android sin ese valor. Upgrade path: ver apps/mobile/.env.example.
 *
 * Uso:
 *   const { signIn, loading } = useGoogleAuth();
 *   <Button onPress={signIn} label="Continuar con Google" loading={loading} />
 *
 * Variables de entorno en apps/mobile/.env:
 *   EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB — web client ID (requerido, ambas plataformas)
 *   EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS — iOS client ID (requerido solo para iOS)
 */
import React from 'react';
import { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import { useAuthStore } from './useAuthStore';

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
});

export function useGoogleAuth(onError?: (msg: string) => void) {
  const loginConGoogle = useAuthStore((s) => s.loginConGoogle);
  const [loading, setLoading] = React.useState(false);

  const signIn = React.useCallback(async () => {
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) return; // usuario canceló

      const idToken = response.data.idToken;
      if (!idToken) {
        onError?.('Google no devolvió un id_token. Revisa el Client ID configurado.');
        return;
      }

      await loginConGoogle(idToken);
    } catch (err) {
      if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) return;
      onError?.(err instanceof Error ? err.message : 'Error al autenticar con Google.');
    } finally {
      setLoading(false);
    }
  }, [loginConGoogle, onError]);

  return { signIn, loading };
}
