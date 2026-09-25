import React from 'react';
import { View, Text, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useActualizarExtras } from '@/features/nomina/useNomina';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/lib/toast';
import { ApiError } from '@api-client';
import { t } from '@/lib/i18n';

/** El 403 que tira ofertas.service.js#validarAceptaExtras cuando el flag está apagado. */
export function esErrorTurnosExtraApagadas(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403 && err.message.includes('turnos extra');
}

/**
 * Se muestra en vez del error genérico cuando un trabajador_nomina sin
 * acepta_extras choca contra el 403 del backend al listar/abrir ofertas de
 * turnos extra. Activa el flag sin salir de la pantalla — reusa el mismo
 * useActualizarExtras() del switch en perfil.tsx.
 */
export function TurnosExtraOptIn() {
  const mutation = useActualizarExtras();

  const handleActivar = () => {
    mutation.mutate(true, {
      onSuccess: () => showToast('Turnos extra activados'),
      onError: (err) => Alert.alert('Error', (err as ApiError).message ?? t('common.error')),
    });
  };

  return (
    <View className="flex-1 items-center justify-center gap-3 px-8 py-16">
      <Ionicons name="briefcase-outline" size={48} color="#94A3B8" />
      <Text className="text-base font-semibold text-foreground text-center">
        Activa turnos extra para ver esto
      </Text>
      <Text className="text-sm text-muted-foreground text-center">
        Recibe ofertas de turnos adicionales fuera de tu jornada, con pago aparte de tu nómina.
      </Text>
      <Button
        label="Activar turnos extra"
        onPress={handleActivar}
        loading={mutation.isPending}
        size="sm"
      />
    </View>
  );
}
