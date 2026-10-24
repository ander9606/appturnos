import { showAlert } from '@/lib/alertDialog';
import { Text, TextInput } from '@/components/ui/Text';
import { COLORS } from '@/lib/designTokens';
import React, { useState } from 'react';
import { View, ScrollView, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMarcarOfertaFallida } from '@/features/turnos/useTurnos';
import { parseTarifa } from '@/features/turnos/crear/utils';
import { Button } from '@/components/ui/Button';
import type { OfertaDetalle } from '@api-client';
import { ApiError } from '@api-client';

// ── Turno fallido (gestores) — fuerza mayor: quien ya marcó ingreso recibe
// una compensación en vez de perder el turno sin nada. ─────────────────────

export function TurnoFallidoModal({
  visible,
  oferta,
  marcarFallidaM,
  onClose,
  onDone,
}: {
  visible: boolean;
  oferta: OfertaDetalle;
  marcarFallidaM: ReturnType<typeof useMarcarOfertaFallida>;
  onClose: () => void;
  onDone: () => void;
}) {
  const enProgreso = oferta.asignaciones.filter((a) => a.estado === 'en_progreso');
  const otros = oferta.asignaciones.filter((a) =>
    a.estado !== 'en_progreso' && a.estado !== 'completado' && a.estado !== 'cancelado'
  );

  const [motivo, setMotivo] = useState('Fuerza mayor');
  const [montos, setMontos] = useState<Record<number, string>>({});

  React.useEffect(() => {
    if (!visible) return;
    setMotivo('Fuerza mayor');
    setMontos(Object.fromEntries(enProgreso.map((a) => {
      const tarifa = oferta.puestos.find((p) => p.id === a.puesto_id)?.tarifa_dia ?? 0;
      return [a.id, String(tarifa)];
    })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, oferta.id]);

  if (!visible) return null;

  async function handleConfirmar() {
    if (!motivo.trim()) {
      showAlert('Falta el motivo', 'Escribe por qué este turno es fuerza mayor.', 'warning');
      return;
    }
    const compensaciones = enProgreso.map((a) => ({
      asignacion_id: a.id,
      monto: parseTarifa(montos[a.id] ?? '0'),
    }));
    try {
      await marcarFallidaM.mutateAsync({ ofertaId: oferta.id, motivo: motivo.trim(), compensaciones });
      onDone();
    } catch (err) {
      showAlert('Error', err instanceof ApiError ? err.message : 'No se pudo marcar el turno como fallido.');
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          className="bg-background rounded-t-3xl"
          contentContainerClassName="px-6 pt-5 pb-10 gap-5"
          style={{ maxHeight: '85%' }}
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold text-foreground">Turno fallido</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={COLORS.mutedForeground} />
            </Pressable>
          </View>

          <Text className="text-sm text-muted-foreground">
            El turno se cancelará por fuerza mayor. Quienes ya marcaron ingreso recibirán la compensación
            que definas abajo; el resto queda cancelado sin pago, como siempre.
          </Text>

          <View className="gap-1.5">
            <Text className="text-sm font-semibold text-foreground">Motivo</Text>
            <TextInput
              value={motivo}
              onChangeText={setMotivo}
              placeholder="Ej. fuerza mayor"
              placeholderTextColor={COLORS.placeholder}
              maxLength={255}
              className="bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground"
            />
          </View>

          <View className="gap-3">
            <Text className="text-sm font-semibold text-foreground">
              Compensación ({enProgreso.length} ya en turno)
            </Text>
            {enProgreso.map((a) => (
              <View key={a.id} className="gap-1.5">
                <Text className="text-xs text-muted-foreground">
                  {a.trabajador_nombre} {a.trabajador_apellido} · {a.cargo_nombre}
                </Text>
                <View className="flex-row items-center bg-card border border-border rounded-xl px-3 gap-1">
                  <Text className="text-sm font-bold text-muted-foreground">$</Text>
                  <TextInput
                    className="flex-1 py-3 text-sm font-semibold text-foreground"
                    value={montos[a.id] ?? ''}
                    onChangeText={(t) => setMontos((m) => ({ ...m, [a.id]: t.replace(/[^\d.,]/g, '') }))}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            ))}
          </View>

          {otros.length > 0 && (
            <Text className="text-xs text-muted-foreground">
              {otros.length} trabajador{otros.length > 1 ? 'es' : ''} más que aún no había
              {otros.length > 1 ? 'n' : ''} empezado quedará{otros.length > 1 ? 'n' : ''} cancelado
              {otros.length > 1 ? 's' : ''} sin compensación.
            </Text>
          )}

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Button label="Volver" variant="secondary" fullWidth disabled={marcarFallidaM.isPending} onPress={onClose} />
            </View>
            <View className="flex-1">
              <Button
                label={marcarFallidaM.isPending ? 'Confirmando…' : 'Confirmar turno fallido'}
                variant="danger"
                fullWidth
                loading={marcarFallidaM.isPending}
                onPress={handleConfirmar}
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
