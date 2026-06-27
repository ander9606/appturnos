import { useState, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const KEY = 'appturnos.biometric_enabled';
type AuthStatus = 'unknown' | 'authenticated' | 'unauthenticated';

export function useBiometricLock(authStatus: AuthStatus) {
  const [locked,    setLocked]     = useState(false);
  const [supported, setSupported]  = useState(false);
  const [enabled,   setEnabledSt]  = useState(false);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
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
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Confirma tu identidad',
      fallbackLabel: 'Usar PIN',
    });
    if (result.success) setLocked(false);
    return result.success;
  };

  const setEnabled = async (val: boolean) => {
    await SecureStore.setItemAsync(KEY, val ? '1' : '0');
    setEnabledSt(val);
    if (!val) setLocked(false);
  };

  return { locked, supported, enabled, unlock, setEnabled };
}
