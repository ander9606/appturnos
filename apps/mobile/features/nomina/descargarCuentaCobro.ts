import * as WebBrowser from 'expo-web-browser';
import { cuentasCobroApi } from '@api-client';
import { webSafeSecureStore as SecureStore } from '@/lib/secureStore';

/**
 * Abre el PDF de una cuenta de cobro. El PDF viaja con ?token= (el navegador no manda headers),
 * y el access token dura 15 min: la llamada a obtener() fuerza el refresh silencioso del cliente
 * si ya venció, así que el token que se lee después siempre sirve.
 */
export async function descargarCuentaCobro(id: number): Promise<void> {
  await cuentasCobroApi.obtener(id);
  const token = await SecureStore.getItemAsync('appturnos.access_token');
  const base = process.env.EXPO_PUBLIC_API_URL;
  await WebBrowser.openBrowserAsync(`${base}/api/cuentas-cobro/${id}/pdf?token=${token}`);
}
