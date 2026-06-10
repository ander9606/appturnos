/**
 * Root layout — AppTurnos
 *
 * Responsabilidades:
 * 1. Inicializar TanStack Query
 * 2. Rehidratar la sesión desde SecureStore
 * 3. Redirigir a (auth) o (tabs) según el estado de autenticación
 */
import '../global.css';

import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuthStore } from '@/features/auth/useAuthStore';
import { registerPushNotifications } from '@/lib/pushNotifications';

// ── TanStack Query client ─────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,        // 1 minute — workers in the field need fresh-enough data
      retry: (failureCount, error: unknown) => {
        // Don't retry on auth errors or client errors
        if (error && typeof error === 'object' && 'status' in error) {
          const status = (error as { status: number }).status;
          if (status >= 400 && status < 500) return false;
        }
        return failureCount < 2;
      },
    },
  },
});

// ── Auth guard ────────────────────────────────────────────────────────────

function AuthGuard({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const segments = useSegments();
  const status   = useAuthStore((s) => s.status);
  const rehydrate = useAuthStore((s) => s.rehydrate);

  // Rehydrate once on mount
  useEffect(() => {
    rehydrate();
  }, []);

  // Register Expo push token once authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      registerPushNotifications();
    }
  }, [status]);

  useEffect(() => {
    if (status === 'unknown') return; // still loading

    const inAuthGroup  = segments[0] === '(auth)';
    const inAdminGroup = segments[0] === '(admin)';

    const rol = useAuthStore.getState().usuario?.rol;
    const isSuperAdmin = rol === 'super_admin';

    if (status === 'authenticated') {
      if (isSuperAdmin && !inAdminGroup) {
        // Super admin siempre va al panel de administración.
        router.replace('/(admin)');
      } else if (!isSuperAdmin && inAuthGroup) {
        // Usuarios normales autenticados salen del grupo auth.
        router.replace('/(tabs)');
      } else if (!isSuperAdmin && inAdminGroup) {
        // Un usuario no-super que llega al admin (no debería ocurrir) → tabs.
        router.replace('/(tabs)');
      }
    } else if (status === 'unauthenticated' && !inAuthGroup) {
      router.replace('/(auth)/login');
    }
  }, [status, segments]);

  return <>{children}</>;
}

// ── Root layout ───────────────────────────────────────────────────────────

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthGuard>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            {/* Panel de super_admin */}
            <Stack.Screen name="(admin)" />
            {/* Detail screens — full-screen push over the tab bar */}
            <Stack.Screen
              name="turno/[id]"
              options={{
                headerShown: true,
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="turno/nuevo"
              options={{
                headerShown: true,
                animation: 'slide_from_bottom',
                presentation: 'modal',
              }}
            />
            <Stack.Screen
              name="trabajador/[id]"
              options={{
                headerShown: true,
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="trabajador/nuevo"
              options={{
                headerShown: true,
                animation: 'slide_from_right',
              }}
            />
            {/* Marcar ingreso / egreso — pantallas dedicadas */}
            <Stack.Screen
              name="ingreso/[id]"
              options={{
                headerShown: true,
                animation: 'slide_from_bottom',
              }}
            />
            <Stack.Screen
              name="egreso/[id]"
              options={{
                headerShown: true,
                animation: 'slide_from_bottom',
              }}
            />
            <Stack.Screen
              name="liquidacion-turnos"
              options={{
                headerShown: true,
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="postulaciones"
              options={{
                headerShown: false,
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="mis-empresas"
              options={{
                headerShown: true,
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="solicitudes"
              options={{
                headerShown: true,
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="mi-perfil-laboral"
              options={{
                headerShown: true,
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="mis-postulaciones"
              options={{
                headerShown: true,
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="invitar-trabajador"
              options={{
                headerShown: true,
                animation: 'slide_from_bottom',
                presentation: 'modal',
              }}
            />
            <Stack.Screen
              name="cargos"
              options={{
                headerShown: true,
                animation: 'slide_from_right',
              }}
            />
            <Stack.Screen
              name="puntos-marcaje"
              options={{
                headerShown: true,
                animation: 'slide_from_right',
              }}
            />
          </Stack>
        </AuthGuard>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
