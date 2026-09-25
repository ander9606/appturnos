import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, Modal, Pressable, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAgregarBono } from '../useTurnos';
import { Button } from '@/components/ui/Button';
import { ApiError, type Asignacion } from '@api-client';
import { showToast } from '@/lib/toast';

export function BonoModal({
  visible,
  asignacion,
  onClose,
}: {
  visible: boolean;
  asignacion: Asignacion | null | undefined;
  onClose: () => void;
}) {
  const agregarBono = useAgregarBono();
  const insets = useSafeAreaInsets();
  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    if (asignacion && visible) {
      setMonto(asignacion.bono_monto ? String(asignacion.bono_monto) : '');
      setMotivo(asignacion.bono_motivo ?? '');
    }
  }, [asignacion?.id, visible]); // eslint-disable-next-line react-hooks/exhaustive-deps

  if (!visible || !asignacion) return null;

  async function handleGuardar() {
    const montoNum = Number(monto.replace(/[^0-9.]/g, '')) || 0;
    if (montoNum > 0 && !motivo.trim()) {
      Alert.alert('Falta el motivo', 'Escribe por qué se le da este bono al trabajador.');
      return;
    }
    try {
      await agregarBono.mutateAsync({ asignacionId: asignacion!.id, monto: montoNum, motivo: motivo.trim() || undefined });
      showToast(montoNum > 0 ? 'Bono guardado.' : 'Bono quitado.');
      onClose();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'No se pudo guardar el bono.';
      Alert.alert('Error', msg);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-end">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {/* maxHeight tope a la pantalla — sin esto, con teclado abierto y el
              aviso de refirma, el encabezado podía quedar empujado fuera del
              área visible tanto en iOS como en Android. El ScrollView interno
              deja el encabezado y los botones siempre fijos y visibles. */}
          <View
            className="w-full bg-background rounded-t-3xl px-6 pt-5"
            style={{ maxHeight: '85%', paddingBottom: insets.bottom + 20 }}
          >
            <View className="flex-row items-center justify-between mb-5">
              <View>
                <Text className="text-lg font-bold text-foreground">Bono extra</Text>
                <Text className="text-sm text-muted-foreground">
                  {asignacion.trabajador_nombre} {asignacion.trabajador_apellido}
                </Text>
              </View>
              <Pressable onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={22} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-4">
                <View className="gap-1.5">
                  <Text className="text-sm font-semibold text-foreground">Monto (COP)</Text>
                  <TextInput
                    value={monto}
                    onChangeText={setMonto}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#94A3B8"
                    className="bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground"
                  />
                </View>
                <View className="gap-1.5">
                  <Text className="text-sm font-semibold text-foreground">Motivo</Text>
                  <TextInput
                    value={motivo}
                    onChangeText={setMotivo}
                    placeholder="Ej. propina del cliente"
                    placeholderTextColor="#94A3B8"
                    maxLength={255}
                    className="bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground"
                  />
                </View>
                <Text className="text-xs text-muted-foreground">
                  Se suma al pago del turno y queda registrado en el contrato. Deja el monto en 0 para quitarlo.
                </Text>
                {asignacion.contrato_firmado === 1 && (
                  <View className="flex-row items-start gap-2 bg-warning/10 border border-warning/30 rounded-xl px-3 py-2.5">
                    <Ionicons name="alert-circle-outline" size={15} color="#F59E0B" style={{ marginTop: 1 }} />
                    <Text className="flex-1 text-xs text-warning">
                      El contrato de este turno ya fue firmado. Si cambias el bono, el trabajador deberá volver a firmarlo.
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>

            <View className="flex-row gap-3 mt-6">
              {/* fullWidth resuelve w-full al 100% del contenedor flex-row, no
                  de la mitad — sin envolver cada botón en flex-1, el segundo
                  quedaba empujado fuera de la pantalla. */}
              <View className="flex-1">
                <Button
                  label="Cancelar"
                  variant="secondary"
                  fullWidth
                  disabled={agregarBono.isPending}
                  onPress={onClose}
                />
              </View>
              <View className="flex-1">
                <Button
                  label={agregarBono.isPending ? 'Guardando…' : 'Guardar'}
                  variant="primary"
                  fullWidth
                  loading={agregarBono.isPending}
                  disabled={agregarBono.isPending}
                  onPress={handleGuardar}
                />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
