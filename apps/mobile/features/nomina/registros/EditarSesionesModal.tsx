import { showAlert } from '@/lib/alertDialog';
import { Text } from '@/components/ui/Text';
import { COLORS } from '@/lib/designTokens';
import { useState } from 'react';
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
import { fmtFechaCorta, sesionesDelRegistro } from '@/features/nomina/trabajador/nominaTrabajadorUtils';
import { ApiError } from '@api-client';
import type { RegistroDiario } from '@api-client';
import { SHORT_DAYS, fmtTime, horaAFecha } from './fechasRegistro';

// ── Modal: corregir las sesiones de un día con reingreso ─────────────────

type SesionEdit = { entrada: Date | null; salida: Date | null };

type PickerAbierto = { i: number; campo: 'entrada' | 'salida' } | null;

/**
 * Un día con reingreso guarda varias sesiones y sus horas son la suma de todas, así que no se
 * edita "un par de horas": se corrigen las sesiones y el backend recalcula el día completo
 * (mismo reparto del tope semanal que al marcar). No se agregan ni se quitan sesiones.
 */
export function EditarSesionesModal({ registro, onClose }: { registro: RegistroDiario; onClose: () => void }) {
  const corregir = useCorregirRegistro();
  const [sesiones, setSesiones] = useState<SesionEdit[]>(() =>
    sesionesDelRegistro(registro).map((s) => ({ entrada: horaAFecha(s.hora_entrada), salida: horaAFecha(s.hora_salida) })),
  );
  const [picker, setPicker] = useState<PickerAbierto>(null);
  // Si el reingreso quedó sin salida (el trabajador no marcó), el gestor puede ponérsela o dejarlo en curso.
  const ultimaAbierta = !registro.hora_salida;
  const d = new Date(`${registro.fecha}T00:00:00`);

  function onChangeHora(_: DateTimePickerEvent, hora?: Date) {
    const actual = picker;
    if (Platform.OS === 'android') setPicker(null);
    if (!hora || !actual) return;
    setSesiones((prev) => prev.map((s, i) => (i === actual.i ? { ...s, [actual.campo]: hora } : s)));
  }

  async function handleGuardar() {
    const incompleta = sesiones.some((s, i) => !s.entrada || (!(ultimaAbierta && i === sesiones.length - 1) && !s.salida));
    if (incompleta) {
      showAlert('Completa todas las horas');
      return;
    }
    try {
      await corregir.mutateAsync({
        id: registro.id,
        sesiones: sesiones.map((s, i) => ({
          hora_entrada: fmtTime(s.entrada),
          // La última, si seguía abierta y no se le puso salida, sigue en curso.
          hora_salida: s.salida ? fmtTime(s.salida) : null,
        })),
      });
      onClose();
    } catch (e) {
      // El backend explica qué falló (sesiones solapadas, período cerrado, etc.).
      showAlert('No se pudo guardar', e instanceof ApiError ? e.message : 'Intenta de nuevo.');
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="height" className="flex-1 justify-end bg-black/40">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          className="bg-background rounded-t-3xl"
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40, gap: 16 }}
        >
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-lg font-bold text-foreground">Corregir sesiones ({sesiones.length})</Text>
              <Text className="text-sm text-muted-foreground">
                {SHORT_DAYS[d.getDay()]} {fmtFechaCorta(registro.fecha)} · {registro.trabajador_nombre} {registro.trabajador_apellido}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={COLORS.mutedForeground} />
            </Pressable>
          </View>

          {sesiones.map((s, i) => {
            const enCurso = ultimaAbierta && i === sesiones.length - 1 && !s.salida;
            return (
              <View key={i} className="bg-card rounded-2xl border border-border px-5 py-4 gap-3">
                <Text className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Sesión {i + 1}</Text>
                <View className="flex-row items-center gap-3">
                  <TouchableOpacity onPress={() => setPicker({ i, campo: 'entrada' })} className="flex-1 bg-muted rounded-xl px-4 py-3">
                    <Text className="text-xs text-muted-foreground mb-1">Entrada</Text>
                    <Text className="text-2xl font-bold text-foreground">{fmtTime(s.entrada)}</Text>
                  </TouchableOpacity>
                  <Ionicons name="arrow-forward" size={16} color={COLORS.placeholder} />
                  <TouchableOpacity
                    onPress={() => setPicker({ i, campo: 'salida' })}
                    className="flex-1 bg-muted rounded-xl px-4 py-3"
                  >
                    <Text className="text-xs text-muted-foreground mb-1">Salida</Text>
                    <Text className="text-2xl font-bold text-foreground">{enCurso ? 'En curso' : fmtTime(s.salida)}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {picker && (
            <View className="gap-1.5">
              <DateTimePicker
                value={sesiones[picker.i][picker.campo] ?? new Date()}
                mode="time"
                display="spinner"
                onChange={onChangeHora}
                style={{ width: '100%' }}
              />
              {Platform.OS === 'ios' && (
                <TouchableOpacity onPress={() => setPicker(null)} className="bg-primary/10 rounded-xl py-1.5 items-center">
                  <Text className="text-xs font-semibold text-primary">Listo</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View className="rounded-xl px-4 py-3 flex-row items-center gap-2 bg-info-light">
            <Ionicons name="information-circle-outline" size={16} color={COLORS.info} />
            <Text className="text-xs flex-1 leading-relaxed text-info">
              Al guardar se recalculan las horas de todo el día. Las sesiones deben ir en orden y sin solaparse.
              {ultimaAbierta ? ' Si la última quedó sin salida, ponle la hora para cerrarla.' : ''}
            </Text>
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
