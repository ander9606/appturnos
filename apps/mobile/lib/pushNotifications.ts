import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { notificacionesApi } from '@api-client';

let _token: string | null = null; // ponytail: module-level cache — upgrade path: SecureStore si el proceso se mata entre registro y logout

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
    if (finalStatus !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    _token = token;
    await notificacionesApi.registrarExpoToken(token);
  } catch {
    // Push notifications are non-critical — silently ignore errors.
  }
}

export async function unregisterPushNotifications(): Promise<void> {
  if (!_token) return;
  await notificacionesApi.desregistrarExpoToken(_token).catch(() => {});
  _token = null;
}
