import { showAlert } from '@/lib/alertDialog';
import { Text } from '@/components/ui/Text';
import { Spinner } from '@/components/ui/Spinner';
import { COLORS } from '@/lib/designTokens';
import React, { useState } from 'react';
import { View, TouchableOpacity, Modal, Pressable, KeyboardAvoidingView, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useReasignarCompensatorio } from '@/features/nomina/compensatorios/useCompensatorios';
import { RangoFechasCompensatorio } from '@/features/nomina/compensatorios/RangoFechasCompensatorio';
import { fmtFechaCorta } from '@/features/nomina/trabajador/nominaTrabajadorUtils';
import type { DescansoCompensatorio } from '@api-client';

// ── Modal: reasignar descanso compensatorio ──────────────────────────────

export function ReasignarCompensatorioModal({
  compensatorio,
  onClose,
}: {
  compensatorio: DescansoCompensatorio | null;
  onClose: () => void;
}) {
  const reasignar = useReasignarCompensatorio();
  const [fecha, setFecha] = useState<string | null>(null);

  React.useEffect(() => {
    if (compensatorio) setFecha(null);
  }, [compensatorio?.id]);

  if (!compensatorio) return null;

  function confirmar() {
    if (!fecha || !compensatorio) return;
    if (fecha === compensatorio.fecha_asignada) {
      showAlert('Esa ya es la fecha asignada actual.');
      return;
    }
    reasignar.mutate({ id: compensatorio.id, fecha }, { onSuccess: onClose });
  }

  return (
    <Modal visible={!!compensatorio} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior="height"
        className="flex-1 justify-end bg-black/40"
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          className="bg-background rounded-t-3xl"
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40, gap: 20 }}
        >
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-lg font-bold text-foreground">Reasignar descanso</Text>
              <Text className="text-sm text-muted-foreground">
                {compensatorio.trabajador_nombre} {compensatorio.trabajador_apellido} · por trabajo el {fmtFechaCorta(compensatorio.origen_fecha)}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={COLORS.mutedForeground} />
            </Pressable>
          </View>

          <View className="gap-1.5">
            <Text className="text-sm font-semibold text-foreground">Nueva fecha</Text>
            <RangoFechasCompensatorio compensatorioId={compensatorio.id} seleccionada={fecha ?? ''} onSeleccionar={setFecha} />
          </View>

          <TouchableOpacity
            onPress={confirmar}
            disabled={reasignar.isPending || !fecha}
            className="h-14 bg-foreground rounded-2xl items-center justify-center active:opacity-80 disabled:opacity-40"
          >
            {reasignar.isPending
              ? <Spinner color={COLORS.white} />
              : <Text className="text-base font-semibold text-white">
                  {fecha ? `Mover a ${fmtFechaCorta(fecha)}` : 'Elige una fecha'}
                </Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
