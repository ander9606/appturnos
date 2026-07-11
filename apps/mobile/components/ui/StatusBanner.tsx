import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Banner global fijo: avisa sin conexión o si alguna consulta falló.
 * Sin esto, un fetch fallido se veía igual que "no hay datos" en cada pantalla.
 */
export function StatusBanner() {
  const [offline, setOffline] = useState(false);
  const [hasQueryError, setHasQueryError] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => NetInfo.addEventListener((state) => {
    setOffline(state.isConnected === false);
  }), []);

  useEffect(() => {
    const cache = queryClient.getQueryCache();
    const check = () => setHasQueryError(cache.getAll().some((q) => q.state.status === 'error'));
    check();
    return cache.subscribe(check);
  }, [queryClient]);

  if (!offline && !hasQueryError) return null;

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
