import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/features/auth/useAuthStore';
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
  const [hasQueryError, setHasQueryError] = useState(false);
  const queryClient = useQueryClient();
  const isAuth = useAuthStore((s) => s.status === 'authenticated');

  useEffect(() => NetInfo.addEventListener((state) => {
    setOffline(state.isConnected === false);
  }), []);

  useEffect(() => {
    const cache = queryClient.getQueryCache();
    const check = () => {
      const failed = cache.getAll().filter((q) => q.state.status === 'error');
      if (failed.length > 0) {
        console.warn('[StatusBanner] queries en error:', failed.map((q) => ({
          key: q.queryKey,
          error: q.state.error instanceof Error ? q.state.error.message : q.state.error,
        })));
      }
      setHasQueryError(failed.some((q) => !isClientError(q.state.error)));
    };
    check();
    return cache.subscribe(check);
  }, [queryClient]);

  const showQueryError = hasQueryError && isAuth; // sin sesión no hay datos "propios" que hayan fallado
  if (!offline && !showQueryError) return null;

  return (
    <View className={offline ? 'bg-warning px-4 py-2' : 'bg-danger px-4 py-2'}>
      <Text className="text-white text-xs text-center font-medium">
        {offline
          ? 'Sin conexión — mostrando la última información guardada'
          : 'No se pudo cargar todo. Desliza para reintentar.'}
      </Text>
    </View>
  );
}
