import { showAlert } from '@/lib/alertDialog';
import { Text } from '@/components/ui/Text';
import { COLORS } from '@/lib/designTokens';
import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Platform, Modal, Pressable } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { showToast } from '@/lib/toast';
import { useDuplicarOferta } from '@/features/turnos/useTurnos';
import { Button } from '@/components/ui/Button';
import { formatTimeObj, toISODate } from '@/lib/formatters';
import { fmtDate } from './fechasOferta';

// ── Duplicar oferta (gestores) ──────────────────────────────────────────────

export function DuplicarOfertaModal({
  visible,
  oferta,
  onClose,
}: {
  visible: boolean;
  oferta: { id: number; hora_inicio: string };
  onClose: () => void;
}) {
  const duplicarM = useDuplicarOferta();
  const [fecha, setFecha] = useState(new Date());
  const [hora, setHora]   = useState(new Date());
  const [showFecha, setShowFecha] = useState(false);
  const [showHora, setShowHora]   = useState(false);

  React.useEffect(() => {
    if (!visible) return;
    setFecha(new Date());
    const [h, m] = oferta.hora_inicio.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    setHora(d);
    setShowFecha(false);
    setShowHora(false);
  }, [visible, oferta.hora_inicio]);

  function onChangeFecha(_: DateTimePickerEvent, d?: Date) {
    if (Platform.OS === 'android') setShowFecha(false);
    if (d) setFecha(d);
  }
  function onChangeHora(_: DateTimePickerEvent, d?: Date) {
    if (Platform.OS === 'android') setShowHora(false);
    if (d) setHora(d);
  }

  async function handleDuplicar() {
    try {
      const nueva = await duplicarM.mutateAsync({
        ofertaId: oferta.id,
        fecha: toISODate(fecha),
        hora_inicio: `${formatTimeObj(hora)}:00`,
      });
      onClose();
      showToast(`"${nueva.titulo}" creada para el ${fmtDate(toISODate(fecha))}.`);
    } catch {
      showAlert('Error', 'No se pudo duplicar la oferta.');
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          className="bg-background rounded-t-3xl"
          contentContainerClassName="px-6 pt-5 pb-10 gap-5"
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold text-foreground">Duplicar oferta</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={COLORS.mutedForeground} />
            </Pressable>
          </View>

          <View className="gap-1.5">
            <Text className="text-sm font-semibold text-foreground">Fecha</Text>
            <TouchableOpacity
              onPress={() => setShowFecha(true)}
              className="bg-card border border-border rounded-xl px-4 py-3 flex-row items-center gap-2"
            >
              <Ionicons name="calendar-outline" size={16} color={COLORS.mutedForeground} />
              <Text className="text-sm text-foreground">{fmtDate(toISODate(fecha))}</Text>
            </TouchableOpacity>
            {showFecha && (
              <DateTimePicker
                value={fecha}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                minimumDate={new Date()}
                onChange={onChangeFecha}
              />
            )}
            {showFecha && Platform.OS === 'ios' && (
              <TouchableOpacity onPress={() => setShowFecha(false)} className="bg-primary/10 rounded-xl py-2 items-center">
                <Text className="text-sm font-semibold text-primary">Listo</Text>
              </TouchableOpacity>
            )}
          </View>

          <View className="gap-1.5">
            <Text className="text-sm font-semibold text-foreground">Hora de inicio</Text>
            <TouchableOpacity
              onPress={() => setShowHora(true)}
              className="bg-card border border-border rounded-xl px-4 py-3 flex-row items-center gap-2"
            >
              <Ionicons name="time-outline" size={16} color={COLORS.mutedForeground} />
              <Text className="text-sm text-foreground">{formatTimeObj(hora)}</Text>
            </TouchableOpacity>
            {showHora && (
              <DateTimePicker
                value={hora}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onChangeHora}
              />
            )}
            {showHora && Platform.OS === 'ios' && (
              <TouchableOpacity onPress={() => setShowHora(false)} className="bg-primary/10 rounded-xl py-2 items-center">
                <Text className="text-sm font-semibold text-primary">Listo</Text>
              </TouchableOpacity>
            )}
          </View>

          <Button
            label={duplicarM.isPending ? 'Duplicando…' : 'Duplicar'}
            variant="primary"
            fullWidth
            loading={duplicarM.isPending}
            onPress={handleDuplicar}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}
