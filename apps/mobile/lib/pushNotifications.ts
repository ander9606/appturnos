import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { notificacionesApi } from '@api-client';

// Show notifications while the app is in the foreground.
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
 * Requests push notification permissions and registers the Expo push token
 * with the backend. Best-effort: never throws. Should be called once after
 * the user authenticates.
 */
export async function registerPushNotifications(): Promise<void> {
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

    const { data: token } = await Notifications.getExpoPushTokenAsync();
    await notificacionesApi.registrarExpoToken(token);
  } catch {
    // Push notifications are non-critical — silently ignore errors.
  }
}
