import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Sentry from '@sentry/react-native';
import { notificacionesApi } from '@api-client';
import { webSafeSecureStore as SecureStore } from '@/lib/secureStore';

const KEY_PUSH_TOKEN = 'appturnos.push_token';

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
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await SecureStore.setItemAsync(KEY_PUSH_TOKEN, token);
    await notificacionesApi.registrarExpoToken(token);
  } catch (err) {
    // Push notifications son no-críticas para el flujo — no se propaga el error,
    // pero se reporta para poder diagnosticar por qué no llegan tokens en producción.
    Sentry.captureException(err, { tags: { flow: 'push-registration' } });
  }
}

export async function unregisterPushNotifications(): Promise<void> {
  const token = await SecureStore.getItemAsync(KEY_PUSH_TOKEN);
  if (!token) return;
  await notificacionesApi.desregistrarExpoToken(token).catch(() => {});
  await SecureStore.deleteItemAsync(KEY_PUSH_TOKEN);
}
