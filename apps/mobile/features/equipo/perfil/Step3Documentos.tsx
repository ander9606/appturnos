import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Pressable,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useCargos, useCrearCargo } from '@/features/turnos/useTurnos';
import { validateStep3, uid, buildMesAnio } from './utils';
import type { WizardData, ExperienciaInput, DiplomaInput } from './types';

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="flex-1 h-px bg-border" />
      <Text className="text-xs text-muted-foreground font-medium">{label}</Text>
      <View className="flex-1 h-px bg-border" />
    </View>
  );
}

function MonthYearInput({
  label, m, a, onChangeM, onChangeA,
}: {
  label: string; m: string; a: string;
  onChangeM: (v: string) => void; onChangeA: (v: string) => void;
}) {
  return (
    <View className="gap-1">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <View className="flex-row items-end gap-2">
        <View className="items-center gap-0.5">
          <Text className="text-xs text-muted-foreground">MM</Text>
          <TextInput
            className="bg-muted rounded-xl text-center text-base font-semibold text-foreground"
            style={{ width: 52, height: 40 }}
            value={m}
            onChangeText={(t) => onChangeM(t.replace(/\D/g, '').slice(0, 2))}
            keyboardType="number-pad"
            placeholder="06"
            placeholderTextColor="#94A3B8"
            maxLength={2}
          />
        </View>
        <Text className="text-muted-foreground mb-2">/</Text>
        <View className="items-center gap-0.5">
          <Text className="text-xs text-muted-foreground">AAAA</Text>
          <TextInput
            className="bg-muted rounded-xl text-center text-base font-semibold text-foreground"
            style={{ width: 72, height: 40 }}
            value={a}
            onChangeText={(t) => onChangeA(t.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            placeholder="2022"
            placeholderTextColor="#94A3B8"
            maxLength={4}
          />
        </View>
      </View>
    </View>
  );
}

function DateSegInput({
  label, d, m, a, onChangeD, onChangeM, onChangeA,
}: {
  label: string; d: string; m: string; a: string;
  onChangeD: (v: string) => void; onChangeM: (v: string) => void; onChangeA: (v: string) => void;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <View className="flex-row items-end gap-2">
        {[
          { lbl: 'DD', val: d, max: 2, ph: '15', fn: onChangeD },
          { lbl: 'MM', val: m, max: 2, ph: '01', fn: onChangeM },
          { lbl: 'AAAA', val: a, max: 4, ph: '2024', fn: onChangeA },
        ].map(({ lbl, val, max, ph, fn }, i) => (
          <React.Fragment key={lbl}>
            {i > 0 && <Text className="text-muted-foreground mb-2">/</Text>}
            <View className="items-center gap-0.5">
              <Text className="text-xs text-muted-foreground">{lbl}</Text>
              <TextInput
                className="bg-muted rounded-xl text-center text-base font-semibold text-foreground"
                style={{ width: max === 4 ? 72 : 52, height: 40 }}
                value={val}
                onChangeText={(t) => fn(t.replace(/\D/g, '').slice(0, max))}
                keyboardType="number-pad"
                placeholder={ph}
                placeholderTextColor="#94A3B8"
                maxLength={max}
              />
            </View>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

function ExperienciaRow({
  item, onUpdate, onDelete,
}: {
  item: ExperienciaInput;
  onUpdate: (patch: Partial<ExperienciaInput>) => void;
  onDelete: () => void;
}) {
  return (
    <View className="bg-card rounded-2xl p-4 gap-3 border border-border">
      <View className="flex-row justify-between items-center">
        <Text className="text-sm font-semibold text-foreground">Experiencia</Text>
        <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="trash-outline" size={18} color="#EF4444" />
        </TouchableOpacity>
      </View>
      <Input
        placeholder="Empresa *"
        value={item.empresa_nombre}
        onChangeText={(t) => onUpdate({ empresa_nombre: t })}
        autoCapitalize="words"
      />
      <Input
        placeholder="Cargo desempeñado *"
        value={item.cargo}
        onChangeText={(t) => onUpdate({ cargo: t })}
        autoCapitalize="sentences"
      />
      <View className="flex-row gap-4">
        <View className="flex-1">
          <MonthYearInput
            label="Desde *"
            m={item.inicio_m}
            a={item.inicio_a}
            onChangeM={(v) => onUpdate({ inicio_m: v })}
            onChangeA={(v) => onUpdate({ inicio_a: v })}
          />
        </View>
        <View className="flex-1">
          <MonthYearInput
            label="Hasta (vacío = actual)"
            m={item.fin_m}
            a={item.fin_a}
            onChangeM={(v) => onUpdate({ fin_m: v })}
            onChangeA={(v) => onUpdate({ fin_a: v })}
          />
        </View>
      </View>
    </View>
  );
}

function DiplomaRow({
  item, onUpdate, onDelete,
}: {
  item: DiplomaInput;
  onUpdate: (patch: Partial<DiplomaInput>) => void;
  onDelete: () => void;
}) {
  return (
    <View className="bg-card rounded-2xl p-4 gap-3 border border-border">
      <View className="flex-row justify-between items-center">
        <Text className="text-sm font-semibold text-foreground">Diploma / Certificado</Text>
        <TouchableOpacity onPress={onDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="trash-outline" size={18} color="#EF4444" />
        </TouchableOpacity>
      </View>
      <Input
        placeholder="Título obtenido *"
        value={item.titulo}
        onChangeText={(t) => onUpdate({ titulo: t })}
        autoCapitalize="sentences"
      />
      <Input
        placeholder="Institución *"
        value={item.institucion}
        onChangeText={(t) => onUpdate({ institucion: t })}
        autoCapitalize="words"
      />
      <Input
        placeholder="Año de grado"
        value={item.anio}
        onChangeText={(t) => onUpdate({ anio: t.replace(/\D/g, '').slice(0, 4) })}
        keyboardType="numeric"
      />
    </View>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

type Props = {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  onBack: () => void;
  onNext: () => void;
};

export function Step3Documentos({ data, onChange, onBack, onNext }: Props) {
  const { data: cargos, isLoading: cargosLoading } = useCargos();
  const crearCargo = useCrearCargo();
  const [nuevoCargoModal, setNuevoCargoModal] = useState(false);
  const [nuevoCargoNombre, setNuevoCargoNombre] = useState('');

  const handleNext = () => {
    const err = validateStep3(data);
    if (err) { Alert.alert('Datos incompletos', err); return; }
    onNext();
  };

  const addExperiencia = () =>
    onChange({
      experiencias: [
        ...data.experiencias,
        { _id: uid(), empresa_nombre: '', cargo: '', inicio_m: '', inicio_a: '', fin_m: '', fin_a: '' },
      ],
    });

  const updateExperiencia = (id: string, patch: Partial<ExperienciaInput>) =>
    onChange({
      experiencias: data.experiencias.map((e) => (e._id === id ? { ...e, ...patch } : e)),
    });

  const removeExperiencia = (id: string) =>
    onChange({ experiencias: data.experiencias.filter((e) => e._id !== id) });

  const addDiploma = () =>
    onChange({
      diplomas: [
        ...data.diplomas,
        { _id: uid(), titulo: '', institucion: '', anio: '' },
      ],
    });

  const updateDiploma = (id: string, patch: Partial<DiplomaInput>) =>
    onChange({
      diplomas: data.diplomas.map((d) => (d._id === id ? { ...d, ...patch } : d)),
    });

  const removeDiploma = (id: string) =>
    onChange({ diplomas: data.diplomas.filter((d) => d._id !== id) });

  const toggleCargo = (id: number) =>
    onChange({
      cargo_ids: data.cargo_ids.includes(id)
        ? data.cargo_ids.filter((c) => c !== id)
        : [...data.cargo_ids, id],
    });

  const handleCrearCargo = async () => {
    const nombre = nuevoCargoNombre.trim();
    if (!nombre) return;
    try {
      const cargo = await crearCargo.mutateAsync({ nombre });
      onChange({ cargo_ids: [...data.cargo_ids, cargo.id] });
      setNuevoCargoNombre('');
      setNuevoCargoModal(false);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'No se pudo crear el cargo.';
      Alert.alert('Error', msg);
    }
  };

  return (
    <>
    <ScrollView
      contentContainerClassName="px-5 py-4 gap-5 pb-10"
      keyboardShouldPersistTaps="handled"
    >
      {/* Antecedentes */}
      <SectionDivider label="VERIFICACIÓN DE ANTECEDENTES" />
      <Text className="text-xs text-muted-foreground -mt-2">
        Fecha de expedición del certificado (opcional). Dejar en blanco si aún no se ha obtenido.
      </Text>

      <View className="gap-3">
        <DateSegInput
          label="Antecedentes judiciales — fecha expedición"
          d={data.antj_d} m={data.antj_m} a={data.antj_a}
          onChangeD={(v) => onChange({ antj_d: v })}
          onChangeM={(v) => onChange({ antj_m: v })}
          onChangeA={(v) => onChange({ antj_a: v })}
        />
        <DateSegInput
          label="Antecedentes disciplinarios — fecha expedición"
          d={data.antd_d} m={data.antd_m} a={data.antd_a}
          onChangeD={(v) => onChange({ antd_d: v })}
          onChangeM={(v) => onChange({ antd_m: v })}
          onChangeA={(v) => onChange({ antd_a: v })}
        />
      </View>

      {/* Experiencia laboral */}
      <View className="flex-row items-center justify-between">
        <SectionDivider label="EXPERIENCIA LABORAL" />
        <TouchableOpacity
          onPress={addExperiencia}
          className="flex-row items-center gap-1 px-3 py-1.5 bg-primary-50 rounded-xl"
        >
          <Ionicons name="add" size={16} color="#FF5A3C" />
          <Text className="text-sm font-semibold text-primary-500">Añadir</Text>
        </TouchableOpacity>
      </View>

      {data.experiencias.length === 0 && (
        <Text className="text-sm text-muted-foreground text-center py-2">
          Sin experiencias registradas
        </Text>
      )}
      {data.experiencias.map((e) => (
        <ExperienciaRow
          key={e._id}
          item={e}
          onUpdate={(patch) => updateExperiencia(e._id, patch)}
          onDelete={() => removeExperiencia(e._id)}
        />
      ))}

      {/* Formación académica */}
      <View className="flex-row items-center justify-between">
        <SectionDivider label="FORMACIÓN ACADÉMICA" />
        <TouchableOpacity
          onPress={addDiploma}
          className="flex-row items-center gap-1 px-3 py-1.5 bg-primary-50 rounded-xl"
        >
          <Ionicons name="add" size={16} color="#FF5A3C" />
          <Text className="text-sm font-semibold text-primary-500">Añadir</Text>
        </TouchableOpacity>
      </View>

      {data.diplomas.length === 0 && (
        <Text className="text-sm text-muted-foreground text-center py-2">
          Sin diplomas registrados
        </Text>
      )}
      {data.diplomas.map((d) => (
        <DiplomaRow
          key={d._id}
          item={d}
          onUpdate={(patch) => updateDiploma(d._id, patch)}
          onDelete={() => removeDiploma(d._id)}
        />
      ))}

      {/* Cargos certificados */}
      <View className="flex-row items-center justify-between">
        <SectionDivider label="CARGOS CERTIFICADOS" />
        <TouchableOpacity
          onPress={() => setNuevoCargoModal(true)}
          className="flex-row items-center gap-1 px-3 py-1.5 bg-primary-50 rounded-xl"
        >
          <Ionicons name="add" size={16} color="#FF5A3C" />
          <Text className="text-sm font-semibold text-primary-500">Crear cargo</Text>
        </TouchableOpacity>
      </View>
      <Text className="text-xs text-muted-foreground -mt-2">
        Selecciona los cargos del catálogo para los que este trabajador está habilitado.
      </Text>

      {cargosLoading ? (
        <ActivityIndicator size="small" color="#FF5A3C" />
      ) : (
        <View className="flex-row flex-wrap gap-2">
          {(cargos ?? []).filter((c) => c.activo).map((c) => {
            const selected = data.cargo_ids.includes(c.id);
            return (
              <Pressable
                key={c.id}
                onPress={() => toggleCargo(c.id)}
                className={`flex-row items-center gap-1.5 px-3 py-2 rounded-xl border ${
                  selected ? 'bg-primary-500 border-primary-500' : 'bg-card border-border'
                }`}
              >
                {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
                <Text className={`text-sm font-medium ${selected ? 'text-white' : 'text-foreground'}`}>
                  {c.nombre}
                </Text>
              </Pressable>
            );
          })}
          {(cargos ?? []).filter((c) => c.activo).length === 0 && (
            <Text className="text-sm text-muted-foreground">No hay cargos en el catálogo</Text>
          )}
        </View>
      )}

      {/* Navigation */}
      <View className="flex-row gap-3 mt-2">
        <View className="flex-1">
          <Button label="← Atrás" variant="secondary" size="lg" fullWidth onPress={onBack} />
        </View>
        <View className="flex-1">
          <Button label="Siguiente →" variant="primary" size="lg" fullWidth onPress={handleNext} />
        </View>
      </View>
    </ScrollView>

    {/* ── Modal: crear cargo rápido ──────────────────────────────────── */}
    <Modal
      visible={nuevoCargoModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setNuevoCargoModal(false)}
    >
      <View className="flex-1 bg-background px-6 pt-8">
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-lg font-bold text-foreground">Nuevo cargo</Text>
          <Pressable onPress={() => setNuevoCargoModal(false)} hitSlop={8}>
            <Ionicons name="close" size={24} color="#64748B" />
          </Pressable>
        </View>
        <Input
          label="Nombre *"
          placeholder="Ej. Auxiliar de bodega"
          value={nuevoCargoNombre}
          onChangeText={setNuevoCargoNombre}
          autoCapitalize="sentences"
          autoFocus
        />
        <View className="mt-6">
          <Button
            label={crearCargo.isPending ? 'Creando…' : 'Crear y seleccionar'}
            variant="primary"
            size="lg"
            fullWidth
            loading={crearCargo.isPending}
            disabled={!nuevoCargoNombre.trim()}
            onPress={handleCrearCargo}
          />
        </View>
      </View>
    </Modal>
    </>
  );
}
