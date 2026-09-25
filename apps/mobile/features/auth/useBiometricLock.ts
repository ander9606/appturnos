import { useState, useEffect, useRef } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { webSafeSecureStore as SecureStore } from '@/lib/secureStore';
import { showToast } from '@/lib/toast';

const isWeb = Platform.OS === 'web';

const KEY = 'appturnos.biometric_enabled';
type AuthStatus = 'unknown' | 'authenticated' | 'unauthenticated';

export function useBiometricLock(authStatus: AuthStatus) {
  const [locked,    setLocked]     = useState(false);
  const [supported, setSupported]  = useState(false);
  const [enabled,   setEnabledSt]  = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const appStateRef = useRef(AppState.currentState);
  // Evita llamar authenticateAsync dos veces en paralelo (auto-prompt al montar +
  // toque manual del botón) — el diálogo nativo se cuelga con dos prompts concurrentes.
  const authenticatingRef = useRef(false);

  useEffect(() => {
    // ponytail: no biometrics/SecureStore on web — feature stays off there.
    if (isWeb) return;
    (async () => {
      const [hw, enrolled, pref] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        SecureStore.getItemAsync(KEY),
      ]);
      const sup = hw && enrolled;
      const en  = pref === '1';
      setSupported(sup);
      setEnabledSt(en);
      if (sup && en && authStatus === 'authenticated') setLocked(true);
    })();
  }, []);

  // Re-lock when the app goes to background
  useEffect(() => {
    if (!supported || !enabled) return;
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appStateRef.current === 'active' && next.match(/inactive|background/)) {
        if (authStatus === 'authenticated') setLocked(true);
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [supported, enabled, authStatus]);

  const unlock = async (): Promise<boolean> => {
    if (authenticatingRef.current) return false;
    authenticatingRef.current = true;
    setAuthenticating(true);
    try {
      // ponytail: authenticateAsync a veces se cuelga sin resolver si la app pasa a
      // background a mitad del prompt nativo (llamada entrante, botón home en algunos
      // Android) — sin este timeout el botón queda en "Verificando…" para siempre.
      // 15s es suficiente para un escaneo lento; más que eso se siente colgado.
      const result = await Promise.race([
        LocalAuthentication.authenticateAsync({
          promptMessage: 'Confirma tu identidad',
          // "código" cubre PIN/patrón (Android) y passcode (iOS) — fallbackLabel
          // se muestra tal cual en el diálogo nativo de ambas plataformas.
          fallbackLabel: 'Usar código',
        }),
        new Promise<{ success: false; error: 'timeout' }>((resolve) =>
          setTimeout(() => resolve({ success: false, error: 'timeout' }), 15_000)
        ),
      ]);
      if (result.success) {
        setLocked(false);
      } else if (result.error !== 'user_cancel' && result.error !== 'app_cancel' && result.error !== 'system_cancel') {
        // No avisar en cancelaciones voluntarias — el usuario ya sabe que canceló.
        showToast(
          result.error === 'timeout'
            ? 'La verificación tardó demasiado. Intenta de nuevo.'
            : 'No se pudo verificar tu identidad. Intenta de nuevo o usa tu código.'
        );
      }
      return result.success;
    } catch {
      showToast('No se pudo verificar tu identidad. Intenta de nuevo o usa tu código.');
      return false;
    } finally {
      authenticatingRef.current = false;
      setAuthenticating(false);
    }
  };

  const setEnabled = async (val: boolean) => {
    if (isWeb) return;
    await SecureStore.setItemAsync(KEY, val ? '1' : '0');
    setEnabledSt(val);
    if (!val) setLocked(false);
  };

  return { locked, supported, enabled, unlock, setEnabled, authenticating };
}
