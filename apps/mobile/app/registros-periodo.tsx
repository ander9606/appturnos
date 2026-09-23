/**
 * Registros del período — vista del jefe_nomina / admin_empresa.
 *
 * Muestra todos los registros diarios del período agrupados por trabajador.
 * Permite editar tipo_dia y novedad de registros existentes, y crear
 * registros nuevos para días sin marcaje.
 */
import React, { useState } from 'react';
import {
  View, Text, SectionList, TouchableOpacity, ActivityIndicator,
  Modal, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { UbicacionLink } from '@/components/ui/UbicacionLink';

import {
  useRegistros, useCorregirRegistro, useCrearRegistro,
} from '@/features/nomina/useNomina';
import {
  useCompensatoriosTodos, useReasignarCompensatorio,
} from '@/features/nomina/compensatorios/useCompensatorios';
import { RangoFechasCompensatorio } from '@/features/nomina/compensatorios/RangoFechasCompensatorio';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { useRoleGuard } from '@/components/RoleGuard';
import {
  TIPO_DIA_LABEL, fmtHora, fmtFechaCorta,
} from '@/features/nomina/trabajador/nominaTrabajadorUtils';
import { useTheme } from '@/lib/theme';
import { toISODate, bogotaToday } from '@/lib/formatters';
import { isChronological } from '@/lib/dateValidation';
import type { RegistroDiario, TipoDia, DescansoCompensatorio } from '@api-client';

// ── Constantes ────────────────────────────────────────────────────────────

const TIPOS_DIA: { v: TipoDia; label: string; color: string }[] = [
  { v: 'ordinario',     label: 'Ordinario',     color: '#64748B' },
  { v: 'descanso',      label: 'Descanso',      color: '#3B82F6' },
  { v: 'vacacion',      label: 'Vacación',      color: '#059669' },
  { v: 'incapacidad',   label: 'Incapacidad',   color: '#F59E0B' },
  { v: 'compensatorio', label: 'Compensatorio', color: '#8B5CF6' },
  { v: 'licencia',      label: 'Licencia',      color: '#EC4899' },
  { v: 'ausencia',      label: 'Ausencia (no vino)', color: '#EF4444' },
];

function TipoDiaChips({ value, onChange }: { value: TipoDia; onChange: (v: TipoDia) => void }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {TIPOS_DIA.map(({ v, label, color }) => (
        <Pressable
          key={v}
          onPress={() => onChange(v)}
          className={`px-3 py-2 rounded-xl border ${value === v ? 'border-transparent' : 'border-border bg-card'}`}
          style={value === v ? { backgroundColor: color } : undefined}
        >
          <Text className={`text-xs font-semibold ${value === v ? 'text-white' : 'text-muted-foreground'}`}>
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const SHORT_DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function fmtTime(d: Date | null): string {
  if (!d) return '—';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── Modal: editar registro existente ─────────────────────────────────────

/** Parsea "HH:MM:SS" o "HH:MM" del registro a un Date de hoy con esa hora, para el picker. */
function horaAFecha(hora: string | null | undefined): Date | null {
  if (!hora) return null;
  const [h, m] = hora.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function EditarRegistroModal({
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
  const sinHorario = esAusencia || tipoDia === 'compensatorio';

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
      Alert.alert('La hora de salida no puede ser igual a la de entrada.');
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
      Alert.alert('Error', 'No se pudo guardar el registro.');
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
              <Ionicons name="close" size={22} color="#64748B" />
            </Pressable>
          </View>

          <View className="bg-card rounded-2xl border border-border px-5 py-4 gap-3">
            <Text className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Tipo de día</Text>
            <TipoDiaChips value={tipoDia} onChange={setTipoDia} />
          </View>

          {sinHorario ? (
            <View className={`rounded-xl px-4 py-3 flex-row items-center gap-2 ${esAusencia ? 'bg-danger-light' : 'bg-info-light'}`}>
              <Ionicons name="information-circle-outline" size={16} color={esAusencia ? '#EF4444' : '#3B82F6'} />
              <Text className={`text-xs flex-1 leading-relaxed ${esAusencia ? 'text-danger' : 'text-info'}`}>
                {esAusencia
                  ? 'Se registrará como falta, sin horas trabajadas ni pago para este día.'
                  : 'Los descansos compensatorios no requieren horario de entrada ni salida.'}
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
                <Ionicons name="arrow-forward" size={16} color="#94A3B8" />
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
              placeholderTextColor="#94A3B8"
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

// ── Modal: reasignar descanso compensatorio ──────────────────────────────

function ReasignarCompensatorioModal({
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
      Alert.alert('Esa ya es la fecha asignada actual.');
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
              <Ionicons name="close" size={22} color="#64748B" />
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
              ? <ActivityIndicator color="#fff" />
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

// ── Modal: crear nuevo registro ───────────────────────────────────────────

type CreandoState = { trabajadorId: number; nombre: string } | null;

function CrearRegistroModal({
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

  // El último día seleccionable del período: si ya terminó, es su fecha fin,
  // no "hoy" — un value posterior al maximumDate cuelga el picker nativo de Android.
  const fechaMaxPeriodo = fechaFin && fechaFin < bogotaToday() ? fechaFin : bogotaToday();

  const [fecha,       setFecha]       = useState(() => new Date(`${fechaMaxPeriodo}T00:00:00`));
  const [tipoDia,     setTipoDia]     = useState<TipoDia>('ordinario');
  const [horaEntrada, setHoraEntrada] = useState<Date | null>(null);
  const [horaSalida,  setHoraSalida]  = useState<Date | null>(null);
  const [novedad,     setNovedad]     = useState('');

  const [showFecha,   setShowFecha]   = useState(false);
  const [showEntrada, setShowEntrada] = useState(false);
  const [showSalida,  setShowSalida]  = useState(false);

  const esAusencia = tipoDia === 'ausencia';
  const sinHorario = esAusencia || tipoDia === 'compensatorio';

  // Reset al abrir para un trabajador distinto
  React.useEffect(() => {
    if (creando) {
      setFecha(new Date(`${fechaMaxPeriodo}T00:00:00`));
      setTipoDia('ordinario');
      setHoraEntrada(null);
      setHoraSalida(null);
      setNovedad('');
      setShowFecha(false);
      setShowEntrada(false);
      setShowSalida(false);
    }
  }, [creando?.trabajadorId, fechaMaxPeriodo]);

  if (!creando) return null;

  function onChangeFecha(_: DateTimePickerEvent, d?: Date) {
    if (Platform.OS === 'android') setShowFecha(false);
    if (d) setFecha(d);
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
    if (!sinHorario && !horaEntrada) {
      Alert.alert('Falta la hora de entrada');
      return;
    }
    if (!sinHorario && horaEntrada && horaSalida && isChronological(fmtTime(horaSalida), fmtTime(horaEntrada))) {
      Alert.alert('La hora de salida debe ser después de la de entrada.');
      return;
    }
    const fechaISO = toISODate(fecha);
    if (fechaInicio && fechaFin && !(fechaISO >= fechaInicio && fechaISO <= fechaFin)) {
      Alert.alert('Fecha fuera del período', `La fecha debe estar entre ${fechaInicio} y ${fechaFin}.`);
      return;
    }
    if (fechaISO > bogotaToday()) {
      Alert.alert('Fecha inválida', 'No puedes registrar un día que aún no ha ocurrido.');
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
      Alert.alert('Error', msg);
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
              <Ionicons name="close" size={22} color="#64748B" />
            </Pressable>
          </View>

          {/* Fecha */}
          <View className="gap-1.5">
            <Text className="text-sm font-semibold text-foreground">Fecha</Text>
            <TouchableOpacity
              onPress={() => setShowFecha(true)}
              className="bg-card border border-border rounded-xl px-4 py-3 flex-row items-center gap-2"
            >
              <Ionicons name="calendar-outline" size={16} color="#64748B" />
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

          {/* Tipo de día — 'Ausencia' y 'Compensatorio' ocultan entrada/salida, no requieren hora. */}
          <View className="gap-2">
            <Text className="text-sm font-semibold text-foreground">Tipo de día</Text>
            <TipoDiaChips value={tipoDia} onChange={setTipoDia} />
          </View>

          {sinHorario ? (
            <View className={`rounded-xl px-4 py-3 flex-row items-center gap-2 ${esAusencia ? 'bg-danger-light' : 'bg-info-light'}`}>
              <Ionicons name="information-circle-outline" size={16} color={esAusencia ? '#EF4444' : '#3B82F6'} />
              <Text className={`text-xs flex-1 ${esAusencia ? 'text-danger' : 'text-info'}`}>
                {esAusencia
                  ? 'Se registrará como falta, sin horas trabajadas ni pago para este día.'
                  : 'Los descansos compensatorios no requieren horario de entrada ni salida.'}
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
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={2}
              className="bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground"
              style={{ textAlignVertical: 'top', minHeight: 60 }}
            />
          </View>

          <TouchableOpacity
            onPress={handleGuardar}
            disabled={crear.isPending}
            className={`h-14 rounded-2xl items-center justify-center active:opacity-80 disabled:opacity-40 ${esAusencia ? 'bg-danger' : 'bg-foreground'}`}
          >
            {crear.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text className="text-base font-semibold text-white">{esAusencia ? 'Marcar ausencia' : 'Crear registro'}</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Modal: ubicación de marcaje ──────────────────────────────────────────

function UbicacionMarcajeModal({
  registro,
  onClose,
}: {
  registro: RegistroDiario | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (!registro) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-end">
        <View
          className="w-full bg-background rounded-t-3xl px-6 pt-5"
          style={{ paddingBottom: insets.bottom + 20 }}
        >
          <View className="flex-row items-center justify-between mb-5">
            <View>
              <Text className="text-lg font-bold text-foreground">Ubicación de marcaje</Text>
              <Text className="text-sm text-muted-foreground">
                {registro.trabajador_nombre} {registro.trabajador_apellido} · {fmtFechaCorta(registro.fecha)}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color="#64748B" />
            </Pressable>
          </View>
          <View className="gap-3">
            {registro.latitud_entrada != null && (
              <UbicacionLink lat={registro.latitud_entrada} lng={registro.longitud_entrada!} label="Entrada" />
            )}
            {registro.latitud_salida != null && (
              <UbicacionLink lat={registro.latitud_salida} lng={registro.longitud_salida!} label="Salida" />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Fila de registro ──────────────────────────────────────────────────────

function RegistroRow({
  registro,
  onEdit,
  canEdit = true,
  compensatorio,
  onReasignar,
  onVerUbicacion,
}: {
  registro: RegistroDiario;
  onEdit: (r: RegistroDiario) => void;
  canEdit?: boolean;
  compensatorio?: DescansoCompensatorio;
  onReasignar?: (c: DescansoCompensatorio) => void;
  onVerUbicacion?: (r: RegistroDiario) => void;
}) {
  const d         = new Date(`${registro.fecha}T00:00:00`);
  const tipoDef   = TIPOS_DIA.find((t) => t.v === registro.tipo_dia);
  const esFestivo = Boolean(registro.es_festivo);
  const tieneUbicacion = registro.latitud_entrada != null || registro.latitud_salida != null;

  const totalHoras = [
    registro.horas_ordinarias,
    registro.horas_extra_diurnas,
    registro.horas_extra_nocturnas,
    registro.horas_nocturnas,
    registro.horas_festivo,
  ].reduce((a, b) => a + Number(b), 0);

  return (
    <View className="flex-row items-center px-4 py-3 gap-3 bg-card border border-border rounded-2xl">
      <View className={`w-11 items-center py-2 rounded-xl ${esFestivo ? 'bg-danger-light' : 'bg-muted'}`}>
        <Text className={`text-[10px] font-medium ${esFestivo ? 'text-danger' : 'text-muted-foreground'}`}>
          {SHORT_DAYS[d.getDay()]}
        </Text>
        <Text className={`text-sm font-bold ${esFestivo ? 'text-danger' : 'text-foreground'}`}>
          {d.getDate()}
        </Text>
      </View>

      <View className="flex-1 gap-0.5">
        <Text className="text-sm font-medium text-foreground">
          {fmtHora(registro.hora_entrada)} → {fmtHora(registro.hora_salida)}
        </Text>
        {tipoDef && tipoDef.v !== 'ordinario' && (
          <View className="self-start px-2 py-0.5 rounded-full" style={{ backgroundColor: `${tipoDef.color}20` }}>
            <Text className="text-[10px] font-semibold" style={{ color: tipoDef.color }}>
              {tipoDef.label}
            </Text>
          </View>
        )}
        {registro.novedad ? (
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>{registro.novedad}</Text>
        ) : null}
      </View>

      <View className="items-end gap-1">
        <Text className="text-sm font-bold text-foreground">{totalHoras.toFixed(1)}h</Text>
        <View className="flex-row items-center gap-2">
          {canEdit && compensatorio && (
            <TouchableOpacity onPress={() => onReasignar?.(compensatorio)} hitSlop={8}>
              <Ionicons name="calendar-outline" size={16} color={tipoDef?.color ?? '#8B5CF6'} />
            </TouchableOpacity>
          )}
          {canEdit && tieneUbicacion && (
            <TouchableOpacity
              onPress={() => onVerUbicacion?.(registro)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Ver ubicación de marcaje"
            >
              <Ionicons name="location-outline" size={16} color="#3B82F6" />
            </TouchableOpacity>
          )}
          {canEdit && (
            <TouchableOpacity onPress={() => onEdit(registro)} hitSlop={8}>
              <Ionicons name="pencil-outline" size={16} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────

type Seccion = {
  title:        string;
  trabajadorId: number;
  data:         RegistroDiario[];
};

export default function RegistrosPeriodoScreen() {
  const theme = useTheme();
  const { periodoId, trabajadorId, fechaInicio, fechaFin } = useLocalSearchParams<{
    periodoId: string; trabajadorId?: string; fechaInicio?: string; fechaFin?: string;
  }>();
  const numId        = Number(periodoId);
  const numTrabId    = trabajadorId ? Number(trabajadorId) : undefined;
  const rol          = useAuthStore((s) => s.usuario?.rol);
  const canEdit      = rol !== 'nomina';

  const { data, isLoading, isError, refetch } = useRegistros({
    periodo_id:    numId,
    trabajador_id: numTrabId,
    limit:         500,
  });
  const [editando, setEditando] = useState<RegistroDiario | null>(null);
  const [creando,  setCreando]  = useState<CreandoState>(null);
  const [reasignando, setReasignando] = useState<DescansoCompensatorio | null>(null);
  const [viendoUbicacion, setViendoUbicacion] = useState<RegistroDiario | null>(null);

  const registros = data?.data ?? [];

  const { data: compensatorios = [] } = useCompensatoriosTodos();
  /** El registro del día 'compensatorio' no guarda el id del descanso — se cruza por trabajador_id + fecha, mismo criterio que usa el backend en compensatorios.service.js. */
  const compensatorioPorDia = React.useMemo(() => {
    const m = new Map<string, DescansoCompensatorio>();
    for (const c of compensatorios) {
      if (c.fecha_asignada) m.set(`${c.trabajador_id}|${c.fecha_asignada}`, c);
    }
    return m;
  }, [compensatorios]);
  function compensatorioDe(r: RegistroDiario): DescansoCompensatorio | undefined {
    return r.tipo_dia === 'compensatorio' ? compensatorioPorDia.get(`${r.trabajador_id}|${r.fecha}`) : undefined;
  }

  const sections: Seccion[] = React.useMemo(() => {
    const map = new Map<number, { trabajadorId: number; nombre: string; registros: RegistroDiario[] }>();
    for (const r of registros) {
      if (!map.has(r.trabajador_id)) {
        map.set(r.trabajador_id, {
          trabajadorId: r.trabajador_id,
          nombre:       `${r.trabajador_nombre} ${r.trabajador_apellido}`,
          registros:    [],
        });
      }
      map.get(r.trabajador_id)!.registros.push(r);
    }
    return Array.from(map.values())
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((g) => ({ title: g.nombre, trabajadorId: g.trabajadorId, data: g.registros }));
  }, [registros]);

  const denied = useRoleGuard(['admin_empresa', 'jefe_nomina', 'nomina']);
  if (denied) return denied;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['bottom']}>
        <Stack.Screen options={{ title: numTrabId ? 'Registros del trabajador' : 'Registros del equipo', headerShown: true }} />
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-8" edges={['bottom']}>
        <Stack.Screen options={{ title: numTrabId ? 'Registros del trabajador' : 'Registros del equipo', headerShown: true }} />
        <Text className="text-base font-semibold text-foreground">No se pudieron cargar los registros</Text>
        <TouchableOpacity onPress={() => refetch()} className="mt-4">
          <Text className="text-primary font-semibold">Reintentar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen options={{ title: numTrabId ? 'Registros del trabajador' : 'Registros del equipo', headerShown: true }} />

      <EditarRegistroModal registro={editando} onClose={() => setEditando(null)} />
      <CrearRegistroModal
        creando={creando}
        periodoId={numId}
        fechaInicio={fechaInicio}
        fechaFin={fechaFin}
        onClose={() => setCreando(null)}
      />
      <ReasignarCompensatorioModal compensatorio={reasignando} onClose={() => setReasignando(null)} />
      <UbicacionMarcajeModal registro={viendoUbicacion} onClose={() => setViendoUbicacion(null)} />

      {sections.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Ionicons name="calendar-outline" size={48} color="#94A3B8" />
          <Text className="text-base font-semibold text-foreground text-center">
            Sin registros en este período
          </Text>
          <Text className="text-sm text-muted-foreground text-center">
            Los trabajadores aún no han marcado jornadas en este período.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <RegistroRow
              registro={item}
              onEdit={setEditando}
              canEdit={canEdit}
              compensatorio={compensatorioDe(item)}
              onReasignar={setReasignando}
              onVerUbicacion={setViendoUbicacion}
            />
          )}
          renderSectionHeader={({ section }) => (
            // Fondo sólido + borde propios (no solo texto sobre la página) para que
            // se note dónde termina un trabajador y empieza el siguiente.
            <View className="flex-row items-center gap-2 px-3.5 py-2.5 mt-5 mb-2 bg-primary-50 border border-primary-100 rounded-2xl">
              <View className="w-7 h-7 rounded-full bg-primary-100 items-center justify-center">
                <Ionicons name="person-outline" size={14} color="#E83E1F" />
              </View>
              <Text className="text-sm font-bold text-primary-700 flex-1">{section.title}</Text>
              <Text className="text-xs text-primary-600">· {section.data.length} días</Text>
              {canEdit && (
                <TouchableOpacity
                  onPress={() => setCreando({ trabajadorId: section.trabajadorId, nombre: section.title })}
                  hitSlop={8}
                  className="w-7 h-7 rounded-full bg-white items-center justify-center"
                >
                  <Ionicons name="add" size={16} color="#E83E1F" />
                </TouchableOpacity>
              )}
            </View>
          )}
          ItemSeparatorComponent={() => <View className="h-2" />}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
        />
      )}
    </SafeAreaView>
  );
}
