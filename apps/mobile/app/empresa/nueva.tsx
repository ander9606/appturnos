/**
 * Crear nueva empresa — panel super_admin.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useCrearEmpresa } from '@/features/admin/useAdmin';
import type { PlanEmpresa } from '@api-client';

// ── Constants ─────────────────────────────────────────────────────────────

const PLANES: { value: PlanEmpresa; label: string; color: string; desc: string }[] = [
  { value: 'basico', label: 'Básico', color: '#94A3B8', desc: 'Para equipos pequeños' },
  { value: 'profesional', label: 'Profesional', color: '#3B82F6', desc: 'Más funcionalidades' },
  { value: 'empresarial', label: 'Empresarial', color: '#8B5CF6', desc: 'Sin límites' },
];

// ── Helper: auto-generar slug desde nombre ────────────────────────────────

function generarSlug(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quitar tildes
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ── Sub-components ────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  required,
  keyboardType,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  keyboardType?: 'default' | 'url' | 'email-address';
  hint?: string;
}) {
  return (
    <View className="gap-1">
      <View className="flex-row items-center gap-1">
        <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {label}
        </Text>
        {required && <Text className="text-danger text-xs">*</Text>}
      </View>
      <TextInput
        className="bg-background border border-border rounded-xl px-3 h-11 text-sm text-foreground"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        keyboardType={keyboardType}
        autoCapitalize="none"
      />
      {hint && <Text className="text-xs text-muted-foreground">{hint}</Text>}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────

export default function NuevaEmpresaScreen() {
  const router = useRouter();
  const { mutateAsync: crear, isPending } = useCrearEmpresa();

  const [nombre, setNombre] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [nit, setNit] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [plan, setPlan] = useState<PlanEmpresa>('basico');
  const [descripcion, setDescripcion] = useState('');
  const [adminNombre, setAdminNombre] = useState('');
  const [adminEmail, setAdminEmail] = useState('');

  const handleNombreChange = (v: string) => {
    setNombre(v);
    if (!slugManual) {
      setSlug(generarSlug(v));
    }
  };

  const handleSlugChange = (v: string) => {
    setSlugManual(true);
    setSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, ''));
  };

  const handleCrear = async () => {
    if (!nombre.trim()) {
      Alert.alert('Requerido', 'El nombre de la empresa es obligatorio.');
      return;
    }
    if (!slug.trim()) {
      Alert.alert('Requerido', 'El slug es obligatorio.');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      Alert.alert('Slug inválido', 'Solo letras minúsculas, números y guiones.');
      return;
    }
    if (adminNombre.trim() && !adminEmail.trim()) {
      Alert.alert('Falta el email', 'Si indicas un nombre de administrador, el email es obligatorio.');
      return;
    }
    if (adminEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail.trim())) {
      Alert.alert('Email inválido', 'Revisa el email del administrador.');
      return;
    }

    try {
      const nueva = await crear({
        nombre: nombre.trim(),
        slug: slug.trim(),
        nit: nit.trim() || null,
        ciudad: ciudad.trim() || null,
        plan,
        descripcion: descripcion.trim() || null,
        admin_nombre: adminNombre.trim() || undefined,
        admin_email: adminEmail.trim() || undefined,
      });
      const credencialesMsg = !nueva.admin_creado
        ? ''
        : nueva.credenciales_email_enviado
        ? `\n\nSe enviaron las credenciales de acceso a ${adminEmail.trim()}.`
        : `\n\n⚠️ El administrador se creó pero no se pudo enviar el correo con las credenciales. Usa "Olvidé mi contraseña" con ${adminEmail.trim()} para generarlas de nuevo.`;
      Alert.alert('✅', `Empresa "${nueva.nombre}" creada correctamente.${credencialesMsg}`, [
        {
          text: 'Ver detalle',
          onPress: () => router.replace(`/empresa/${nueva.id}`),
        },
        {
          text: 'Volver a lista',
          onPress: () => router.replace('/(admin)/empresas'),
        },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear la empresa';
      Alert.alert('Error', msg);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <View
        className="px-4 pt-3 pb-5 flex-row items-center gap-3"
        style={{ backgroundColor: '#6366F1' }}
      >
        <Pressable onPress={() => router.back()}>
          <Text className="text-white text-base">←</Text>
        </Pressable>
        <View className="flex-1">
          <Text className="text-white text-lg font-bold">Nueva empresa</Text>
          <Text className="text-white/70 text-xs">Crear tenant en el sistema</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Datos básicos ──────────────────────────────────────────── */}
        <View className="bg-card border border-border rounded-2xl p-4 gap-4">
          <Text className="text-sm font-bold text-foreground">Datos básicos</Text>

          <Field
            label="Nombre"
            value={nombre}
            onChangeText={handleNombreChange}
            placeholder="ej. Servicios Logísticos S.A.S"
            required
          />

          <View className="gap-1">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-1">
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Slug
                </Text>
                <Text className="text-danger text-xs">*</Text>
              </View>
              {slugManual && (
                <Pressable
                  onPress={() => {
                    setSlugManual(false);
                    setSlug(generarSlug(nombre));
                  }}
                >
                  <Text className="text-xs text-primary">Auto-generar</Text>
                </Pressable>
              )}
            </View>
            <TextInput
              className="bg-background border border-border rounded-xl px-3 h-11 text-sm text-foreground"
              value={slug}
              onChangeText={handleSlugChange}
              placeholder="ej. servicios-logisticos"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
            />
            <Text className="text-xs text-muted-foreground">
              Solo letras minúsculas, números y guiones. Único e inmutable.
            </Text>
          </View>

          <Field
            label="NIT"
            value={nit}
            onChangeText={setNit}
            placeholder="ej. 900123456-1"
          />
          <Field
            label="Ciudad"
            value={ciudad}
            onChangeText={setCiudad}
            placeholder="ej. Medellín"
          />
          <Field
            label="Descripción"
            value={descripcion}
            onChangeText={setDescripcion}
            placeholder="Breve descripción de la empresa"
          />
        </View>

        {/* ── Plan ───────────────────────────────────────────────────── */}
        <View className="bg-card border border-border rounded-2xl p-4 gap-3">
          <Text className="text-sm font-bold text-foreground">Plan</Text>
          {PLANES.map((p) => (
            <Pressable
              key={p.value}
              onPress={() => setPlan(p.value)}
              className="flex-row items-center gap-3 p-3 rounded-xl border"
              style={{
                borderColor: plan === p.value ? p.color : '#E2E8F0',
                backgroundColor: plan === p.value ? p.color + '15' : 'transparent',
              }}
            >
              <View
                className="w-4 h-4 rounded-full border-2"
                style={{
                  borderColor: p.color,
                  backgroundColor: plan === p.value ? p.color : 'transparent',
                }}
              />
              <View className="flex-1">
                <Text
                  className="text-sm font-semibold"
                  style={{ color: plan === p.value ? p.color : '#1E293B' }}
                >
                  {p.label}
                </Text>
                <Text className="text-xs text-muted-foreground">{p.desc}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* ── Admin de la empresa ───────────────────────────────────── */}
        <View className="bg-card border border-border rounded-2xl p-4 gap-4">
          <View className="gap-1">
            <Text className="text-sm font-bold text-foreground">Administrador de la empresa</Text>
            <Text className="text-xs text-muted-foreground">
              Opcional. Si lo completas, se crea su cuenta y le enviamos las credenciales por correo.
            </Text>
          </View>

          <Field
            label="Nombre"
            value={adminNombre}
            onChangeText={setAdminNombre}
            placeholder="ej. María Gómez"
          />
          <Field
            label="Email"
            value={adminEmail}
            onChangeText={setAdminEmail}
            placeholder="ej. maria@empresa.com"
            keyboardType="email-address"
          />
        </View>

        {/* ── Botón crear ────────────────────────────────────────────── */}
        <Pressable
          onPress={handleCrear}
          disabled={isPending}
          className="h-12 rounded-xl items-center justify-center active:opacity-80"
          style={{ backgroundColor: '#6366F1' }}
        >
          {isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text className="text-white text-base font-bold">Crear empresa</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
