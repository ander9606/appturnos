/**
 * DescuentosPendientesModal — ventana emergente donde el trabajador_nomina
 * acepta o rechaza los descuentos que le registró su empresa.
 *
 * Se cierra sola cuando ya no quedan pendientes (visible && lista no vacía).
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, Modal, Pressable, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/Button';
import { formatCOP } from '@/lib/formatters';
import { useAceptarDescuento, useRechazarDescuento } from '../../descuentos/useDescuentos';
import { TIPO_DESCUENTO_LABELS } from './ResumenCards';
import type { DescuentoNomina } from '@api-client';

interface Props {
  visible:    boolean;
  /** Solo los pendientes. */
  descuentos: DescuentoNomina[];
  onClose:    () => void;
}

export function DescuentosPendientesModal({ visible, descuentos, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const aceptar = useAceptarDescuento();
  const rechazar = useRechazarDescuento();
  const [respondiendoId, setRespondiendoId] = useState<number | null>(null);

  if (!visible || descuentos.length === 0) return null;

  const handleResponder = async (id: number, acepta: boolean) => {
    if (!acepta) {
      const ok = await new Promise<boolean>((resolve) =>
        Alert.alert('Rechazar descuento', 'Tu empleador verá que lo rechazaste. ¿Confirmas?', [
          { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Rechazar', style: 'destructive', onPress: () => resolve(true) },
        ])
      );
      if (!ok) return;
    }
    setRespondiendoId(id);
    try {
      await (acepta ? aceptar : rechazar).mutateAsync(id);
    } catch {
      Alert.alert('Error', 'No se pudo registrar tu respuesta. Intenta de nuevo.');
    } finally {
      setRespondiendoId(null);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-end">
        <View
          className="w-full bg-background rounded-t-3xl px-6 pt-5"
          style={{ maxHeight: '85%', paddingBottom: insets.bottom + 20 }}
        >
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-1 pr-3">
              <Text className="text-lg font-bold text-foreground">
                {descuentos.length} descuento{descuentos.length > 1 ? 's' : ''} por aceptar
              </Text>
              <Text className="text-sm text-muted-foreground">
                Solo lo que aceptes se resta de tu pago.
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Cerrar">
              <Ionicons name="close" size={22} color="#64748B" />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="gap-3">
              {descuentos.map((d) => (
                <View key={d.id} className="bg-card border border-border rounded-2xl p-4 gap-3">
                  <View className="flex-row items-start justify-between gap-2">
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-foreground">{TIPO_DESCUENTO_LABELS[d.tipo]}</Text>
                      <Text className="text-xs text-muted-foreground mt-0.5">{d.motivo}</Text>
                    </View>
                    <Text className="text-base font-bold text-danger">-{formatCOP(d.monto)}</Text>
                  </View>
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => handleResponder(d.id, false)}
                      disabled={respondiendoId === d.id}
                      className="flex-1 h-10 rounded-xl border border-border items-center justify-center"
                    >
                      <Text className="text-sm font-semibold text-muted-foreground">Rechazar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleResponder(d.id, true)}
                      disabled={respondiendoId === d.id}
                      className="flex-1 h-10 rounded-xl bg-primary-500 items-center justify-center active:opacity-80"
                    >
                      {respondiendoId === d.id
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text className="text-sm font-semibold text-white">Aceptar</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          <View className="mt-5">
            <Button label="Responder después" variant="secondary" fullWidth onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
