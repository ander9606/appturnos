import * as WebBrowser from 'expo-web-browser';
import { adminApi } from '@api-client';
import { webSafeSecureStore as SecureStore } from '@/lib/secureStore';

/**
 * Abre la cuenta de cobro del período vigente actual de una empresa, sin
 * depender de que exista un evento Wompi puntual. Mismo patrón de ?token=
 * que descargarCuentaCobroWompi.ts (el navegador externo no manda headers).
 */
export async function descargarCuentaCobroEmpresa(empresaId: number): Promise<void> {
  await adminApi.listarWompiEventos({ limit: 1 });
  const token = await SecureStore.getItemAsync('appturnos.access_token');
  const base = process.env.EXPO_PUBLIC_API_URL;
  await WebBrowser.openBrowserAsync(`${base}/api/admin/empresas/${empresaId}/cuenta-cobro?token=${token}`);
}
