/**
 * Mi perfil laboral — trabajador_turnos
 *
 * Permite al trabajador ver y actualizar sus datos laborales:
 * identificación, información personal, seguridad social,
 * datos bancarios y contacto de emergencia.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  usePerfilLaboral,
  useUpdatePerfilLaboral,
} from '@/features/equipo/perfil/usePerfilLaboral';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { InfoRow }        from '@/components/ui/InfoRow';
import type { Trabajador, TipoDocumento, SexoTrabajador, TipoCuenta } from '@api-client';

// ── Helpers ───────────────────────────────────────────────────────────────

function fmtFecha(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Subcomponents ─────────────────────────────────────────────────────────

function PillRow<T extends string>({
  label,
  options,
  value,
  onChange,
  labels,
}: {
  label: string;
  options: T[];
  value: T | null | undefined;
  onChange: (v: T) => void;
  labels: Record<T, string>;
}) {
  return (
    <View className="px-5 py-3 border-b border-border bg-card">
      <Text className="text-xs text-muted-foreground mb-2">{label}</Text>
      <View className="flex-row gap-2 flex-wrap">
        {options.map((opt) => (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            className={`rounded-full px-3 py-1.5 border ${
              value === opt
                ? 'bg-primary-500 border-primary-500'
                : 'bg-background border-border'
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                value === opt ? 'text-white' : 'text-muted-foreground'
              }`}
            >
              {labels[opt]}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function FieldInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  last = false,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
  last?: boolean;
}) {
  return (
    <View
      className={`px-5 py-3 bg-card ${!last ? 'border-b border-border' : ''}`}
    >
      <Text className="text-xs text-muted-foreground mb-1">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor="#94A3B8"
        keyboardType={keyboardType ?? 'default'}
        className="text-sm text-foreground"
        autoCorrect={false}
        autoCapitalize="none"
      />
    </View>
  );
}

// ── Edit Form ─────────────────────────────────────────────────────────────

interface FormState {
  tipo_documento: TipoDocumento;
  cedula: string;
  fecha_nacimiento: string;
  sexo: SexoTrabajador | '';
  telefono: string;
  eps: string;
  afp: string;
  banco: string;
  tipo_cuenta: TipoCuenta | '';
  numero_cuenta: string;
  contacto_emergencia_nombre: string;
  contacto_emergencia_tel: string;
  ant_judiciales_fecha: string;
  ant_disciplinarios_fecha: string;
}

function buildForm(t: Trabajador | undefined): FormState {
  return {
    tipo_documento:              (t?.tipo_documento ?? 'CC') as TipoDocumento,
    cedula:                      t?.cedula ?? '',
    fecha_nacimiento:            t?.fecha_nacimiento?.slice(0, 10) ?? '',
    sexo:                        t?.sexo ?? '',
    telefono:                    t?.telefono ?? '',
    eps:                         t?.eps ?? '',
    afp:                         t?.afp ?? '',
    banco:                       t?.banco ?? '',
    tipo_cuenta:                 t?.tipo_cuenta ?? '',
    numero_cuenta:               t?.numero_cuenta ?? '',
    contacto_emergencia_nombre:  t?.contacto_emergencia_nombre ?? '',
    contacto_emergencia_tel:     t?.contacto_emergencia_tel ?? '',
    ant_judiciales_fecha:        t?.ant_judiciales_fecha?.slice(0, 10) ?? '',
    ant_disciplinarios_fecha:    t?.ant_disciplinarios_fecha?.slice(0, 10) ?? '',
  };
}

// ── Screen ────────────────────────────────────────────────────────────────

export default function MiPerfilLaboralScreen() {
  const { data: perfil, isLoading } = usePerfilLaboral();
  const update = useUpdatePerfilLaboral();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(() => buildForm(undefined));

  useEffect(() => {
    if (perfil) setForm(buildForm(perfil));
  }, [perfil]);

  const set = <K extends keyof FormState>(key: K) =>
    (val: FormState[K]) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    try {
      await update.mutateAsync({
        tipo_documento:             form.tipo_documento || undefined,
        cedula:                     form.cedula || undefined,
        fecha_nacimiento:           form.fecha_nacimiento || undefined,
        sexo:                       (form.sexo as SexoTrabajador) || undefined,
        telefono:                   form.telefono || undefined,
        eps:                        form.eps || undefined,
        afp:                        form.afp || undefined,
        banco:                      form.banco || undefined,
        tipo_cuenta:                (form.tipo_cuenta as TipoCuenta) || undefined,
        numero_cuenta:              form.numero_cuenta || undefined,
        contacto_emergencia_nombre: form.contacto_emergencia_nombre || undefined,
        contacto_emergencia_tel:    form.contacto_emergencia_tel || undefined,
        ant_judiciales_fecha:       form.ant_judiciales_fecha || undefined,
        ant_disciplinarios_fecha:   form.ant_disciplinarios_fecha || undefined,
      });
      setEditing(false);
      Alert.alert('', 'Perfil actualizado correctamente');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Error al guardar';
      Alert.alert('Error', msg);
    }
  };

  const handleCancel = () => {
    if (perfil) setForm(buildForm(perfil));
    setEditing(false);
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['bottom']}>
        <Stack.Screen options={{ title: 'Perfil laboral', headerShown: true }} />
        <ActivityIndicator color="#FF5A3C" />
      </SafeAreaView>
    );
  }

  if (!perfil) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-8" edges={['bottom']}>
        <Stack.Screen options={{ title: 'Perfil laboral', headerShown: true }} />
        <Ionicons name="person-outline" size={48} color="#94A3B8" />
        <Text className="text-base font-semibold text-foreground mt-4 text-center">
          Perfil no encontrado
        </Text>
        <Text className="text-sm text-muted-foreground text-center mt-1">
          Tu perfil laboral aún no ha sido creado por la empresa.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Perfil laboral', headerShown: true }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Identificación ─────────────────────────────────────── */}
          <SectionHeader title="Identificación" />
          <View className="mx-5 rounded-2xl border border-border overflow-hidden">
            {editing ? (
              <>
                <PillRow
                  label="Tipo de documento"
                  options={['CC', 'CE', 'PAS'] as TipoDocumento[]}
                  value={form.tipo_documento}
                  onChange={set('tipo_documento')}
                  labels={{ CC: 'Cédula (CC)', CE: 'Cédula Ext. (CE)', PAS: 'Pasaporte' }}
                />
                <FieldInput
                  label="Número de documento"
                  value={form.cedula}
                  onChangeText={set('cedula')}
                  keyboardType="numeric"
                  last
                />
              </>
            ) : (
              <>
                <InfoRow
                  label="Tipo doc."
                  value={{ CC: 'Cédula (CC)', CE: 'Cédula Ext. (CE)', PAS: 'Pasaporte' }[perfil.tipo_documento ?? 'CC']}
                />
                <InfoRow label="Documento" value={perfil.cedula} last />
              </>
            )}
          </View>

          {/* ── Información personal ────────────────────────────────── */}
          <SectionHeader title="Información personal" />
          <View className="mx-5 rounded-2xl border border-border overflow-hidden">
            {editing ? (
              <>
                <FieldInput
                  label="Fecha de nacimiento (AAAA-MM-DD)"
                  value={form.fecha_nacimiento}
                  onChangeText={set('fecha_nacimiento')}
                  placeholder="1990-01-15"
                />
                <PillRow
                  label="Sexo"
                  options={['M', 'F', 'otro'] as SexoTrabajador[]}
                  value={form.sexo as SexoTrabajador}
                  onChange={set('sexo')}
                  labels={{ M: 'Masculino', F: 'Femenino', otro: 'Otro' }}
                />
                <FieldInput
                  label="Teléfono"
                  value={form.telefono}
                  onChangeText={set('telefono')}
                  keyboardType="phone-pad"
                  last
                />
              </>
            ) : (
              <>
                <InfoRow label="Nacimiento" value={fmtFecha(perfil.fecha_nacimiento)} />
                <InfoRow
                  label="Sexo"
                  value={
                    perfil.sexo
                      ? ({ M: 'Masculino', F: 'Femenino', otro: 'Otro' } as Record<string, string>)[perfil.sexo]
                      : null
                  }
                />
                <InfoRow label="Teléfono" value={perfil.telefono} last />
              </>
            )}
          </View>

          {/* ── Seguridad social ────────────────────────────────────── */}
          <SectionHeader title="Seguridad social" />
          <View className="mx-5 rounded-2xl border border-border overflow-hidden">
            {editing ? (
              <>
                <FieldInput label="EPS" value={form.eps} onChangeText={set('eps')} />
                <FieldInput label="AFP / Fondo de pensión" value={form.afp} onChangeText={set('afp')} last />
              </>
            ) : (
              <>
                <InfoRow label="EPS" value={perfil.eps} />
                <InfoRow label="AFP" value={perfil.afp} last />
              </>
            )}
          </View>

          {/* ── Datos bancarios ─────────────────────────────────────── */}
          <SectionHeader title="Datos bancarios" />
          <View className="mx-5 rounded-2xl border border-border overflow-hidden">
            {editing ? (
              <>
                <FieldInput label="Banco" value={form.banco} onChangeText={set('banco')} />
                <PillRow
                  label="Tipo de cuenta"
                  options={['ahorros', 'corriente'] as TipoCuenta[]}
                  value={form.tipo_cuenta as TipoCuenta}
                  onChange={set('tipo_cuenta')}
                  labels={{ ahorros: 'Ahorros', corriente: 'Corriente' }}
                />
                <FieldInput
                  label="Número de cuenta"
                  value={form.numero_cuenta}
                  onChangeText={set('numero_cuenta')}
                  keyboardType="numeric"
                  last
                />
              </>
            ) : (
              <>
                <InfoRow label="Banco" value={perfil.banco} />
                <InfoRow
                  label="Tipo"
                  value={perfil.tipo_cuenta
                    ? perfil.tipo_cuenta.charAt(0).toUpperCase() + perfil.tipo_cuenta.slice(1)
                    : null}
                />
                <InfoRow label="Cuenta" value={perfil.numero_cuenta} last />
              </>
            )}
          </View>

          {/* ── Contacto de emergencia ──────────────────────────────── */}
          <SectionHeader title="Contacto de emergencia" />
          <View className="mx-5 rounded-2xl border border-border overflow-hidden">
            {editing ? (
              <>
                <FieldInput
                  label="Nombre"
                  value={form.contacto_emergencia_nombre}
                  onChangeText={set('contacto_emergencia_nombre')}
                />
                <FieldInput
                  label="Teléfono"
                  value={form.contacto_emergencia_tel}
                  onChangeText={set('contacto_emergencia_tel')}
                  keyboardType="phone-pad"
                  last
                />
              </>
            ) : (
              <>
                <InfoRow label="Nombre" value={perfil.contacto_emergencia_nombre} />
                <InfoRow label="Teléfono" value={perfil.contacto_emergencia_tel} last />
              </>
            )}
          </View>

          {/* ── Antecedentes ─────────────────────────────────────────── */}
          <SectionHeader title="Certificados de antecedentes" />
          <View className="mx-5 rounded-2xl border border-border overflow-hidden">
            {editing ? (
              <>
                <FieldInput
                  label="Antecedentes judiciales (AAAA-MM-DD)"
                  value={form.ant_judiciales_fecha}
                  onChangeText={set('ant_judiciales_fecha')}
                  placeholder="2024-01-15"
                />
                <FieldInput
                  label="Antecedentes disciplinarios (AAAA-MM-DD)"
                  value={form.ant_disciplinarios_fecha}
                  onChangeText={set('ant_disciplinarios_fecha')}
                  placeholder="2024-01-15"
                  last
                />
              </>
            ) : (
              <>
                <InfoRow label="Judiciales" value={fmtFecha(perfil.ant_judiciales_fecha)} />
                <InfoRow label="Disciplinarios" value={fmtFecha(perfil.ant_disciplinarios_fecha)} last />
              </>
            )}
          </View>

          {/* ── Acciones ─────────────────────────────────────────────── */}
          <View className="mx-5 mt-6 gap-3">
            {editing ? (
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={handleCancel}
                  className="flex-1 h-12 rounded-2xl border border-border items-center justify-center active:opacity-70"
                >
                  <Text className="text-sm font-semibold text-muted-foreground">Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={update.isPending}
                  className="flex-1 h-12 rounded-2xl bg-primary-500 items-center justify-center active:opacity-80 disabled:opacity-50"
                >
                  {update.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-sm font-semibold text-white">Guardar cambios</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => setEditing(true)}
                className="h-12 rounded-2xl border border-primary-500 items-center justify-center flex-row gap-2 active:opacity-70"
              >
                <Ionicons name="pencil-outline" size={16} color="#FF5A3C" />
                <Text className="text-sm font-semibold text-primary-500">Editar perfil laboral</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
