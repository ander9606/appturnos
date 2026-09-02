/**
 * Id de correlación de dispositivo — usado por el backend para detectar
 * marcaje sospechoso (dos trabajadores marcando desde el mismo teléfono,
 * indicio de credenciales prestadas). No es un identificador de seguridad.
 */
import { webSafeSecureStore } from './secureStore';

const KEY = 'appturnos.device_id';
let cached: string | null = null;

// ponytail: id aleatorio guardado en el dispositivo, no ligado al hardware —
// se regenera si se reinstala la app. Upgrade path: expo-application
// (androidId / identifierForVendor) si los falsos negativos por reinstalación importan.
export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  let id = await webSafeSecureStore.getItemAsync(KEY);
  if (!id) {
    id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    await webSafeSecureStore.setItemAsync(KEY, id);
  }
  cached = id;
  return id;
}
