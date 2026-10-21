import { showAlert } from '@/lib/alertDialog';
import { Text, TextInput } from '@/components/ui/Text';
import { COLORS } from '@/lib/designTokens';
import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { useCorregirRegistro } from '@/features/nomina/useNomina';
import { fmtFechaCorta } from '@/features/nomina/trabajador/nominaTrabajadorUtils';
import type { RegistroDiario, TipoDia } from '@api-client';
import { TIPOS_DIA_SIN_HORARIO } from './tiposDia';
import { SHORT_DAYS, fmtTime, horaAFecha } from './fechasRegistro';
import { EditarSesionesModal } from './EditarSesionesModal';
import { TipoDiaChips } from './TipoDiaChips';

export function EditarRegistroModal({
  registro,
  onClose,
}: {
  registro: RegistroDiario | null;
  onClose: () => void;
}) {
  const corregir = useCorregirRegistro();
  const [tipoDia, setTipoDia] = useState<TipoDia>(registro?.tipo_dia ?? 'ordinario');
  const [novedad, setNovedad] = useState(registro?.novedad ?? '');
  const [horaEntrada, setHoraEntrada] = useState<Date | null>(null);
  const [horaSalida, setHoraSalida] = useState<Date | null>(null);
  const [showEntrada, setShowEntrada] = useState(false);
  const [showSalida, setShowSalida] = useState(false);

  const esAusencia = tipoDia === 'ausencia';
  const sinHorario = esAusencia || TIPOS_DIA_SIN_HORARIO.includes(tipoDia);

  React.useEffect(() => {
    if (registro) {
      setTipoDia(registro.tipo_dia);
      setNovedad(registro.novedad ?? '');
      setHoraEntrada(horaAFecha(registro.hora_entrada));
      setHoraSalida(horaAFecha(registro.hora_salida));
      setShowEntrada(false);
      setShowSalida(false);
    }
  }, [registro]);

  if (!registro) return null;
  // Un día con reingreso se corrige por sesiones (el backend exige la lista completa).
  if (registro.sesiones > 1) return <EditarSesionesModal key={registro.id} registro={registro} onClose={onClose} />;

  function onChangeEntrada(_: DateTimePickerEvent, d?: Date) {
    if (Platform.OS === 'android') setShowEntrada(false);
    if (d) setHoraEntrada(d);
  }
  function onChangeSalida(_: DateTimePickerEvent, d?: Date) {
    if (Platform.OS === 'android') setShowSalida(false);
    if (d) setHoraSalida(d);
  }

  const handleGuardar = async () => {
    if (!sinHorario && horaEntrada && horaSalida && fmtTime(horaSalida) === fmtTime(horaEntrada)) {
      showAlert('La hora de salida no puede ser igual a la de entrada.');
      return;
    }
    try {
      await corregir.mutateAsync({
        id: registro.id,
        tipo_dia: tipoDia,
        novedad: novedad.trim() || undefined,
        // null (no undefined) para que se limpie un horario que haya quedado
        // guardado de antes de reclasificar el día a compensatorio/ausencia.
        hora_entrada: sinHorario ? null : horaEntrada ? fmtTime(horaEntrada) : undefined,
        hora_salida: sinHorario ? null : horaSalida ? fmtTime(horaSalida) : undefined,
      });
      onClose();
    } catch {
      showAlert('Error', 'No se pudo guardar el registro.');
    }
  };

  const d = new Date(`${registro.fecha}T00:00:00`);

  return (
    <Modal visible={!!registro} transparent animationType="slide" onRequestClose={onClose}>
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
              <Text className="text-lg font-bold text-foreground">Editar registro</Text>
              <Text className="text-sm text-muted-foreground">
                {SHORT_DAYS[d.getDay()]} {fmtFechaCorta(registro.fecha)} · {registro.trabajador_nombre} {registro.trabajador_apellido}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={COLORS.mutedForeground} />
            </Pressable>
          </View>

          <View className="bg-card rounded-2xl border border-border px-5 py-4 gap-3">
            <Text className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Tipo de día</Text>
            <TipoDiaChips value={tipoDia} onChange={setTipoDia} />
          </View>

          {sinHorario ? (
            <View className={`rounded-xl px-4 py-3 flex-row items-center gap-2 ${esAusencia ? 'bg-danger-light' : 'bg-info-light'}`}>
              <Ionicons name="information-circle-outline" size={16} color={esAusencia ? COLORS.danger : COLORS.info} />
              <Text className={`text-xs flex-1 leading-relaxed ${esAusencia ? 'text-danger' : 'text-info'}`}>
                {esAusencia
                  ? 'Se registrará como falta, sin horas trabajadas ni pago para este día.'
                  : 'Este tipo de día no requiere horario de entrada ni salida.'}
              </Text>
            </View>
          ) : (
            <View className="bg-card rounded-2xl border border-border px-5 py-4 gap-3">
              <Text className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Tiempos registrados</Text>
              <View className="flex-row items-center gap-3">
                <TouchableOpacity
                  onPress={() => setShowEntrada(true)}
                  className="flex-1 bg-muted rounded-xl px-4 py-3"
                >
                  <Text className="text-xs text-muted-foreground mb-1">Entrada</Text>
                  <Text className={`text-2xl font-bold ${!horaEntrada ? 'text-muted-foreground' : 'text-foreground'}`}>
                    {fmtTime(horaEntrada)}
                  </Text>
                </TouchableOpacity>
                <Ionicons name="arrow-forward" size={16} color={COLORS.placeholder} />
                <TouchableOpacity
                  onPress={() => setShowSalida(true)}
                  className="flex-1 bg-muted rounded-xl px-4 py-3"
                >
                  <Text className="text-xs text-muted-foreground mb-1">Salida</Text>
                  <Text className={`text-2xl font-bold ${!horaSalida ? 'text-muted-foreground' : 'text-foreground'}`}>
                    {fmtTime(horaSalida)}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ponytail: pickers fuera de las columnas flex-1 — el spinner de iOS ignora el ancho del padre y se salía de pantalla */}
              {showEntrada && (
                <View className="gap-1.5">
                  <DateTimePicker
                    value={horaEntrada ?? new Date()}
                    mode="time"
                    display="spinner"
                    onChange={onChangeEntrada}
                    style={{ width: '100%' }}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity onPress={() => setShowEntrada(false)} className="bg-primary/10 rounded-xl py-1.5 items-center">
                      <Text className="text-xs font-semibold text-primary">Listo</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {showSalida && (
                <View className="gap-1.5">
                  <DateTimePicker
                    value={horaSalida ?? new Date()}
                    mode="time"
                    display="spinner"
                    onChange={onChangeSalida}
                    style={{ width: '100%' }}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity onPress={() => setShowSalida(false)} className="bg-primary/10 rounded-xl py-1.5 items-center">
                      <Text className="text-xs font-semibold text-primary">Listo</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}

          <View className="bg-card rounded-2xl border border-border px-5 py-4 gap-2">
            <Text className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Novedad (opcional)</Text>
            <TextInput
              value={novedad}
              onChangeText={setNovedad}
              placeholder="Ej: Incapacidad médica radicada, compensatorio aprobado…"
              placeholderTextColor={COLORS.placeholder}
              multiline
              numberOfLines={3}
              className="text-sm text-foreground"
              style={{ textAlignVertical: 'top', minHeight: 60 }}
            />
          </View>

          <View className="flex-row gap-2">
            <Button label="Cancelar" variant="secondary" style={{ flex: 1 }} onPress={onClose} />
            <Button
              label="Guardar cambios"
              variant="success"
              style={{ flex: 1 }}
              loading={corregir.isPending}
              onPress={handleGuardar}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
