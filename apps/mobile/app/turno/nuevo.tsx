/**
 * Nuevo turno — app/turno/nuevo.tsx
 *
 * Wizard 3 pasos para que jefe_turnos / admin_empresa cree una oferta
 * con múltiples roles (puestos):
 *
 *   Paso 1 — Información básica: título, fecha, horario, ubicación
 *   Paso 2 — Roles y tarifas: cargo × plazas × precio por turno
 *   Paso 3 — Revisar y publicar
 *
 * Al publicar, el backend notifica automáticamente a todos los
 * trabajadores de la empresa que tienen cada cargo certificado.
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

import { useTheme }       from '@/lib/theme';
import { useCargos, useCrearOferta } from '@/features/turnos/useTurnos';
import { Button }         from '@/components/ui/Button';
import { ApiError }       from '@api-client';
import type { Cargo }     from '@api-client';

// ── Types ─────────────────────────────────────────────────────────────────

type PuestoInput = {
  key: string;
  cargo_id: number;
  cargo_nombre: string;
  plazas: number;
  tarifa_dia: string; // string for TextInput, parsed on submit
};

type WizardData = {
  titulo: string;
  descripcion: string;
  dia: string;   // DD
  mes: string;   // MM
  anio: string;  // YYYY
  hora_inicio_h: string;
  hora_inicio_m: string;
  hora_fin_h: string;
  hora_fin_m: string;
  lugar: string;
  latitud: number | null;
  longitud: number | null;
  puestos: PuestoInput[];
};

const INITIAL: WizardData = {
  titulo: '',
  descripcion: '',
  dia: '',
  mes: '',
  anio: '',
  hora_inicio_h: '',
  hora_inicio_m: '',
  hora_fin_h: '',
  hora_fin_m: '',
  lugar: '',
  latitud: null,
  longitud: null,
  puestos: [],
};

// ── Helpers ────────────────────────────────────────────────────────────────

function pad(s: string, len = 2): string {
  return s.padStart(len, '0');
}

function buildFecha(data: WizardData): string {
  return `${pad(data.anio, 4)}-${pad(data.mes)}-${pad(data.dia)}`;
}

function buildTime(h: string, m: string): string {
  return `${pad(h)}:${pad(m)}:00`;
}

function isValidDate(d: string, m: string, y: string): boolean {
  const day = Number(d), month = Number(m), year = Number(y);
  if (!day || !month || !year) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 2024 || year > 2099) return false;
  return true;
}

function isValidTime(h: string, m: string): boolean {
  const hour = Number(h), min = Number(m);
  if (h === '' || m === '') return false;
  return hour >= 0 && hour <= 23 && min >= 0 && min <= 59;
}

// ── Step indicator ─────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <View className="flex-row items-center justify-center gap-2 py-4 px-5">
      {[1, 2, 3].map((s) => (
        <React.Fragment key={s}>
          <View
            className={`h-2 rounded-full transition-all ${
              s <= current ? 'bg-primary-500' : 'bg-muted'
            }`}
            style={{ width: s === current ? 28 : 8 }}
          />
        </React.Fragment>
      ))}
    </View>
  );
}

// ── Labeled segmented input ────────────────────────────────────────────────

function SegmentInput({
  label,
  value,
  onChange,
  maxLength = 2,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  placeholder: string;
}) {
  return (
    <View className="items-center gap-1">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <TextInput
        className="bg-muted rounded-xl text-center text-base font-semibold text-foreground"
        style={{ width: maxLength === 4 ? 72 : 48, height: 44 }}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, maxLength))}
        keyboardType="number-pad"
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        maxLength={maxLength}
      />
    </View>
  );
}

// ── Step 1 — Básicos ───────────────────────────────────────────────────────

function Step1({
  data,
  onChange,
  onNext,
}: {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  onNext: () => void;
}) {
  const [locLoading, setLocLoading] = useState(false);

  const usarUbicacion = async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Activa los permisos de ubicación en ajustes.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      onChange({ latitud: pos.coords.latitude, longitud: pos.coords.longitude });
    } catch {
      Alert.alert('Error', 'No se pudo obtener la ubicación.');
    } finally {
      setLocLoading(false);
    }
  };

  const validate = () => {
    if (!data.titulo.trim()) return 'Escribe un título para el turno.';
    if (!isValidDate(data.dia, data.mes, data.anio)) return 'Ingresa una fecha válida (día, mes y año).';
    if (!isValidTime(data.hora_inicio_h, data.hora_inicio_m)) return 'Hora de inicio inválida.';
    return null;
  };

  const handleNext = () => {
    const err = validate();
    if (err) { Alert.alert('Datos incompletos', err); return; }
    onNext();
  };

  return (
    <ScrollView
      contentContainerClassName="px-5 py-4 gap-5 pb-10"
      keyboardShouldPersistTaps="handled"
    >
      {/* Título */}
      <View className="gap-1.5">
        <Text className="text-sm font-semibold text-foreground">Título del turno *</Text>
        <TextInput
          className="bg-muted rounded-2xl px-4 py-3 text-base text-foreground"
          placeholder="Ej: Montaje feria Corferias — auxiliares"
          placeholderTextColor="#94A3B8"
          value={data.titulo}
          onChangeText={(t) => onChange({ titulo: t })}
          returnKeyType="next"
        />
      </View>

      {/* Descripción */}
      <View className="gap-1.5">
        <Text className="text-sm font-semibold text-foreground">Descripción</Text>
        <TextInput
          className="bg-muted rounded-2xl px-4 py-3 text-base text-foreground"
          placeholder="Instrucciones, requisitos, qué llevar… (opcional)"
          placeholderTextColor="#94A3B8"
          value={data.descripcion}
          onChangeText={(t) => onChange({ descripcion: t })}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          style={{ minHeight: 72 }}
        />
      </View>

      {/* Fecha */}
      <View className="gap-2">
        <Text className="text-sm font-semibold text-foreground">Fecha *</Text>
        <View className="flex-row items-end gap-3">
          <SegmentInput label="Día"  value={data.dia}  onChange={(v) => onChange({ dia: v })}  placeholder="15" />
          <Text className="text-muted-foreground mb-3">/</Text>
          <SegmentInput label="Mes"  value={data.mes}  onChange={(v) => onChange({ mes: v })}  placeholder="06" />
          <Text className="text-muted-foreground mb-3">/</Text>
          <SegmentInput label="Año"  value={data.anio} onChange={(v) => onChange({ anio: v })} placeholder="2026" maxLength={4} />
        </View>
      </View>

      {/* Horario */}
      <View className="gap-2">
        <Text className="text-sm font-semibold text-foreground">Horario *</Text>
        <View className="flex-row gap-6">
          <View className="gap-1.5">
            <Text className="text-xs text-muted-foreground">Inicio</Text>
            <View className="flex-row items-end gap-1">
              <SegmentInput label="HH" value={data.hora_inicio_h} onChange={(v) => onChange({ hora_inicio_h: v })} placeholder="07" />
              <Text className="text-muted-foreground mb-3 font-bold">:</Text>
              <SegmentInput label="mm" value={data.hora_inicio_m} onChange={(v) => onChange({ hora_inicio_m: v })} placeholder="00" />
            </View>
          </View>

          <View className="gap-1.5">
            <Text className="text-xs text-muted-foreground">Fin estimado</Text>
            <View className="flex-row items-end gap-1">
              <SegmentInput label="HH" value={data.hora_fin_h} onChange={(v) => onChange({ hora_fin_h: v })} placeholder="15" />
              <Text className="text-muted-foreground mb-3 font-bold">:</Text>
              <SegmentInput label="mm" value={data.hora_fin_m} onChange={(v) => onChange({ hora_fin_m: v })} placeholder="00" />
            </View>
          </View>
        </View>
      </View>

      {/* Ubicación */}
      <View className="gap-1.5">
        <Text className="text-sm font-semibold text-foreground">Lugar</Text>
        <TextInput
          className="bg-muted rounded-2xl px-4 py-3 text-base text-foreground"
          placeholder="Ej: Corferias, Cra 37 #24-67, Bogotá"
          placeholderTextColor="#94A3B8"
          value={data.lugar}
          onChangeText={(t) => onChange({ lugar: t })}
        />
        <TouchableOpacity
          className="flex-row items-center gap-2 self-start mt-1 px-3 py-2 bg-muted rounded-xl"
          onPress={usarUbicacion}
          disabled={locLoading}
        >
          {locLoading
            ? <ActivityIndicator size="small" color="#3B82F6" />
            : <Ionicons name="location-outline" size={16} color="#3B82F6" />}
          <Text className="text-sm font-medium text-info">
            {locLoading ? 'Obteniendo GPS…' : 'Usar mi ubicación actual'}
          </Text>
        </TouchableOpacity>
        {data.latitud !== null && (
          <View className="flex-row items-center gap-1.5 mt-1">
            <Ionicons name="checkmark-circle" size={14} color="#059669" />
            <Text className="text-xs text-success">
              GPS capturado: {data.latitud.toFixed(5)}, {data.longitud?.toFixed(5)}
            </Text>
          </View>
        )}
      </View>

      <Button label="Siguiente →" variant="primary" size="lg" fullWidth onPress={handleNext} />
    </ScrollView>
  );
}

