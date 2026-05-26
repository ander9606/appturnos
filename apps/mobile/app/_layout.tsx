/**
 * Root layout — AppTurnos
 *
 * Responsabilidades:
 * 1. Inicializar TanStack Query
 * 2. Rehidratar la sesión desde SecureStore
 * 3. Redirigir a (auth) o (tabs) según el estado de autenticación
 */
import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useAuthStore } from '@/features/auth/useAuthStore';

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

  useEffect(() => {
    if (status === 'unknown') return; // still loading

    const inAuthGroup = segments[0] === '(auth)';

    if (status === 'authenticated' && inAuthGroup) {
      router.replace('/(tabs)');
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
          </Stack>
        </AuthGuard>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
