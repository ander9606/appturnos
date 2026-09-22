/**
 * Hook que encapsula "Sign in with Apple" vía expo-apple-authentication.
 *
 * Requerido por App Store guideline 4.8: cualquier app que ofrezca un login
 * social de terceros (acá Google, ver useGoogleAuth.ts) debe ofrecer Sign in
 * with Apple como alternativa equivalente. Solo existe en iOS — Android no
 * tiene el servicio nativo, por eso el botón se monta condicionalmente en
 * login.tsx con `Platform.OS === 'ios'`.
 *
 * Uso:
 *   const { signIn, loading } = useAppleAuth();
 *   <Button onPress={signIn} label="Continuar con Apple" loading={loading} />
 */
import React from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuthStore } from './useAuthStore';

export function useAppleAuth(onError?: (msg: string) => void) {
  const loginConProvider = useAuthStore((s) => s.loginConProvider);
  const [loading, setLoading] = React.useState(false);

  const signIn = React.useCallback(async () => {
    setLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        onError?.('Apple no devolvió un identityToken.');
        return;
      }

      await loginConProvider('apple', credential.identityToken);
    } catch (err: any) {
      if (err?.code === 'ERR_REQUEST_CANCELED') return; // usuario canceló
      onError?.(err instanceof Error ? err.message : 'Error al autenticar con Apple.');
    } finally {
      setLoading(false);
    }
  }, [loginConProvider, onError]);

  return { signIn, loading };
}
