import { showAlert } from '@/lib/alertDialog';
import { Text, TextInput } from '@/components/ui/Text';
import { COLORS } from '@/lib/designTokens';
import React, { useState } from 'react';
import {
  View, ScrollView, Modal, Pressable, KeyboardAvoidingView, Platform, } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useDescuentosAsignacion, useCrearDescuento, useEliminarDescuento } from '../useTurnos';
import { Button } from '@/components/ui/Button';
import { ApiError, type Asignacion, type DescuentoTurno } from '@api-client';
import { showToast } from '@/lib/toast';
import { formatCOP } from '@/lib/formatters';

const ESTADO_LABEL: Record<DescuentoTurno['estado'], string> = {
  pendiente: 'Pendiente de aceptación',
  aceptado: 'Aceptado',
  rechazado: 'Rechazado',
};

export function DescuentoModal({
  visible,
  asignacion,
  onClose,
}: {
  visible: boolean;
  asignacion: Asignacion | null | undefined;
  onClose: () => void;
}) {
  const asignacionId = asignacion?.id ?? 0;
  const { data } = useDescuentosAsignacion(asignacionId, { enabled: visible });
  const crear = useCrearDescuento();
  const eliminar = useEliminarDescuento();
  const insets = useSafeAreaInsets();
  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');

  if (!visible || !asignacion) return null;

  const descuentos = data?.descuentos ?? [];
  const disponible = Math.max(0, (data?.tope_cop ?? 0) - (data?.comprometido_cop ?? 0));

  async function handleGuardar() {
    const montoNum = Number(monto.replace(/[^0-9.]/g, '')) || 0;
    if (montoNum <= 0) {
      showAlert('Falta el monto', 'Escribe cuánto se le descuenta al trabajador.', 'warning');
      return;
    }
    if (montoNum > disponible) {
      showAlert(
        'Supera el tope legal',
        `El art. 113 del CST solo permite descontar hasta la quinta parte de la tarifa del día. Disponible: ${formatCOP(disponible)}.`
      );
      return;
    }
    if (!motivo.trim()) {
      showAlert('Falta el motivo', 'Escribe por qué se le hace este descuento al trabajador.', 'warning');
      return;
    }
    try {
      await crear.mutateAsync({ asignacionId, monto: montoNum, motivo: motivo.trim() });
      showToast('Descuento registrado. El trabajador debe aceptarlo.');
      setMonto('');
      setMotivo('');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'No se pudo registrar el descuento.';
      showAlert('Error', msg);
    }
  }

  async function handleEliminar(id: number) {
    try {
      await eliminar.mutateAsync({ id, asignacionId });
      showToast('Descuento eliminado.');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'No se pudo eliminar el descuento.';
      showAlert('Error', msg);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-end">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View
            className="w-full bg-background rounded-t-3xl px-6 pt-5"
            style={{ maxHeight: '85%', paddingBottom: insets.bottom + 20 }}
          >
            <View className="flex-row items-center justify-between mb-5">
              <View>
                <Text className="text-lg font-bold text-foreground">Descuento</Text>
                <Text className="text-sm text-muted-foreground">
                  {asignacion.trabajador_nombre} {asignacion.trabajador_apellido}
                </Text>
              </View>
              <Pressable onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={22} color={COLORS.mutedForeground} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="gap-4">
                {data && (
                  <Text className="text-xs text-muted-foreground bg-card rounded-xl px-3 py-2.5 border border-border">
                    Tope legal de este turno (art. 113 CST, quinta parte de la tarifa del día {formatCOP(data.tarifa_dia)}):{' '}
                    <Text className="font-semibold text-foreground">{formatCOP(data.tope_cop)}</Text>.
                    {' '}Disponible: <Text className="font-semibold text-foreground">{formatCOP(disponible)}</Text>.
                  </Text>
                )}

                {descuentos.length > 0 && (
                  <View className="gap-2">
                    {descuentos.map((d) => (
                      <View
                        key={d.id}
                        className="flex-row items-center justify-between gap-2 border border-border rounded-xl px-3 py-2.5"
                      >
                        <View className="flex-1">
                          <Text className="text-sm font-semibold text-foreground">
                            {formatCOP(d.monto)} · {d.motivo}
                          </Text>
                          <Text className="text-xs text-muted-foreground">{ESTADO_LABEL[d.estado]}</Text>
                        </View>
                        <Pressable onPress={() => handleEliminar(d.id)} disabled={eliminar.isPending} hitSlop={10}>
                          <Ionicons name="trash-outline" size={16} color={COLORS.placeholder} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}

                <View className="gap-1.5">
                  <Text className="text-sm font-semibold text-foreground">Monto (COP)</Text>
                  <TextInput
                    value={monto}
                    onChangeText={setMonto}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={COLORS.placeholder}
                    className="bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground"
                  />
                </View>
                <View className="gap-1.5">
                  <Text className="text-sm font-semibold text-foreground">Motivo</Text>
                  <TextInput
                    value={motivo}
                    onChangeText={setMotivo}
                    placeholder="Ej. llegada tarde sin aviso"
                    placeholderTextColor={COLORS.placeholder}
                    maxLength={255}
                    className="bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground"
                  />
                </View>
                <Text className="text-xs text-muted-foreground">
                  El trabajador recibe una notificación y debe aceptarlo. Solo lo aceptado resta del pago y queda en su contrato y cuenta de cobro.
                </Text>
              </View>
            </ScrollView>

            <View className="flex-row gap-3 mt-6">
              <View className="flex-1">
                <Button label="Cerrar" variant="secondary" fullWidth disabled={crear.isPending} onPress={onClose} />
              </View>
              <View className="flex-1">
                <Button
                  label={crear.isPending ? 'Guardando…' : 'Registrar'}
                  variant="primary"
                  fullWidth
                  loading={crear.isPending}
                  disabled={crear.isPending}
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

