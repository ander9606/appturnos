import { showAlert } from '@/lib/alertDialog';
import { Text, TextInput } from '@/components/ui/Text';
import { Spinner } from '@/components/ui/Spinner';
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
import { useCrearRegistro, useCrearRegistroRango } from '@/features/nomina/useNomina';
import { fmtFechaCorta } from '@/features/nomina/trabajador/nominaTrabajadorUtils';
import { toISODate, bogotaToday } from '@/lib/formatters';
import { isChronological } from '@/lib/dateValidation';
import type { TipoDia } from '@api-client';
import { TIPOS_DIA_SIN_HORARIO, TIPOS_RANGO } from './tiposDia';
import { fmtTime } from './fechasRegistro';
import { TipoDiaChips } from './TipoDiaChips';

// ── Modal: crear nuevo registro ───────────────────────────────────────────

export type CreandoState = { trabajadorId: number; nombre: string } | null;

export function CrearRegistroModal({
  creando,
  periodoId,
  fechaInicio,
  fechaFin,
  onClose,
}: {
  creando: CreandoState;
  periodoId: number;
  fechaInicio?: string;
  fechaFin?: string;
  onClose: () => void;
}) {
  const crear = useCrearRegistro();
  const crearRango = useCrearRegistroRango();

  // El último día seleccionable del período: si ya terminó, es su fecha fin,
  // no "hoy" — un value posterior al maximumDate cuelga el picker nativo de Android.
  const fechaMaxPeriodo = fechaFin && fechaFin < bogotaToday() ? fechaFin : bogotaToday();

  const [fecha,       setFecha]       = useState(() => new Date(`${fechaMaxPeriodo}T00:00:00`));
  const [fechaHasta,  setFechaHasta]  = useState(() => new Date(`${fechaMaxPeriodo}T00:00:00`));
  const [tipoDia,     setTipoDia]     = useState<TipoDia>('ordinario');
  const [horaEntrada, setHoraEntrada] = useState<Date | null>(null);
  const [horaSalida,  setHoraSalida]  = useState<Date | null>(null);
  const [novedad,     setNovedad]     = useState('');

  const [showFecha,      setShowFecha]      = useState(false);
  const [showFechaHasta, setShowFechaHasta] = useState(false);
  const [showEntrada,    setShowEntrada]    = useState(false);
  const [showSalida,     setShowSalida]     = useState(false);

  const esAusencia = tipoDia === 'ausencia';
  const esRango = TIPOS_RANGO.includes(tipoDia);
  const sinHorario = esAusencia || TIPOS_DIA_SIN_HORARIO.includes(tipoDia);

  // Reset al abrir para un trabajador distinto
  React.useEffect(() => {
    if (creando) {
      setFecha(new Date(`${fechaMaxPeriodo}T00:00:00`));
      setFechaHasta(new Date(`${fechaMaxPeriodo}T00:00:00`));
      setTipoDia('ordinario');
      setHoraEntrada(null);
      setHoraSalida(null);
      setNovedad('');
      setShowFecha(false);
      setShowFechaHasta(false);
      setShowEntrada(false);
      setShowSalida(false);
    }
  }, [creando?.trabajadorId, fechaMaxPeriodo]);

  if (!creando) return null;

  function onChangeFecha(_: DateTimePickerEvent, d?: Date) {
    if (Platform.OS === 'android') setShowFecha(false);
    if (d) {
      setFecha(d);
      if (d > fechaHasta) setFechaHasta(d);
    }
  }
  function onChangeFechaHasta(_: DateTimePickerEvent, d?: Date) {
    if (Platform.OS === 'android') setShowFechaHasta(false);
    if (d) setFechaHasta(d);
  }
  function onChangeEntrada(_: DateTimePickerEvent, d?: Date) {
    if (Platform.OS === 'android') setShowEntrada(false);
    if (d) setHoraEntrada(d);
  }
  function onChangeSalida(_: DateTimePickerEvent, d?: Date) {
    if (Platform.OS === 'android') setShowSalida(false);
    if (d) setHoraSalida(d);
  }

  async function handleGuardar() {
    if (esRango) {
      const desdeISO = toISODate(fecha);
      const hastaISO = toISODate(fechaHasta);
      if (hastaISO < desdeISO) {
        showAlert('"Hasta" no puede ser anterior a "Desde".');
        return;
      }
      if (fechaInicio && fechaFin && !(desdeISO >= fechaInicio && hastaISO <= fechaFin)) {
        showAlert('Fecha fuera del período', `El rango debe estar entre ${fechaInicio} y ${fechaFin}.`, 'warning');
        return;
      }
      if (hastaISO > bogotaToday()) {
        showAlert('Fecha inválida', 'No puedes registrar un día que aún no ha ocurrido.', 'warning');
        return;
      }
      try {
        const { creados, existentes, total } = await crearRango.mutateAsync({
          periodo_id:    periodoId,
          trabajador_id: creando!.trabajadorId,
          fecha_desde:   desdeISO,
          fecha_hasta:   hastaISO,
          tipo_dia:      tipoDia,
          novedad:       novedad.trim() || undefined,
        });
        showAlert('Listo', existentes > 0
          ? `${creados} de ${total} días creados (${existentes} ya tenían registro).`
          : `${creados} día${creados === 1 ? '' : 's'} creado${creados === 1 ? '' : 's'}.`, 'success');
        onClose();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'No se pudo crear el registro.';
        showAlert('Error', msg);
      }
      return;
    }

    if (!sinHorario && !horaEntrada) {
      showAlert('Falta la hora de entrada', undefined, 'warning');
      return;
    }
    if (!sinHorario && horaEntrada && horaSalida && isChronological(fmtTime(horaSalida), fmtTime(horaEntrada))) {
      showAlert('La hora de salida debe ser después de la de entrada.');
      return;
    }
    const fechaISO = toISODate(fecha);
    if (fechaInicio && fechaFin && !(fechaISO >= fechaInicio && fechaISO <= fechaFin)) {
      showAlert('Fecha fuera del período', `La fecha debe estar entre ${fechaInicio} y ${fechaFin}.`, 'warning');
      return;
    }
    if (fechaISO > bogotaToday()) {
      showAlert('Fecha inválida', 'No puedes registrar un día que aún no ha ocurrido.', 'warning');
      return;
    }
    try {
      await crear.mutateAsync({
        periodo_id:    periodoId,
        trabajador_id: creando!.trabajadorId,
        fecha:         toISODate(fecha),
        tipo_dia:      tipoDia,
        hora_entrada:  sinHorario ? undefined : fmtTime(horaEntrada!),
        hora_salida:   !sinHorario && horaSalida ? fmtTime(horaSalida) : undefined,
        novedad:       novedad.trim() || undefined,
      });
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo crear el registro.';
      showAlert('Error', msg);
    }
  }

  return (
    <Modal visible={!!creando} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior="height"
        className="flex-1 justify-end bg-black/40"
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          className="bg-background rounded-t-3xl"
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40, gap: 20 }}
        >
          {/* Encabezado */}
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-lg font-bold text-foreground">Nuevo registro</Text>
              <Text className="text-sm text-muted-foreground">{creando.nombre}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={COLORS.mutedForeground} />
            </Pressable>
          </View>

          {/* Fecha (o "Desde" cuando el tipo de día se marca por rango) */}
          <View className="gap-1.5">
            <Text className="text-sm font-semibold text-foreground">{esRango ? 'Desde' : 'Fecha'}</Text>
            <TouchableOpacity
              onPress={() => setShowFecha(true)}
              className="bg-card border border-border rounded-xl px-4 py-3 flex-row items-center gap-2"
            >
              <Ionicons name="calendar-outline" size={16} color={COLORS.mutedForeground} />
              <Text className="text-sm text-foreground">
                {fmtFechaCorta(toISODate(fecha))}
              </Text>
            </TouchableOpacity>
            {showFecha && (
              <DateTimePicker
                value={fecha}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                minimumDate={fechaInicio ? new Date(`${fechaInicio}T00:00:00`) : undefined}
                maximumDate={new Date(`${fechaMaxPeriodo}T00:00:00`)}
                onChange={onChangeFecha}
              />
            )}
            {showFecha && Platform.OS === 'ios' && (
              <TouchableOpacity onPress={() => setShowFecha(false)} className="bg-primary/10 rounded-xl py-2 items-center">
                <Text className="text-sm font-semibold text-primary">Listo</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Hasta — solo para tipos de día que se marcan por rango (licencia/vacación) */}
          {esRango && (
            <View className="gap-1.5">
              <Text className="text-sm font-semibold text-foreground">Hasta</Text>
              <TouchableOpacity
                onPress={() => setShowFechaHasta(true)}
                className="bg-card border border-border rounded-xl px-4 py-3 flex-row items-center gap-2"
              >
                <Ionicons name="calendar-outline" size={16} color={COLORS.mutedForeground} />
                <Text className="text-sm text-foreground">
                  {fmtFechaCorta(toISODate(fechaHasta))}
                </Text>
              </TouchableOpacity>
              {showFechaHasta && (
                <DateTimePicker
                  value={fechaHasta}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  minimumDate={fecha}
                  maximumDate={new Date(`${fechaMaxPeriodo}T00:00:00`)}
                  onChange={onChangeFechaHasta}
                />
              )}
              {showFechaHasta && Platform.OS === 'ios' && (
                <TouchableOpacity onPress={() => setShowFechaHasta(false)} className="bg-primary/10 rounded-xl py-2 items-center">
                  <Text className="text-sm font-semibold text-primary">Listo</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Tipo de día — 'Ausencia', 'Compensatorio', 'Descanso', 'Licencia' y 'Vacación' ocultan entrada/salida, no requieren hora. */}
          <View className="gap-2">
            <Text className="text-sm font-semibold text-foreground">Tipo de día</Text>
            <TipoDiaChips value={tipoDia} onChange={setTipoDia} />
          </View>

          {sinHorario ? (
            <View className={`rounded-xl px-4 py-3 flex-row items-center gap-2 ${esAusencia ? 'bg-danger-light' : 'bg-info-light'}`}>
              <Ionicons name="information-circle-outline" size={16} color={esAusencia ? COLORS.danger : COLORS.info} />
              <Text className={`text-xs flex-1 ${esAusencia ? 'text-danger' : 'text-info'}`}>
                {esAusencia
                  ? 'Se registrará como falta, sin horas trabajadas ni pago para este día.'
                  : esRango
                    ? 'Este tipo de día no requiere horario — se creará un registro igual para cada día del rango.'
                    : 'Este tipo de día no requiere horario de entrada ni salida.'}
              </Text>
            </View>
          ) : (
            <>
              {/* Entrada + Salida */}
              <View className="flex-row gap-3">
                {/* Entrada */}
                <View className="flex-1 gap-1.5">
                  <Text className="text-sm font-semibold text-foreground">
                    Entrada <Text className="text-danger">*</Text>
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowEntrada(true)}
                    className={`bg-card border rounded-xl px-3 py-3 items-center ${!horaEntrada ? 'border-amber-300' : 'border-border'}`}
                  >
                    <Text className={`text-sm font-semibold ${!horaEntrada ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {fmtTime(horaEntrada)}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Salida */}
                <View className="flex-1 gap-1.5">
                  <Text className="text-sm font-semibold text-foreground">Salida</Text>
                  <TouchableOpacity
                    onPress={() => setShowSalida(true)}
                    className="bg-card border border-border rounded-xl px-3 py-3 items-center"
                  >
                    <Text className={`text-sm ${!horaSalida ? 'text-muted-foreground' : 'text-foreground font-semibold'}`}>
                      {fmtTime(horaSalida)}
                    </Text>
                  </TouchableOpacity>
                </View>
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
            </>
          )}

          {/* Novedad */}
          <View className="gap-1.5">
            <Text className="text-sm font-semibold text-foreground">Novedad (opcional)</Text>
            <TextInput
              value={novedad}
              onChangeText={setNovedad}
              placeholder="Ej: Permiso médico, llegada tardía…"
              placeholderTextColor={COLORS.placeholder}
              multiline
              numberOfLines={2}
              className="bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground"
              style={{ textAlignVertical: 'top', minHeight: 60 }}
            />
          </View>

          <TouchableOpacity
            onPress={handleGuardar}
            disabled={crear.isPending || crearRango.isPending}
            className={`h-14 rounded-2xl items-center justify-center active:opacity-80 disabled:opacity-40 ${esAusencia ? 'bg-danger' : 'bg-foreground'}`}
          >
            {crear.isPending || crearRango.isPending
              ? <Spinner color={COLORS.white} />
              : <Text className="text-base font-semibold text-white">{esAusencia ? 'Marcar ausencia' : esRango ? 'Crear registros' : 'Crear registro'}</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
