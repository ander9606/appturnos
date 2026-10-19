import { Text } from '@/components/ui/Text';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '@/features/auth/useAuthStore';
import { COLORS } from '@/lib/designTokens';
import { isClientError } from '@/lib/apiErrorMessage';

/**
 * Banner global fijo: avisa sin conexión o si alguna consulta falló.
 * Sin esto, un fetch fallido se veía igual que "no hay datos" en cada pantalla.
 *
 * Solo cuenta errores reintentables (5xx, red) para el banner visual — un 4xx
 * (permiso/rol equivocado, request mal formado) nunca se arregla reintentando,
 * así que mostrarle "desliza para reintentar" al usuario sería engañoso. Esos
 * casos siguen logueados por consola para que se detecten en desarrollo/QA
 * (es así como se encontraron los gates de rol faltantes en la auditoría).
 */
export function StatusBanner() {
  const [offline, setOffline] = useState(false);
  const queryClient = useQueryClient();
  const cache = queryClient.getQueryCache();
  const isAuth = useAuthStore((s) => s.status === 'authenticated');

  useEffect(() => NetInfo.addEventListener((state) => {
    setOffline(state.isConnected === false);
  }), []);

  // useSyncExternalStore evita el warning "Cannot update a component while
  // rendering a different component": el cache cambia de estado (y notifica
  // a sus subscribers) de forma síncrona cuando OTRA pantalla registra su
  // useQuery, lo cual caía en medio del render de esa pantalla con
  // useState + subscribe manual.
  const hasQueryError = useSyncExternalStore(
    (onChange) => cache.subscribe(onChange),
    () => cache.getAll().some((q) => q.state.status === 'error' && !isClientError(q.state.error)),
  );

  useEffect(() => {
    const failed = cache.getAll().filter((q) => q.state.status === 'error');
    if (failed.length > 0) {
      console.warn('[StatusBanner] queries en error:', failed.map((q) => ({
        key: q.queryKey,
        error: q.state.error instanceof Error ? q.state.error.message : q.state.error,
      })));
    }
  }, [hasQueryError, cache]);

  const showQueryError = hasQueryError && isAuth; // sin sesión no hay datos "propios" que hayan fallado
  if (!offline && !showQueryError) return null;

  // Oscuro para el aviso de red (17:1) y rojo oscuro para el de error (4.8:1): el blanco sobre
  // ámbar que había antes medía 2.15:1 y no se leía (docs/DISENO.md §6).
  return (
    <View
      accessibilityRole="alert"
      className={offline ? 'bg-foreground px-4 py-2 flex-row items-center justify-center gap-2' : 'bg-danger-dark px-4 py-2'}
    >
      {offline && <Ionicons name="cloud-offline-outline" size={14} color={COLORS.white} />}
      <Text className="text-white text-xs text-center font-medium">
        {offline
          ? 'Sin conexión · mostrando lo último que guardamos'
          : 'No pudimos cargar todo. Desliza para reintentar.'}
      </Text>
    </View>
  );
}
