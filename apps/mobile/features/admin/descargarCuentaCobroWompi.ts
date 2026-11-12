import * as WebBrowser from 'expo-web-browser';
import { adminApi } from '@api-client';
import { webSafeSecureStore as SecureStore } from '@/lib/secureStore';

/**
 * Abre la cuenta de cobro de un pago Wompi ya procesado. El PDF viaja con
 * ?token= (el navegador externo no manda headers), y el access token dura
 * 15 min: una llamada autenticada antes de leerlo fuerza el refresh silencioso
 * del cliente si ya venció — mismo patrón que features/nomina/descargarCuentaCobro.ts.
 */
export async function descargarCuentaCobroWompi(id: number): Promise<void> {
  await adminApi.listarWompiEventos({ limit: 1 });
  const token = await SecureStore.getItemAsync('appturnos.access_token');
  const base = process.env.EXPO_PUBLIC_API_URL;
  await WebBrowser.openBrowserAsync(`${base}/api/admin/wompi-eventos/${id}/cuenta-cobro?token=${token}`);
}
