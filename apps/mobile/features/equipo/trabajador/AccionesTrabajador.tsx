import { Text } from '@/components/ui/Text';
import { Spinner } from '@/components/ui/Spinner';
import { showAlert } from '@/lib/alertDialog';
import React from 'react';
import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { confirm } from '@/lib/confirmDialog';
import { showToast } from '@/lib/toast';
import { useDesactivarTrabajador, useEliminarTrabajadorDefinitivo } from '@/features/equipo/useEquipo';
import { useBloquearOfertas } from '@/features/empresas/useTrabajadorEmpresa';
import { ApiError } from '@api-client';
import type { Trabajador } from '@api-client';
import { COLORS } from '@/lib/designTokens';

/** Dejar de ofrecerle turnos — admin_empresa + jefe_turnos, solo tipo turnos/ambos. */
export function BloquearOfertasButton({ t }: { t: Trabajador }) {
  const bloquearOfertas = useBloquearOfertas();

  async function confirmBloquearOfertas() {
    const ok = await confirm({
      title: '¿Dejar de ofrecerle turnos?',
      message: `${t.nombre} ${t.apellido} ya no verá ofertas tuyas ni podrá tomar turnos contigo, hasta que vuelva a solicitar el vínculo. Su ficha y su historial no se tocan.`,
      confirmLabel: 'Dejar de ofrecerle turnos',
      destructive: true,
    });
    if (!ok) return;
    bloquearOfertas.mutate(t.id, {
      onSuccess: () => showToast('Ya no se le ofrecerán turnos.'),
      onError: (err: unknown) => {
        const msg = err instanceof ApiError ? err.message : 'No se pudo completar la acción';
        showAlert('Error', msg);
      },
    });
  }

  return (
    <View className="mx-4 mt-6">
      <Pressable
        onPress={confirmBloquearOfertas}
        disabled={bloquearOfertas.isPending}
        className="h-12 rounded-xl items-center justify-center border border-warning active:bg-warning/10 disabled:opacity-50"
      >
        {bloquearOfertas.isPending ? (
          <Spinner size="small" color={COLORS.warningDark} />
        ) : (
          <Text className="text-warning font-semibold">Dejar de ofrecerle turnos</Text>
        )}
      </Pressable>
    </View>
  );
}

/** Desactivar — admin only, active workers. */
export function DesactivarButton({ t }: { t: Trabajador }) {
  const router = useRouter();
  const desactivar = useDesactivarTrabajador();

  async function confirmDesactivar() {
    const ok = await confirm({
      title: '¿Desactivar trabajador?',
      message: `${t.nombre} ${t.apellido} no podrá iniciar sesión ni recibir turnos.`,
      confirmLabel: 'Desactivar',
      destructive: true,
    });
    if (!ok) return;
    desactivar.mutate(t.id, {
      onSuccess: () => router.back(),
      onError: () => showAlert('Error', 'No se pudo desactivar. Intenta de nuevo.'),
    });
  }

  return (
    <View className="mx-4 mt-6">
      <Pressable
        onPress={confirmDesactivar}
        className="h-12 rounded-xl items-center justify-center border border-danger active:bg-danger/10"
      >
        <Text className="text-danger font-semibold">Desactivar trabajador</Text>
      </Pressable>
    </View>
  );
}

/** Eliminar definitivamente — admin only, once deactivated. */
export function EliminarButton({ t }: { t: Trabajador }) {
  const router = useRouter();
  const eliminarDefinitivo = useEliminarTrabajadorDefinitivo();

  async function confirmEliminarDefinitivo() {
    const ok = await confirm({
      title: '¿Eliminar trabajador?',
      message: `Esto borra a ${t.nombre} ${t.apellido} para siempre. No se puede deshacer. Si tiene turnos, nómina o calificaciones registradas, no se podrá eliminar.`,
      confirmLabel: 'Eliminar',
      destructive: true,
    });
    if (!ok) return;
    eliminarDefinitivo.mutate(t.id, {
      onSuccess: () => router.back(),
      onError: (err: unknown) => {
        const msg = err instanceof ApiError ? err.message : 'No se pudo eliminar. Intenta de nuevo.';
        showAlert('Error', msg);
      },
    });
  }

  return (
    <View className="mx-4 mt-6">
      <Pressable
        onPress={confirmEliminarDefinitivo}
        disabled={eliminarDefinitivo.isPending}
        className="h-12 rounded-xl items-center justify-center bg-danger active:bg-danger/80 disabled:opacity-50"
      >
        <Text className="text-white font-semibold">
          {eliminarDefinitivo.isPending ? 'Eliminando…' : 'Eliminar trabajador'}
        </Text>
      </Pressable>
    </View>
  );
}
