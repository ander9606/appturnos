import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { COLORS } from '@/lib/designTokens';
import { showAlert } from '@/lib/alertDialog';
import { confirm } from '@/lib/confirmDialog';
import { showToast } from '@/lib/toast';
import { useAplicar, useRetirar } from '@/features/turnos/useTurnos';
import { ApiError } from '@api-client';
import type { Asignacion, OfertaPuesto } from '@api-client';

/** Llamada a la acción del trabajador: aplicar al cargo elegido, retirarse, o el aviso de por qué ya no puede. */
export function AplicarOfertaCta({ id, esPasado, turnoIniciado, yaAplicado, miAsignacion, miCupoLleno, selectedPuesto }: {
  id: number | null;
  esPasado: boolean;
  turnoIniciado: boolean;
  yaAplicado: boolean;
  miAsignacion: Asignacion | undefined;
  miCupoLleno: boolean;
  selectedPuesto: OfertaPuesto | undefined;
}) {
  const aplicarM = useAplicar();
  const retirarM = useRetirar();

  async function handleRetirar() {
    if (!miAsignacion?.puesto_id || !id) return;
    const ok = await confirm({
      title: 'Retirar postulación',
      message: '¿Retirar tu postulación a este turno?',
      cancelLabel: 'Volver',
      confirmLabel: 'Retirar',
      destructive: true,
    });
    if (!ok) return;
    try {
      await retirarM.mutateAsync({ ofertaId: id, puestoId: miAsignacion.puesto_id });
    } catch (err) {
      showAlert('Error', err instanceof ApiError ? err.message : 'No se pudo retirar la postulación.');
    }
  }

  async function handleAplicar() {
    if (!selectedPuesto) return;
    try {
      const result = await aplicarM.mutateAsync({ ofertaId: id!, puestoId: selectedPuesto.id });

      // Mostrar warning si el turno ya comenzó
      if (result.warnings && result.warnings.length > 0) {
        showToast(result.warnings[0]);
      }

      showToast(`Has solicitado el turno como ${selectedPuesto.cargo_nombre}. El gestor revisará tu solicitud.`);
    } catch (err) {
      showAlert('Error', err instanceof ApiError ? err.message : 'No se pudo aplicar.');
    }
  }

  return (
    <View>
      {esPasado ? (
        <View className="bg-muted rounded-2xl px-5 py-4 flex-row items-center gap-3">
          <Ionicons name="time-outline" size={20} color={COLORS.placeholder} />
          <Text className="text-sm text-muted-foreground">Evento finalizado</Text>
        </View>
      ) : yaAplicado ? (
        <View className="gap-3">
          {miAsignacion?.estado === 'pendiente' && miCupoLleno ? (
            <View className="bg-warning-light rounded-2xl px-5 py-4 flex-row items-center gap-3">
              <Ionicons name="alert-circle-outline" size={22} color={COLORS.warningDark} />
              <Text className="text-sm font-semibold text-amber-700 flex-1">
                Cupo lleno — tu postulación se mantiene. Te avisaremos si se libera un cupo o se amplía la oferta.
              </Text>
            </View>
          ) : (
            <View className="bg-info/10 rounded-2xl px-5 py-4 flex-row items-center gap-3">
              <Ionicons name="checkmark-circle-outline" size={22} color={COLORS.info} />
              <Text className="text-sm font-semibold text-info">
                {miAsignacion?.estado === 'pendiente' ? 'Ya estás postulado a este turno' : 'Ya estás confirmado en este turno'}
              </Text>
            </View>
          )}
          {miAsignacion?.estado === 'pendiente' && (
            <Button
              label={retirarM.isPending ? 'Retirando…' : 'Retirar postulación'}
              variant="danger"
              fullWidth
              loading={retirarM.isPending}
              onPress={handleRetirar}
            />
          )}
        </View>
      ) : turnoIniciado ? (
        <View className="bg-muted rounded-2xl px-5 py-4 flex-row items-center gap-3">
          <Ionicons name="time-outline" size={20} color={COLORS.placeholder} />
          <Text className="text-sm text-muted-foreground">El turno ya empezó — ya no se puede postular</Text>
        </View>
      ) : selectedPuesto ? (
        <Button
          label={aplicarM.isPending ? 'Enviando postulación…' : `Aplicar como ${selectedPuesto.cargo_nombre}`}
          variant="primary"
          fullWidth
          loading={aplicarM.isPending}
          onPress={handleAplicar}
        />
      ) : (
        <View className="bg-muted rounded-2xl px-5 py-4 items-center">
          <Text className="text-sm text-muted-foreground">No hay plazas disponibles</Text>
        </View>
      )}
    </View>
  );
}
