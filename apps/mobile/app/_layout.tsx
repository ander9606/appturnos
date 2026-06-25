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
import * as Notifications from 'expo-notifications';

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
  const status      = useAuthStore((s) => s.status);
  const usuario     = useAuthStore((s) => s.usuario);
  const rol         = usuario?.rol;
  const hasLaunched = useAuthStore((s) => s.hasLaunched);
  const rehydrate   = useAuthStore((s) => s.rehydrate);

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

  // Navigate to the relevant screen when the user taps a push notification
  useEffect(() => {
    if (status !== 'authenticated') return;
    const sub = Notifications.addNotificationResponseReceivedListener((response: any) => {
      const data = (response.notification.request.content.data ?? {}) as Record<string, unknown>;
      if (data.asignacion_id) {
        router.push(`/turno/${data.asignacion_id}`);
      } else {
        router.push('/notificaciones');
      }
    });
    return () => sub.remove();
  }, [status]);

  useEffect(() => {
    if (status === 'unknown') return; // still loading

    const inAuthGroup     = segments[0] === '(auth)';
    const inAdminGroup    = segments[0] === '(admin)';
    const inCompletarPerfil = segments[0] === 'completar-perfil';

    const isSuperAdmin = rol === 'super_admin';
    const welcomeRoute = hasLaunched ? '/(auth)/login' : '/(auth)/';

    if (status === 'authenticated') {
      // OAuth users who registered without a phone must complete their profile first.
      const needsPhone = !usuario?.telefono;
      if (needsPhone && !inCompletarPerfil && !isSuperAdmin) {
        router.replace('/completar-perfil');
        return;
      }

      if (isSuperAdmin && !inAdminGroup) {
        router.replace('/(admin)');
      } else if (!isSuperAdmin && (inAuthGroup || inCompletarPerfil) && !needsPhone) {
        router.replace('/(tabs)');
      } else if (!isSuperAdmin && inAdminGroup) {
        router.replace('/(tabs)');
      }
    } else if (status === 'unauthenticated' && !inAuthGroup) {
      router.replace(welcomeRoute);
    }
  }, [status, segments, rol, hasLaunched, usuario]);

  return <>{children}</>;
}

// ── Root layout ───────────────────────────────────────────────────────────

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthGuard>
          {/* Default: header visible, slide from right.
              Only exceptions are registered explicitly. */}
          <Stack screenOptions={{ headerShown: true, animation: 'slide_from_right' }}>
            {/* Tab groups — sin header (cada tab lo gestiona) */}
            <Stack.Screen name="(auth)"  options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)"  options={{ headerShown: false }} />
            <Stack.Screen name="(admin)" options={{ headerShown: false }} />
            {/* postulaciones usa su propio header personalizado */}
            <Stack.Screen name="postulaciones" options={{ headerShown: false }} />
            {/* Detail screens — slide from right */}
            <Stack.Screen name="turno/[id]"      options={{ headerShown: true }} />
            <Stack.Screen name="trabajador/[id]" options={{ headerShown: true }} />
            {/* Modales — sube desde abajo */}
            <Stack.Screen name="turno/nuevo"          options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
            <Stack.Screen name="trabajador/nuevo"     options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
            <Stack.Screen name="invitar-trabajador"   options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
            {/* Integración logiq360 — solo admin_empresa */}
            <Stack.Screen name="integracion/config" options={{ title: 'Integración logiq360' }} />
            <Stack.Screen name="integracion/estado" options={{ title: 'Estado de la cola' }} />
            <Stack.Screen name="integracion/conciliacion" options={{ title: 'Conciliación de personal' }} />
            {/* Marcaje turnos — transición vertical */}
            <Stack.Screen name="ingreso/[id]" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="egreso/[id]"  options={{ animation: 'slide_from_bottom' }} />
            {/* Marcaje nómina — pantalla dedicada con contador */}
            <Stack.Screen name="nomina-ingreso" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
            {/* Liquidación de turnos — gestores y admin */}
            <Stack.Screen name="liquidacion-turnos" options={{ title: 'Liquidación de turnos' }} />
            {/* Liquidación trimestral de turnos eventuales */}
            <Stack.Screen name="liquidacion-eventual" options={{ title: 'Turnos eventuales' }} />
            {/* Notificaciones — inbox accesible desde la campana */}
            <Stack.Screen name="notificaciones" options={{ title: 'Notificaciones' }} />
            {/* Completar perfil — usuarios OAuth sin teléfono registrado */}
            <Stack.Screen name="completar-perfil" options={{ headerShown: false }} />
            {/* Directorio de empresas — trabajador_turnos */}
            <Stack.Screen name="directorio-empresas" options={{ title: 'Buscar empresa' }} />
            {/* Mis empresas — vínculos del trabajador */}
            <Stack.Screen name="mis-empresas" options={{ title: 'Mis empresas' }} />
          </Stack>
        </AuthGuard>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
