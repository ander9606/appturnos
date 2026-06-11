/**
 * Registros del período — vista del jefe_nomina / admin_empresa.
 *
 * Muestra todos los registros diarios del período agrupados por trabajador.
 * Permite al jefe editar tipo_dia y novedad de cada registro.
 */
import React, { useState } from 'react';
import {
  View, Text, SectionList, TouchableOpacity, ActivityIndicator,
  Modal, Pressable, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useRegistros, useCorregirRegistro } from '@/features/nomina/useNomina';
import { TIPO_DIA_LABEL, fmtHora, fmtFechaCorta } from '@/features/nomina/trabajador/nominaTrabajadorUtils';
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

// ── Modal editor de registro ──────────────────────────────────────────────

function EditarRegistroModal({
  registro,
  onClose,
}: {
  registro: RegistroDiario | null;
  onClose: () => void;
}) {
  const corregir = useCorregirRegistro();
  const [tipoDia, setTipoDia]   = useState<TipoDia>(registro?.tipo_dia ?? 'ordinario');
  const [novedad, setNovedad]   = useState(registro?.novedad ?? '');

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
          {/* Encabezado */}
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

          {/* Tipo de día */}
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

          {/* Novedad */}
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

          {/* Guardar */}
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

// ── Fila de registro ──────────────────────────────────────────────────────

function RegistroRow({
  registro,
  onEdit,
}: {
  registro: RegistroDiario;
  onEdit: (r: RegistroDiario) => void;
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
      {/* Fecha pill */}
      <View className={`w-11 items-center py-2 rounded-xl ${esFestivo ? 'bg-danger-light' : 'bg-muted'}`}>
        <Text className={`text-[10px] font-medium ${esFestivo ? 'text-danger' : 'text-muted-foreground'}`}>
          {SHORT_DAYS[d.getDay()]}
        </Text>
        <Text className={`text-sm font-bold ${esFestivo ? 'text-danger' : 'text-foreground'}`}>
          {d.getDate()}
        </Text>
      </View>

      {/* Horas */}
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

      {/* Total + edit */}
      <View className="items-end gap-1">
        <Text className="text-sm font-bold text-foreground">{totalHoras.toFixed(1)}h</Text>
        <TouchableOpacity onPress={() => onEdit(registro)} hitSlop={8}>
          <Ionicons name="pencil-outline" size={16} color="#64748B" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────

export default function RegistrosPeriodoScreen() {
  const theme = useTheme();
  const { periodoId } = useLocalSearchParams<{ periodoId: string }>();
  const numId = Number(periodoId);

  const { data, isLoading, isError, refetch } = useRegistros({ periodo_id: numId, limit: 500 });
  const [editando, setEditando] = useState<RegistroDiario | null>(null);

  const registros = data?.data ?? [];

  // Agrupa por trabajador_id
  type Grupo = { trabajador_id: number; nombre: string; registros: RegistroDiario[] };
  const grupos: Grupo[] = React.useMemo(() => {
    const map = new Map<number, Grupo>();
    for (const r of registros) {
      if (!map.has(r.trabajador_id)) {
        map.set(r.trabajador_id, {
          trabajador_id: r.trabajador_id,
          nombre: `${r.trabajador_nombre} ${r.trabajador_apellido}`,
          registros: [],
        });
      }
      map.get(r.trabajador_id)!.registros.push(r);
    }
    return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [registros]);

  const sections = grupos.map((g) => ({
    title: g.nombre,
    data:  g.registros,
  }));

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['bottom']}>
        <Stack.Screen options={{ title: 'Registros del equipo', headerShown: true }} />
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-8" edges={['bottom']}>
        <Stack.Screen options={{ title: 'Registros del equipo', headerShown: true }} />
        <Text className="text-base font-semibold text-foreground">No se pudieron cargar los registros</Text>
        <TouchableOpacity onPress={() => refetch()} className="mt-4">
          <Text className="text-primary font-semibold">Reintentar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Registros del equipo', headerShown: true }} />

      <EditarRegistroModal registro={editando} onClose={() => setEditando(null)} />

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
            <RegistroRow registro={item} onEdit={setEditando} />
          )}
          renderSectionHeader={({ section }) => (
            <View className="flex-row items-center gap-2 px-5 pt-5 pb-2">
              <View className="w-7 h-7 rounded-full bg-muted items-center justify-center">
                <Ionicons name="person-outline" size={14} color="#64748B" />
              </View>
              <Text className="text-sm font-semibold text-foreground">{section.title}</Text>
              <Text className="text-xs text-muted-foreground">· {section.data.length} días</Text>
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
