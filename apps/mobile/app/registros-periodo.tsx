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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

import {
  useRegistros, useCorregirRegistro, useCrearRegistro,
} from '@/features/nomina/useNomina';
import { useAuthStore } from '@/features/auth/useAuthStore';
import {
  TIPO_DIA_LABEL, fmtHora, fmtFechaCorta,
} from '@/features/nomina/trabajador/nominaTrabajadorUtils';
import { useTheme } from '@/lib/theme';
import type { RegistroDiario, TipoDia } from '@api-client';

// ── Constantes ────────────────────────────────────────────────────────────

const TIPOS_DIA: { v: TipoDia; label: string; color: string }[] = [
  { v: 'ordinario',     label: 'Ordinario',     color: '#64748B' },
  { v: 'descanso',      label: 'Descanso',      color: '#3B82F6' },
  { v: 'vacacion',      label: 'Vacación',      color: '#059669' },
  { v: 'incapacidad',   label: 'Incapacidad',   color: '#F59E0B' },
  { v: 'compensatorio', label: 'Compensatorio', color: '#8B5CF6' },
  { v: 'licencia',      label: 'Licencia',      color: '#EC4899' },
];

const SHORT_DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function fmtTime(d: Date | null): string {
  if (!d) return '—';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── Modal: editar registro existente ─────────────────────────────────────

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

  React.useEffect(() => {
    if (registro) {
      setTipoDia(registro.tipo_dia);
      setNovedad(registro.novedad ?? '');
    }
  }, [registro]);

  if (!registro) return null;

  const handleGuardar = async () => {
    try {
      await corregir.mutateAsync({ id: registro.id, tipo_dia: tipoDia, novedad: novedad.trim() || undefined });
      onClose();
    } catch {
      Alert.alert('Error', 'No se pudo guardar el registro.');
    }
  };

  const d = new Date(`${registro.fecha}T00:00:00`);

  return (
    <Modal visible={!!registro} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end bg-black/40"
      >
        <View className="bg-background rounded-t-3xl px-6 pt-5 pb-10 gap-5">
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

          <View className="gap-2">
            <Text className="text-sm font-semibold text-foreground">Tipo de día</Text>
            <View className="flex-row flex-wrap gap-2">
              {TIPOS_DIA.map(({ v, label, color }) => (
                <Pressable
                  key={v}
                  onPress={() => setTipoDia(v)}
                  className={`px-3 py-2 rounded-xl border ${tipoDia === v ? 'border-transparent' : 'border-border bg-card'}`}
                  style={tipoDia === v ? { backgroundColor: color } : undefined}
                >
                  <Text className={`text-xs font-semibold ${tipoDia === v ? 'text-white' : 'text-muted-foreground'}`}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="gap-1.5">
            <Text className="text-sm font-semibold text-foreground">Novedad (opcional)</Text>
            <TextInput
              value={novedad}
              onChangeText={setNovedad}
              placeholder="Ej: Incapacidad médica radicada, compensatorio aprobado…"
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
              className="bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground"
              style={{ textAlignVertical: 'top', minHeight: 72 }}
            />
          </View>

          <TouchableOpacity
            onPress={handleGuardar}
            disabled={corregir.isPending}
            className="h-14 bg-foreground rounded-2xl items-center justify-center active:opacity-80 disabled:opacity-40"
          >
            {corregir.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text className="text-base font-semibold text-white">Guardar cambios</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Modal: crear nuevo registro ───────────────────────────────────────────

type CreandoState = { trabajadorId: number; nombre: string } | null;

function CrearRegistroModal({
  creando,
  periodoId,
  onClose,
}: {
  creando: CreandoState;
  periodoId: number;
  onClose: () => void;
}) {
  const crear = useCrearRegistro();

  const [fecha,       setFecha]       = useState(new Date());
  const [horaEntrada, setHoraEntrada] = useState<Date | null>(null);
  const [horaSalida,  setHoraSalida]  = useState<Date | null>(null);
  const [novedad,     setNovedad]     = useState('');

  const [showFecha,   setShowFecha]   = useState(false);
  const [showEntrada, setShowEntrada] = useState(false);
  const [showSalida,  setShowSalida]  = useState(false);

  // Reset al abrir para un trabajador distinto
  React.useEffect(() => {
    if (creando) {
      setFecha(new Date());
      setHoraEntrada(null);
      setHoraSalida(null);
      setNovedad('');
      setShowFecha(false);
      setShowEntrada(false);
      setShowSalida(false);
    }
  }, [creando?.trabajadorId]);

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
    if (!horaEntrada) {
      Alert.alert('Falta la hora de entrada');
      return;
    }
    try {
      await crear.mutateAsync({
        periodo_id:    periodoId,
        trabajador_id: creando!.trabajadorId,
        fecha:         fecha.toISOString().slice(0, 10),
        hora_entrada:  fmtTime(horaEntrada),
        hora_salida:   horaSalida ? fmtTime(horaSalida) : undefined,
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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
                {fmtFechaCorta(fecha.toISOString().slice(0, 10))}
              </Text>
            </TouchableOpacity>
            {showFecha && (
              <DateTimePicker
                value={fecha}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={onChangeFecha}
              />
            )}
            {showFecha && Platform.OS === 'ios' && (
              <TouchableOpacity onPress={() => setShowFecha(false)} className="bg-primary/10 rounded-xl py-2 items-center">
                <Text className="text-sm font-semibold text-primary">Listo</Text>
              </TouchableOpacity>
            )}
          </View>

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
              {showEntrada && (
                <DateTimePicker
                  value={horaEntrada ?? new Date()}
                  mode="time"
                  display="spinner"
                  onChange={onChangeEntrada}
                />
              )}
              {showEntrada && Platform.OS === 'ios' && (
                <TouchableOpacity onPress={() => setShowEntrada(false)} className="bg-primary/10 rounded-xl py-1.5 items-center">
                  <Text className="text-xs font-semibold text-primary">Listo</Text>
                </TouchableOpacity>
              )}
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
              {showSalida && (
                <DateTimePicker
                  value={horaSalida ?? new Date()}
                  mode="time"
                  display="spinner"
                  onChange={onChangeSalida}
                />
              )}
              {showSalida && Platform.OS === 'ios' && (
                <TouchableOpacity onPress={() => setShowSalida(false)} className="bg-primary/10 rounded-xl py-1.5 items-center">
                  <Text className="text-xs font-semibold text-primary">Listo</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

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
            className="h-14 bg-foreground rounded-2xl items-center justify-center active:opacity-80 disabled:opacity-40"
          >
            {crear.isPending
              ? <ActivityIndicator color="#fff" />
              : <Text className="text-base font-semibold text-white">Crear registro</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Fila de registro ──────────────────────────────────────────────────────

function RegistroRow({
  registro,
  onEdit,
  canEdit = true,
}: {
  registro: RegistroDiario;
  onEdit: (r: RegistroDiario) => void;
  canEdit?: boolean;
}) {
  const d         = new Date(`${registro.fecha}T00:00:00`);
  const tipoDef   = TIPOS_DIA.find((t) => t.v === registro.tipo_dia);
  const esFestivo = Boolean(registro.es_festivo);

  const totalHoras = [
    registro.horas_ordinarias,
    registro.horas_extra_diurnas,
    registro.horas_extra_nocturnas,
    registro.horas_nocturnas,
    registro.horas_festivo,
  ].reduce((a, b) => a + Number(b), 0);

  return (
    <View className="flex-row items-center px-4 py-3 gap-3 bg-card rounded-2xl">
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
        {canEdit && (
          <TouchableOpacity onPress={() => onEdit(registro)} hitSlop={8}>
            <Ionicons name="pencil-outline" size={16} color="#64748B" />
          </TouchableOpacity>
        )}
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
  const { periodoId, trabajadorId } = useLocalSearchParams<{ periodoId: string; trabajadorId?: string }>();
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

  const registros = data?.data ?? [];

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
      <CrearRegistroModal  creando={creando}   periodoId={numId} onClose={() => setCreando(null)} />

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
            <RegistroRow registro={item} onEdit={setEditando} canEdit={canEdit} />
          )}
          renderSectionHeader={({ section }) => (
            <View className="flex-row items-center gap-2 px-5 pt-5 pb-2">
              <View className="w-7 h-7 rounded-full bg-muted items-center justify-center">
                <Ionicons name="person-outline" size={14} color="#64748B" />
              </View>
              <Text className="text-sm font-semibold text-foreground flex-1">{section.title}</Text>
              <Text className="text-xs text-muted-foreground">· {section.data.length} días</Text>
              {canEdit && (
                <TouchableOpacity
                  onPress={() => setCreando({ trabajadorId: section.trabajadorId, nombre: section.title })}
                  hitSlop={8}
                  className="w-7 h-7 rounded-full bg-primary/10 items-center justify-center"
                >
                  <Ionicons name="add" size={16} color="#6366F1" />
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
