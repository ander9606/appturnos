import { View, Text } from 'react-native';
import { Stack } from 'expo-router';
import type { Rol } from '@api-client';
import { useAuthStore } from '@/features/auth/useAuthStore';

/**
 * Bloquea el acceso a una pantalla si el rol del usuario no está en `roles`.
 * El backend siempre revalida — esto evita que un deep link muestre datos
 * de otros usuarios o un formulario que solo falla al enviar.
 *
 * Usar después de declarar todos los demás hooks de la pantalla (regla de hooks):
 *   const denied = useRoleGuard(['admin_empresa']);
 *   if (denied) return denied;
 */
export function useRoleGuard(roles: readonly Rol[]): React.ReactElement | null {
  const rol = useAuthStore((s) => s.usuario?.rol);
  if (rol && roles.includes(rol)) return null;

  return (
    <>
      <Stack.Screen options={{ title: 'Sin acceso' }} />
      <View className="flex-1 items-center justify-center bg-background px-8">
        <Text className="text-foreground text-base font-semibold text-center">Sin acceso</Text>
        <Text className="text-muted-foreground text-sm text-center mt-2">
          No tienes permiso para ver esta pantalla.
        </Text>
      </View>
    </>
  );
}
