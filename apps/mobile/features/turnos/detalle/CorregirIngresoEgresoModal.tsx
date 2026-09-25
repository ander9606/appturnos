import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, Modal, Pressable, TouchableOpacity, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useCorregirAsignacion } from '../useTurnos';
import { Button } from '@/components/ui/Button';
import { formatDateObj, formatTimeObj, toISODateTime } from '@/lib/formatters';
import { ApiError, type Asignacion } from '@api-client';
import { showToast } from '@/lib/toast';

function fmtDateTime(d: Date): string {
  return `${formatDateObj(d)} ${formatTimeObj(d)}`;
}

export function CorregirIngresoEgresoModal({
  visible,
  asignacion,
  onClose,
}: {
  visible: boolean;
  asignacion: Asignacion | null | undefined;
  onClose: () => void;
}) {
  const corregir = useCorregirAsignacion();
  const insets = useSafeAreaInsets();
  const [ingreso, setIngreso] = useState<Date | null>(null);
  const [egreso, setEgreso] = useState<Date | null>(null);
  const [showIngreso, setShowIngreso] = useState(false);
  const [showEgreso, setShowEgreso] = useState(false);

  useEffect(() => {
    if (asignacion) {
      // Inicializa con la fecha del turno + la hora actual (o la hora guardada si existe)
      const fechaBase = new Date(`${asignacion.oferta_fecha}T00:00:00`);

      if (asignacion.hora_ingreso_real) {
        const ingresoParsed = new Date(asignacion.hora_ingreso_real.replace(' ', 'T'));
        const ingresoCompleto = new Date(fechaBase);
        ingresoCompleto.setHours(ingresoParsed.getHours(), ingresoParsed.getMinutes(), 0, 0);
        setIngreso(ingresoCompleto);
      } else {
        setIngreso(null);
      }

      if (asignacion.hora_egreso_real) {
        const egresoParsed = new Date(asignacion.hora_egreso_real.replace(' ', 'T'));
        const agresoCompleto = new Date(fechaBase);
        agresoCompleto.setHours(egresoParsed.getHours(), egresoParsed.getMinutes(), 0, 0);
        setEgreso(agresoCompleto);
      } else {
        setEgreso(null);
      }

      setShowIngreso(false);
      setShowEgreso(false);
    }
  }, [asignacion?.id, visible]); // eslint-disable-next-line react-hooks/exhaustive-deps

  if (!visible || !asignacion) return null;

  function onChangeIngreso(_: DateTimePickerEvent, d?: Date) {
    if (d && asignacion) {
      // Asegura que siempre usa la fecha del turno, solo cambia la hora
      const fechaBase = new Date(`${asignacion.oferta_fecha}T00:00:00`);
      fechaBase.setHours(d.getHours(), d.getMinutes(), 0, 0);
      setIngreso(fechaBase);
    }
  }

  function onChangeEgreso(_: DateTimePickerEvent, d?: Date) {
    if (d && asignacion) {
      // Asegura que siempre usa la fecha del turno, solo cambia la hora
      const fechaBase = new Date(`${asignacion.oferta_fecha}T00:00:00`);
      fechaBase.setHours(d.getHours(), d.getMinutes(), 0, 0);
      setEgreso(fechaBase);
    }
  }

  // En Android, abre solo un selector de hora (la fecha viene del turno).
  function abrirHoraAndroid(valorActual: Date | null, onResultado: (d: Date) => void) {
    DateTimePickerAndroid.open({
      value: valorActual ?? new Date(),
      mode: 'time',
      onChange: (_, hora) => {
        if (!hora) return;
        // Combina la fecha del turno con la hora seleccionada
        const fecha = new Date(`${asignacion!.oferta_fecha}T00:00:00`);
        fecha.setHours(hora.getHours(), hora.getMinutes(), 0, 0);
        onResultado(fecha);
      },
    });
  }

  function abrirIngreso() {
    if (Platform.OS === 'android') {
      abrirHoraAndroid(ingreso, setIngreso);
    } else {
      setShowIngreso(true);
    }
  }

  function abrirEgreso() {
    if (Platform.OS === 'android') {
      abrirHoraAndroid(egreso, setEgreso);
    } else {
      setShowEgreso(true);
    }
  }
  async function handleGuardar() {
    if (!asignacion) return;
    if (ingreso && egreso && egreso <= ingreso) {
      Alert.alert('Error', 'La hora de egreso debe ser posterior al ingreso.');
      return;
    }
    try {
      await corregir.mutateAsync({
        asignacionId: asignacion.id,
        ofertaId: asignacion.oferta_id,
        hora_ingreso_real: ingreso ? toISODateTime(ingreso) : undefined,
        hora_egreso_real: egreso ? toISODateTime(egreso) : undefined,
      });
      showToast('Ingreso/egreso corregido correctamente.');
      onClose();
    } catch (err) {
      let msg = 'No se pudo corregir.';
      if (err instanceof ApiError) {
        msg = err.message;
      } else if (err instanceof Error) {
        msg = err.message;
      } else if (typeof err === 'object' && err !== null && 'message' in err) {
        msg = String(err.message);
      }
      Alert.alert('Error', msg);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-end">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          {/* maxHeight tope a la pantalla, igual que BonoModal — sin esto el
              encabezado podía quedar empujado fuera del área visible en
              pantallas chicas o con los pickers de hora abiertos. */}
          <View
            className="w-full bg-background rounded-t-3xl px-6 pt-5"
            style={{ maxHeight: '85%', paddingBottom: insets.bottom + 20 }}
          >
            <View className="flex-row items-center justify-between mb-5">
              <View>
                <Text className="text-lg font-bold text-foreground">Corregir ingreso/egreso</Text>
                <Text className="text-sm text-muted-foreground">
                  {asignacion.trabajador_nombre} {asignacion.trabajador_apellido}
                </Text>
              </View>
              <Pressable onPress={onClose} hitSlop={10}>
                <Ionicons name="close" size={22} color="#64748B" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="max-h-96">
              <View className="gap-4">
                <View className="gap-1.5">
                  <Text className="text-sm font-semibold text-foreground">Ingreso</Text>
                  <TouchableOpacity
                    onPress={abrirIngreso}
                    className="bg-card border border-border rounded-xl px-4 py-3 flex-row items-center gap-2"
                  >
                    <Ionicons name="log-in-outline" size={16} color="#64748B" />
                    <Text className="text-sm text-foreground">{ingreso ? fmtDateTime(ingreso) : 'Sin definir'}</Text>
                  </TouchableOpacity>
                  {showIngreso && Platform.OS === 'ios' && (
                    <DateTimePicker
                      value={ingreso ?? new Date()}
                      mode="time"
                      display="spinner"
                      onChange={onChangeIngreso}
                    />
                  )}
                  {showIngreso && Platform.OS === 'ios' && (
                    <TouchableOpacity onPress={() => setShowIngreso(false)} className="bg-primary/10 rounded-xl py-2 items-center">
                      <Text className="text-sm font-semibold text-primary">Listo</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View className="gap-1.5">
                  <Text className="text-sm font-semibold text-foreground">Egreso</Text>
                  <TouchableOpacity
                    onPress={abrirEgreso}
                    className="bg-card border border-border rounded-xl px-4 py-3 flex-row items-center gap-2"
                  >
                    <Ionicons name="log-out-outline" size={16} color="#64748B" />
                    <Text className="text-sm text-foreground">{egreso ? fmtDateTime(egreso) : 'Sin definir'}</Text>
                  </TouchableOpacity>
                  {showEgreso && Platform.OS === 'ios' && (
                    <DateTimePicker
                      value={egreso ?? new Date()}
                      mode="time"
                      display="spinner"
                      onChange={onChangeEgreso}
                    />
                  )}
                  {showEgreso && Platform.OS === 'ios' && (
                    <TouchableOpacity onPress={() => setShowEgreso(false)} className="bg-primary/10 rounded-xl py-2 items-center">
                      <Text className="text-sm font-semibold text-primary">Listo</Text>
                    </TouchableOpacity>
                  )}
                </View>
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
                  disabled={corregir.isPending}
                  onPress={onClose}
                />
              </View>
              <View className="flex-1">
                <Button
                  label={corregir.isPending ? 'Guardando…' : 'Guardar'}
                  variant="primary"
                  fullWidth
                  loading={corregir.isPending}
                  disabled={corregir.isPending}
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
