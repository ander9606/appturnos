import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Sentry from '@sentry/react-native';
import { notificacionesApi } from '@api-client';
import { webSafeSecureStore as SecureStore } from '@/lib/secureStore';

const KEY_PUSH_TOKEN = 'appturnos.push_token';

// Intenta `fn`; si falla, espera cada valor de `esperas` (ms) y reintenta.
// Total de intentos = esperas.length + 1. El último error se propaga al caller.
async function reintentar<T>(fn: () => Promise<T>, esperas = [3000, 10000]): Promise<T> {
  for (const espera of esperas) {
    try {
      return await fn();
    } catch {
      await new Promise((r) => setTimeout(r, espera));
    }
  }
  return fn();
}

// ponytail: setNotificationHandler sí funciona en Expo Go (solo aplica a notificaciones locales)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Registra el Expo push token en el backend. No-op en Expo Go (SDK 53+ eliminó
 * push remoto de Expo Go — el ERROR en consola es del propio módulo, no un crash).
 */
export async function registerPushNotifications(): Promise<void> {
  // ponytail: skip en Expo Go — upgrade path: development build
  if (Constants.appOwnership === 'expo') return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'AppTurnos',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }
    const { status: current } = await Notifications.getPermissionsAsync();
    let finalStatus = current;
    if (current !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      Sentry.captureMessage(`push-registration: permiso denegado (${finalStatus})`, { level: 'info', tags: { flow: 'push-registration' } });
      return;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    // ponytail: este efecto corre justo al autenticar (cold start) — la red del
    // dispositivo a veces no está lista aún. Reintentos con espera creciente cubren esa carrera.
    await reintentar(async () => {
      const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      await SecureStore.setItemAsync(KEY_PUSH_TOKEN, token);
      await notificacionesApi.registrarExpoToken(token);
    });
  } catch (err) {
    // Push notifications son no-críticas para el flujo — no se propaga el error,
    // pero se reporta para poder diagnosticar por qué no llegan tokens en producción.
    // SERVICE_NOT_AVAILABLE = FCM/Google inalcanzable (fallo transitorio, no nuestro): warning, no error.
    const transitorio = String((err as Error)?.message).includes('SERVICE_NOT_AVAILABLE');
    Sentry.captureException(err, { level: transitorio ? 'warning' : 'error', tags: { flow: 'push-registration' } });
  }
}

export async function unregisterPushNotifications(): Promise<void> {
  const token = await SecureStore.getItemAsync(KEY_PUSH_TOKEN);
  if (!token) return;
  await notificacionesApi.desregistrarExpoToken(token).catch(() => {});
  await SecureStore.deleteItemAsync(KEY_PUSH_TOKEN);
}
