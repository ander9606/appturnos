/**
 * Mi perfil laboral — trabajador_turnos
 *
 * Permite al trabajador ver y actualizar sus datos laborales:
 * identificación, información personal, seguridad social,
 * datos bancarios y contacto de emergencia.
 */
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { showAlert } from '@/lib/alertDialog';
import { Spinner } from '@/components/ui/Spinner';
import { COLORS } from '@/lib/designTokens';
import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { usePerfilLaboral, useUpdatePerfilLaboral } from '@/features/equipo/perfil/usePerfilLaboral';
import type { SexoTrabajador, TipoCuenta } from '@api-client';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { showToast } from '@/lib/toast';
import { isValidISODate } from '@/lib/dateValidation';
import { bogotaToday } from '@/lib/formatters';
import { type FormState, buildForm } from '@/features/equipo/perfil/perfilForm';
import {
  IdentificacionSection, PersonalSection, SobreMiSection, SeguridadSocialSection,
  BancariosSection, EmergenciaSection, AntecedentesSection,
} from '@/features/equipo/perfil/SeccionesDatos';
import { ExperienciaSection, DiplomasSection, CargosSection } from '@/features/equipo/perfil/SeccionesMarketplace';

// ── Screen ────────────────────────────────────────────────────────────────

export default function MiPerfilLaboralScreen() {
  const rol      = useAuthStore((s) => s.usuario?.rol);
  const isNomina = rol === 'trabajador_nomina';

  const { data: perfil, isLoading } = usePerfilLaboral();
  const update       = useUpdatePerfilLaboral();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(() => buildForm(undefined));

  useEffect(() => {
    if (perfil) setForm(buildForm(perfil));
  }, [perfil]);

  const set = <K extends keyof FormState>(key: K) =>
    (val: FormState[K]) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    const fechas: [string, string][] = [
      [form.fecha_nacimiento, 'Fecha de nacimiento'],
      [form.ant_judiciales_fecha, 'Fecha de antecedentes judiciales'],
      [form.ant_disciplinarios_fecha, 'Fecha de antecedentes disciplinarios'],
    ];
    for (const [valor, label] of fechas) {
      if (valor && (!isValidISODate(valor) || valor > bogotaToday())) {
        showAlert('Fecha inválida', `${label} debe tener formato AAAA-MM-DD y no puede ser futura.`, 'warning');
        return;
      }
    }
    try {
      await update.mutateAsync({
        tipo_documento:             form.tipo_documento || undefined,
        cedula:                     form.cedula || undefined,
        fecha_nacimiento:           form.fecha_nacimiento || undefined,
        sexo:                       (form.sexo as SexoTrabajador) || undefined,
        telefono:                   form.telefono || undefined,
        descripcion:                form.descripcion || undefined,
        direccion:                  form.direccion || undefined,
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
      showToast('Perfil actualizado correctamente.');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Error al guardar';
      showAlert('Error', msg);
    }
  };

  const handleCancel = () => {
    if (perfil) setForm(buildForm(perfil));
    setEditing(false);
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <Stack.Screen options={{ title: 'Perfil laboral', headerShown: true }} />
        <SkeletonDetail style={{ paddingHorizontal: 16, paddingTop: 12 }} />
      </SafeAreaView>
    );
  }

  if (!perfil) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-8" edges={['bottom']}>
        <Stack.Screen options={{ title: 'Perfil laboral', headerShown: true }} />
        <Ionicons name="person-outline" size={48} color={COLORS.placeholder} />
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
          <IdentificacionSection editing={editing} perfil={perfil} form={form} set={set} />

          {/* ── Información personal ────────────────────────────────── */}
          <PersonalSection editing={editing} perfil={perfil} form={form} set={set} />

          {/* ── Sobre mí ────────────────────────────────────────────── */}
          <SobreMiSection editing={editing} perfil={perfil} form={form} set={set} />

          {/* ── Seguridad social ────────────────────────────────────── */}
          <SeguridadSocialSection editing={editing} perfil={perfil} form={form} set={set} />

          {/* ── Datos bancarios ─────────────────────────────────────── */}
          <BancariosSection editing={editing} perfil={perfil} form={form} set={set} />

          {/* ── Contacto de emergencia ──────────────────────────────── */}
          <EmergenciaSection editing={editing} perfil={perfil} form={form} set={set} />

          {/* ── Antecedentes ─────────────────────────────────────────── */}
          <AntecedentesSection editing={editing} perfil={perfil} form={form} set={set} />

          {/* ── Experiencia / Diplomas / Cargos (solo marketplace) ───── */}
          {!isNomina && (
          <>
          <ExperienciaSection experiencias={perfil.experiencias} />

          <DiplomasSection diplomas={perfil.diplomas} />

          <CargosSection cargos={perfil.cargos} />
          </>)}

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
                    <Spinner size="small" color={COLORS.white} />
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
                <Ionicons name="pencil-outline" size={16} color={COLORS.primary} />
                <Text className="text-sm font-semibold text-primary-500">Editar perfil laboral</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
