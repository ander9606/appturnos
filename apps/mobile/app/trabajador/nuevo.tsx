/**
 * Crear trabajador — solo admin_empresa.
 * Pushed desde equipo.tsx al presionar el FAB "+".
 */
import React from 'react';
import { Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';

import { useCrearTrabajador } from '@/features/equipo/useEquipo';
import { TrabajadorForm } from '@/features/equipo/TrabajadorForm';
import type { TrabajadorFormValues } from '@/features/equipo/schemas';

export default function NuevoTrabajadorScreen() {
  const router  = useRouter();
  const { mutateAsync } = useCrearTrabajador();

  async function handleSubmit(data: TrabajadorFormValues) {
    try {
      const t = await mutateAsync({
        nombre:       data.nombre,
        apellido:     data.apellido,
        tipo:         data.tipo,
        cedula:       data.cedula   || undefined,
        email:        data.email    || undefined,
        telefono:     data.telefono || undefined,
        cargo:        data.cargo    || undefined,
        tarifa_hora:  data.tarifa_hora,
        salario_base: data.salario_base,
      });
      router.replace(`/trabajador/${t.id}`);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Ocurrió un error. Intenta de nuevo.';
      Alert.alert('Error al crear', msg);
      throw err; // keeps isSubmitting = false correctly
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Nuevo trabajador',
          headerShown: true,
          headerBackTitle: 'Equipo',
          animation: 'slide_from_right',
        }}
      />
      <TrabajadorForm
        onSubmit={handleSubmit}
        submitLabel="Crear trabajador"
        submittingLabel="Creando…"
      />
    </SafeAreaView>
  );
}