// ── Cargo selector modal ───────────────────────────────────────────────────

function CargoModal({
  visible,
  cargos,
  usedIds,
  onSelect,
  onClose,
}: {
  visible: boolean;
  cargos: Cargo[];
  usedIds: Set<number>;
  onSelect: (c: Cargo) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(
    () =>
      cargos.filter(
        (c) =>
          !usedIds.has(c.id) &&
          c.nombre.toLowerCase().includes(search.toLowerCase()),
      ),
    [cargos, usedIds, search],
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/40 justify-end">
        <View className="bg-background rounded-t-3xl" style={{ maxHeight: '75%' }}>
          <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
            <Text className="text-base font-bold text-foreground">Seleccionar rol</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <View className="mx-5 mb-3 flex-row items-center bg-muted rounded-2xl px-3 gap-2">
            <Ionicons name="search-outline" size={16} color="#64748B" />
            <TextInput
              className="flex-1 py-3 text-sm text-foreground"
              placeholder="Buscar cargo…"
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
            ItemSeparatorComponent={() => <View className="h-px bg-border" />}
            ListEmptyComponent={
              <Text className="text-sm text-muted-foreground text-center py-8">
                {usedIds.size === cargos.length ? 'Ya agregaste todos los cargos' : 'Sin resultados'}
              </Text>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                className="py-3.5 flex-row items-center gap-3"
                onPress={() => { onSelect(item); onClose(); setSearch(''); }}
              >
                <View className="w-8 h-8 bg-primary-100 rounded-xl items-center justify-center">
                  <Ionicons name="briefcase-outline" size={16} color="#FF5A3C" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">{item.nombre}</Text>
                  {item.descripcion && (
                    <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                      {item.descripcion}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

// ── Step 2 — Roles y tarifas ───────────────────────────────────────────────

function Step2({
  data,
  onChange,
  onNext,
  onBack,
}: {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const { data: cargos = [], isLoading } = useCargos();
  const [modalOpen, setModalOpen] = useState(false);

  const usedIds = useMemo(() => new Set(data.puestos.map((p) => p.cargo_id)), [data.puestos]);

  const addPuesto = (cargo: Cargo) => {
    onChange({
      puestos: [
        ...data.puestos,
        { key: String(Date.now()), cargo_id: cargo.id, cargo_nombre: cargo.nombre, plazas: 1, tarifa_dia: '' },
      ],
    });
  };

  const removePuesto = (key: string) => {
    onChange({ puestos: data.puestos.filter((p) => p.key !== key) });
  };

  const updatePuesto = (key: string, patch: Partial<PuestoInput>) => {
    onChange({
      puestos: data.puestos.map((p) => (p.key === key ? { ...p, ...patch } : p)),
    });
  };

  const validate = () => {
    if (data.puestos.length === 0) return 'Agrega al menos un rol al turno.';
    for (const p of data.puestos) {
      if (p.plazas < 1) return `"${p.cargo_nombre}": mínimo 1 plaza.`;
      const tarifa = parseFloat(p.tarifa_dia.replace(/\./g, '').replace(',', '.'));
      if (!tarifa || tarifa <= 0) return `"${p.cargo_nombre}": ingresa la tarifa por turno.`;
    }
    return null;
  };

  const handleNext = () => {
    const err = validate();
    if (err) { Alert.alert('Datos incompletos', err); return; }
    onNext();
  };

  return (
    <ScrollView
      contentContainerClassName="px-5 py-4 gap-4 pb-10"
      keyboardShouldPersistTaps="handled"
    >
      <View className="gap-1">
        <Text className="text-sm font-semibold text-foreground">
          Roles necesarios *
        </Text>
        <Text className="text-xs text-muted-foreground">
          Agrega cada cargo con su número de plazas y tarifa por turno. Los
          trabajadores con ese cargo recibirán una notificación al publicar.
        </Text>
      </View>

      {/* Puesto cards */}
      {data.puestos.map((p) => (
        <View
          key={p.key}
          className="bg-card rounded-2xl px-4 py-4 gap-3"
          style={{ elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6 }}
        >
          {/* Header */}
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2 flex-1">
              <View className="w-7 h-7 bg-primary-100 rounded-xl items-center justify-center">
                <Ionicons name="briefcase-outline" size={14} color="#FF5A3C" />
              </View>
              <Text className="text-sm font-bold text-foreground flex-1" numberOfLines={1}>
                {p.cargo_nombre}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => removePuesto(p.key)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>

          {/* Plazas + tarifa */}
          <View className="flex-row gap-4">
            {/* Plazas stepper */}
            <View className="gap-1">
              <Text className="text-xs text-muted-foreground">Plazas</Text>
              <View className="flex-row items-center gap-2">
                <TouchableOpacity
                  className="w-8 h-8 bg-muted rounded-xl items-center justify-center"
                  onPress={() => updatePuesto(p.key, { plazas: Math.max(1, p.plazas - 1) })}
                >
                  <Ionicons name="remove" size={16} color="#64748B" />
                </TouchableOpacity>
                <Text className="text-base font-bold text-foreground w-6 text-center">
                  {p.plazas}
                </Text>
                <TouchableOpacity
                  className="w-8 h-8 bg-muted rounded-xl items-center justify-center"
                  onPress={() => updatePuesto(p.key, { plazas: p.plazas + 1 })}
                >
                  <Ionicons name="add" size={16} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Tarifa */}
            <View className="flex-1 gap-1">
              <Text className="text-xs text-muted-foreground">Tarifa por turno</Text>
              <View className="flex-row items-center bg-muted rounded-xl px-3 gap-1">
                <Text className="text-sm font-bold text-muted-foreground">$</Text>
                <TextInput
                  className="flex-1 py-2 text-sm font-semibold text-foreground"
                  placeholder="120.000"
                  placeholderTextColor="#94A3B8"
                  value={p.tarifa_dia}
                  onChangeText={(t) => updatePuesto(p.key, { tarifa_dia: t.replace(/[^\d.,]/g, '') })}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>
        </View>
      ))}

      {/* Add cargo button */}
      <TouchableOpacity
        className="flex-row items-center justify-center gap-2 py-3 border-2 border-dashed border-border rounded-2xl"
        onPress={() => setModalOpen(true)}
        disabled={isLoading}
      >
        {isLoading
          ? <ActivityIndicator size="small" color="#94A3B8" />
          : <Ionicons name="add-circle-outline" size={20} color="#64748B" />}
        <Text className="text-sm font-semibold text-muted-foreground">
          {isLoading ? 'Cargando roles…' : 'Agregar rol'}
        </Text>
      </TouchableOpacity>

      {/* Navigation */}
      <View className="flex-row gap-3 mt-2">
        <Button label="← Atrás" variant="secondary" onPress={onBack} style={{ flex: 1 }} />
        <Button label="Siguiente →" variant="primary" onPress={handleNext} style={{ flex: 2 }} />
      </View>

      <CargoModal
        visible={modalOpen}
        cargos={cargos}
        usedIds={usedIds}
        onSelect={addPuesto}
        onClose={() => setModalOpen(false)}
      />
    </ScrollView>
  );
}

// ── Step 3 — Revisar y publicar ────────────────────────────────────────────

function Step3({
  data,
  onBack,
  onPublish,
  isPublishing,
}: {
  data: WizardData;
  onBack: () => void;
  onPublish: () => void;
  isPublishing: boolean;
}) {
  const fecha = `${pad(data.dia)}/${pad(data.mes)}/${pad(data.anio, 4)}`;
  const inicio = `${pad(data.hora_inicio_h)}:${pad(data.hora_inicio_m)}`;
  const fin = data.hora_fin_h
    ? ` – ${pad(data.hora_fin_h)}:${pad(data.hora_fin_m)}`
    : '';

  const totalPlazas = data.puestos.reduce((s, p) => s + p.plazas, 0);
  const presupuesto = data.puestos.reduce((s, p) => {
    const tarifa = parseFloat(p.tarifa_dia.replace(/\./g, '').replace(',', '.')) || 0;
    return s + tarifa * p.plazas;
  }, 0);

  function SummaryRow({ icon, label, value }: { icon: string; label: string; value: string }) {
    return (
      <View className="flex-row items-start gap-3 py-2.5 border-b border-border">
        <Ionicons name={icon as any} size={16} color="#64748B" style={{ marginTop: 1 }} />
        <View className="flex-1">
          <Text className="text-xs text-muted-foreground">{label}</Text>
          <Text className="text-sm font-medium text-foreground">{value}</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView contentContainerClassName="px-5 py-4 gap-5 pb-10">
      {/* Details */}
      <View
        className="bg-card rounded-2xl px-4 py-2"
        style={{ elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6 }}
      >
        <SummaryRow icon="text-outline"     label="Título"   value={data.titulo} />
        <SummaryRow icon="calendar-outline" label="Fecha"    value={fecha} />
        <SummaryRow icon="time-outline"     label="Horario"  value={`${inicio}${fin}`} />
        {data.lugar ? (
          <SummaryRow icon="location-outline" label="Lugar" value={data.lugar} />
        ) : null}
        {data.latitud !== null ? (
          <SummaryRow
            icon="navigate-outline"
            label="Coordenadas GPS"
            value={`${data.latitud.toFixed(5)}, ${data.longitud?.toFixed(5)}`}
          />
        ) : null}
      </View>

      {/* Puestos */}
      <View
        className="bg-card rounded-2xl px-4 py-3 gap-2"
        style={{ elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6 }}
      >
        <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
          Puestos ({totalPlazas} plazas en total)
        </Text>
        {data.puestos.map((p) => {
          const tarifa = parseFloat(p.tarifa_dia.replace(/\./g, '').replace(',', '.')) || 0;
          return (
            <View key={p.key} className="flex-row items-center justify-between py-2 border-b border-border last:border-0">
              <View className="flex-row items-center gap-2">
                <Text className="text-sm font-semibold text-primary-500">{p.plazas}×</Text>
                <Text className="text-sm font-medium text-foreground">{p.cargo_nombre}</Text>
              </View>
              <Text className="text-sm text-muted-foreground">
                ${tarifa.toLocaleString('es-CO')} c/u
              </Text>
            </View>
          );
        })}
        {presupuesto > 0 && (
          <View className="flex-row items-center justify-between pt-2 mt-1">
            <Text className="text-sm font-bold text-foreground">Presupuesto total</Text>
            <Text className="text-sm font-bold text-success">
              ${presupuesto.toLocaleString('es-CO')}
            </Text>
          </View>
        )}
      </View>

      {/* Notification note */}
      <View className="flex-row items-start gap-3 bg-info-light rounded-2xl px-4 py-3">
        <Ionicons name="notifications-outline" size={18} color="#3B82F6" style={{ marginTop: 1 }} />
        <Text className="flex-1 text-sm text-info">
          Al publicar, se enviará una notificación push a todos los trabajadores
          de la empresa que tengan cada cargo certificado.
        </Text>
      </View>

      {/* Navigation */}
      <View className="flex-row gap-3">
        <Button label="← Atrás" variant="secondary" onPress={onBack} style={{ flex: 1 }} disabled={isPublishing} />
        <Button
          label={isPublishing ? 'Publicando…' : '📢 Publicar turno'}
          variant="primary"
          size="lg"
          loading={isPublishing}
          onPress={onPublish}
          style={{ flex: 2 }}
        />
      </View>
    </ScrollView>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function NuevoTurnoScreen() {
  const router  = useRouter();
  const theme   = useTheme();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [data, setData] = useState<WizardData>(INITIAL);

  const crearMutation = useCrearOferta();

  const patch = useCallback((p: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...p }));
  }, []);

  const handlePublish = async () => {
    const payload = {
      titulo:            data.titulo.trim(),
      descripcion:       data.descripcion.trim() || undefined,
      fecha:             buildFecha(data),
      hora_inicio:       buildTime(data.hora_inicio_h, data.hora_inicio_m),
      hora_fin_estimada: data.hora_fin_h ? buildTime(data.hora_fin_h, data.hora_fin_m) : undefined,
      lugar:             data.lugar.trim() || undefined,
      latitud:           data.latitud ?? undefined,
      longitud:          data.longitud ?? undefined,
      puestos:           data.puestos.map((p) => ({
        cargo_id:  p.cargo_id,
        plazas:    p.plazas,
        tarifa_dia: parseFloat(p.tarifa_dia.replace(/\./g, '').replace(',', '.')) || 0,
      })),
    };

    try {
      await crearMutation.mutateAsync(payload);
      Alert.alert(
        '¡Turno publicado!',
        'Los trabajadores con los cargos seleccionados recibirán una notificación.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'No se pudo publicar el turno.';
      Alert.alert('Error', msg);
    }
  };

  const titles = ['Información básica', 'Roles y tarifas', 'Revisar y publicar'];

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: titles[step - 1],
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          headerBackTitle: 'Cancelar',
          headerTintColor: theme.primary,
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerShadowVisible: true,
        }}
      />

      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <StepIndicator current={step} />

        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={90}
        >
          {step === 1 && (
            <Step1 data={data} onChange={patch} onNext={() => setStep(2)} />
          )}
          {step === 2 && (
            <Step2 data={data} onChange={patch} onNext={() => setStep(3)} onBack={() => setStep(1)} />
          )}
          {step === 3 && (
            <Step3
              data={data}
              onBack={() => setStep(2)}
              onPublish={handlePublish}
              isPublishing={crearMutation.isPending}
            />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}
