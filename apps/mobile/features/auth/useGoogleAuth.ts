/**
 * Hook que encapsula el flujo OAuth con Google vía expo-auth-session.
 *
 * Flujo:
 *   1. Genera un nonce aleatorio (SHA-256 para enviarlo a Google, raw para verificarlo)
 *   2. Google.useAuthRequest con responseType='id_token' solicita el id_token directamente
 *   3. Al recibir respuesta exitosa, envía id_token + nonce raw al backend
 *   4. El backend verifica ambos contra google-auth-library
 *
 * Variables de entorno requeridas en apps/mobile/.env:
 *   EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB      — web client ID (para Expo Go / navegador)
 *   EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS      — iOS client ID (para build nativo)
 *   EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID  — Android client ID (para build nativo)
 */
import React from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import { ResponseType } from 'expo-auth-session';
import { useAuthStore } from './useAuthStore';

WebBrowser.maybeCompleteAuthSession();

async function generarNonce(): Promise<{ raw: string; hashed: string }> {
  const raw    = Crypto.randomUUID();
  const hashed = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    raw,
    { encoding: Crypto.CryptoEncoding.HEX },
  );
  return { raw, hashed };
}

export function useGoogleAuth(onError?: (msg: string) => void) {
  const loginConGoogle = useAuthStore((s) => s.loginConGoogle);
  const [loading, setLoading]   = React.useState(false);
  const nonceRef = React.useRef<{ raw: string; hashed: string } | null>(null);

  // Genera el nonce al montar para que esté listo antes del primer promptAsync
  React.useEffect(() => {
    generarNonce().then((n) => { nonceRef.current = n; });
  }, []);

  const [, response, _promptAsync] = Google.useAuthRequest({
    clientId:        process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
    iosClientId:     process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
    responseType:    ResponseType.IdToken,
    // Google exige el nonce hasheado (SHA-256 hex) en el request;
    // el id_token devuelto lo incluye como claim para que el backend lo verifique.
    extraParams:     { nonce: nonceRef.current?.hashed ?? '' },
  });

  React.useEffect(() => {
    if (!response || response.type !== 'success') return;

    const idToken = response.params?.id_token;
    if (!idToken) {
      onError?.('Google no devolvió un id_token. Verifica que el Client ID sea correcto y sea de tipo Web.');
      return;
    }

    setLoading(true);
    loginConGoogle(idToken)
      .catch((err) => onError?.(err?.message ?? 'Error al autenticar con Google.'))
      .finally(async () => {
        // Rota el nonce para el siguiente intento
        nonceRef.current = await generarNonce();
        setLoading(false);
      });
  }, [response]);

  const promptAsync = React.useCallback(async () => {
    // Asegura que el nonce esté listo antes de abrir el diálogo
    if (!nonceRef.current) {
      nonceRef.current = await generarNonce();
    }
    // Reconstruye el request con el nonce actualizado antes de lanzar
    return _promptAsync({});
  }, [_promptAsync]);

  return { promptAsync, loading };
}
