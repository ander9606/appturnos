/**
 * Perfil — Tab "Perfil"
 *
 * Permite al usuario:
 * - Ver y editar sus datos personales (nombre, apellido, email)
 * - Cambiar su contraseña
 * - Cerrar sesión
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { useRouter } from 'expo-router';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { authApi } from '@api-client';
import { t } from '@/lib/i18n';
import type { ApiError } from '@api-client';
import { useTheme } from '@/lib/theme';

// ── Helpers ───────────────────────────────────────────────────────────────

const ROL_LABELS: Record<string, string> = {
  admin_empresa:       'Administrador',
  jefe_turnos:         'Jefe de Turnos',
  jefe_nomina:         'Jefe de Nómina',
  nomina:              'Nómina',
  trabajador_turnos:   'Trabajador de Turnos',
  trabajador_nomina:   'Trabajador de Nómina',
  super_admin:         'Super Admin',
};

function getInitials(nombre?: string, apellido?: string): string {
  const n = (nombre?.[0] ?? '').toUpperCase();
  const a = (apellido?.[0] ?? '').toUpperCase();
  return n + a || '?';
}

// ── Sub-components ────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-5 mb-2 mt-6">
      {title}
    </Text>
  );
}

function CardRow({
  label,
  value,
  onPress,
  last = false,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center justify-between px-5 py-4 bg-card ${!last ? 'border-b border-border' : ''} ${onPress ? 'active:opacity-70' : ''}`}
    >
      <Text className="text-sm text-muted-foreground w-28">{label}</Text>
      <Text className="text-sm font-medium text-foreground flex-1 text-right" numberOfLines={1}>
        {value}
      </Text>
      {onPress && <Ionicons name="chevron-forward" size={16} color="#94A3B8" style={{ marginLeft: 4 }} />}
    </Pressable>
  );
}

// ── Edit Profile Modal (inline form) ─────────────────────────────────────

function EditProfileForm({
  initialNombre,
  initialApellido,
  initialEmail,
  onSave,
  onCancel,
  loading,
}: {
  initialNombre: string;
  initialApellido: string;
  initialEmail: string;
  onSave: (nombre: string, apellido: string, email: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [nombre, setNombre]     = useState(initialNombre);
  const [apellido, setApellido] = useState(initialApellido);
  const [email, setEmail]       = useState(initialEmail);

  return (
    <View className="bg-card rounded-2xl mx-5 border border-border overflow-hidden">
      <View className="px-5 py-4 border-b border-border">
        <Text className="text-sm font-semibold text-foreground">{t('perfil.infoPersonal')}</Text>
      </View>

      {[
        { label: t('perfil.nombre'),   value: nombre,   setter: setNombre,   key: 'nombre' },
        { label: t('perfil.apellido'), value: apellido, setter: setApellido, key: 'apellido' },
        { label: t('perfil.email'),    value: email,    setter: setEmail,    key: 'email' },
      ].map(({ label, value, setter, key }, i, arr) => (
        <View
          key={key}
          className={`px-5 py-3 ${i < arr.length - 1 ? 'border-b border-border' : ''}`}
        >
          <Text className="text-xs text-muted-foreground mb-1">{label}</Text>
          <TextInput
            value={value}
            onChangeText={setter}
            className="text-sm text-foreground"
            autoCapitalize={key === 'email' ? 'none' : 'words'}
            keyboardType={key === 'email' ? 'email-address' : 'default'}
            autoCorrect={false}
            placeholder={label}
            placeholderTextColor="#94A3B8"
          />
        </View>
      ))}

      <View className="flex-row gap-3 px-5 py-4 border-t border-border">
        <Pressable
          onPress={onCancel}
          className="flex-1 h-11 rounded-xl border border-border items-center justify-center active:opacity-70"
        >
          <Text className="text-sm font-semibold text-muted-foreground">{t('perfil.cancelar')}</Text>
        </Pressable>
        <Pressable
          onPress={() => onSave(nombre.trim(), apellido.trim(), email.trim())}
          disabled={loading}
          className="flex-1 h-11 rounded-xl bg-primary items-center justify-center active:opacity-80 disabled:opacity-50"
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-sm font-semibold text-white">{t('perfil.guardarCambios')}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ── Change Password Form ──────────────────────────────────────────────────

function ChangePasswordForm({
  onSave,
  onCancel,
  loading,
}: {
  onSave: (actual: string, nueva: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [actual, setActual]     = useState('');
  const [nueva, setNueva]       = useState('');
  const [confirmar, setConfirmar] = useState('');

  const handleSave = () => {
    if (nueva.length < 8) {
      Alert.alert('Error', t('perfil.errorPasswordShort'));
      return;
    }
    if (nueva !== confirmar) {
      Alert.alert('Error', t('perfil.errorPasswordMatch'));
      return;
    }
    onSave(actual, nueva);
  };

  return (
    <View className="bg-card rounded-2xl mx-5 border border-border overflow-hidden">
      <View className="px-5 py-4 border-b border-border">
        <Text className="text-sm font-semibold text-foreground">{t('perfil.cambiarPassword')}</Text>
      </View>

      {[
        { label: t('perfil.passwordActual'),  value: actual,    setter: setActual },
        { label: t('perfil.passwordNueva'),   value: nueva,     setter: setNueva },
        { label: t('perfil.passwordConfirm'), value: confirmar, setter: setConfirmar },
      ].map(({ label, value, setter }, i, arr) => (
        <View
          key={label}
          className={`px-5 py-3 ${i < arr.length - 1 ? 'border-b border-border' : ''}`}
        >
          <Text className="text-xs text-muted-foreground mb-1">{label}</Text>
          <TextInput
            value={value}
            onChangeText={setter}
            secureTextEntry
            className="text-sm text-foreground"
            placeholder={t('perfil.passwordMin')}
            placeholderTextColor="#94A3B8"
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>
      ))}

      <View className="flex-row gap-3 px-5 py-4 border-t border-border">
        <Pressable
          onPress={onCancel}
          className="flex-1 h-11 rounded-xl border border-border items-center justify-center active:opacity-70"
        >
          <Text className="text-sm font-semibold text-muted-foreground">{t('perfil.cancelar')}</Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          disabled={loading}
          className="flex-1 h-11 rounded-xl bg-primary items-center justify-center active:opacity-80 disabled:opacity-50"
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-sm font-semibold text-white">{t('perfil.actualizandoPwd')}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────

export default function PerfilScreen() {
  const router         = useRouter();
  const usuario        = useAuthStore((s) => s.usuario);
  const logout         = useAuthStore((s) => s.logout);
  const setUsuario     = useAuthStore((s) => s.setUsuario);
  const theme          = useTheme();
  const isTrabajadorTurnos = usuario?.rol === 'trabajador_turnos';
  const isJefeTurnos       = usuario?.rol === 'jefe_turnos';

  const [editingDatos,    setEditingDatos]    = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [loggingOut,      setLoggingOut]      = useState(false);

  const initials = getInitials(usuario?.nombre, usuario?.apellido);

  // ── Mutations ──────────────────────────────────────────────────────────

  const updateProfileMutation = useMutation({
    mutationFn: (params: { nombre: string; apellido: string; email: string }) =>
      authApi.updateProfile(params),
    onSuccess: (data) => {
      setUsuario(data);
      setEditingDatos(false);
      Alert.alert('', t('perfil.successDatos'));
    },
    onError: (err: ApiError) => {
      Alert.alert('Error', err.message ?? t('common.error'));
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (params: { actual: string; nueva: string }) =>
      authApi.changePassword({ password_actual: params.actual, password_nueva: params.nueva }),
    onSuccess: async () => {
      setEditingPassword(false);
      Alert.alert('', t('perfil.successPassword'));
      await logout();
    },
    onError: (err: ApiError) => {
      Alert.alert('Error', err.message ?? t('common.error'));
    },
  });

  // ── Actions ────────────────────────────────────────────────────────────

  const handleLogout = () => {
    Alert.alert(
      t('perfil.cerrarSesion'),
      '¿Estás seguro de que deseas cerrar sesión?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('perfil.cerrarSesion'),
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            await logout();
          },
        },
      ],
    );
  };

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Header ──────────────────────────────────────────── */}
          <View
            className="pt-4 pb-10 px-6 rounded-b-[32px] items-center gap-3"
            style={{ backgroundColor: theme.primary }}
          >
            <Text className="text-white text-lg font-bold self-start">{t('perfil.title')}</Text>

            {/* Avatar */}
            <View className="w-20 h-20 rounded-full bg-white/30 items-center justify-center mt-2">
              <Text className="text-white text-3xl font-bold">{initials}</Text>
            </View>

            <View className="items-center gap-1">
              <Text className="text-white text-xl font-bold">
                {usuario?.nombre} {usuario?.apellido}
              </Text>
              <Text className="text-white/70 text-sm">{usuario?.email}</Text>
              <View className="bg-white/20 rounded-full px-3 py-1 mt-1">
                <Text className="text-white text-xs font-semibold">
                  {ROL_LABELS[usuario?.rol ?? ''] ?? usuario?.rol}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Información personal ─────────────────────────────── */}
          <SectionHeader title={t('perfil.infoPersonal')} />

          {editingDatos ? (
            <EditProfileForm
              initialNombre={usuario?.nombre ?? ''}
              initialApellido={usuario?.apellido ?? ''}
              initialEmail={usuario?.email ?? ''}
              onSave={(nombre, apellido, email) =>
                updateProfileMutation.mutate({ nombre, apellido, email })
              }
              onCancel={() => setEditingDatos(false)}
              loading={updateProfileMutation.isPending}
            />
          ) : (
            <View className="mx-5 bg-card rounded-2xl border border-border overflow-hidden">
              <CardRow label={t('perfil.nombre')}   value={usuario?.nombre ?? '—'} />
              <CardRow label={t('perfil.apellido')} value={usuario?.apellido ?? '—'} />
              <CardRow label={t('perfil.email')}    value={usuario?.email ?? '—'} last />
              <Pressable
                onPress={() => setEditingDatos(true)}
                className="border-t border-border px-5 py-3 flex-row items-center justify-center gap-2 active:opacity-70"
              >
                <Ionicons name="pencil-outline" size={14} color={theme.primary} />
                <Text className="text-sm font-semibold text-primary">{t('perfil.editarDatos')}</Text>
              </Pressable>
            </View>
          )}

          {/* ── Seguridad ─────────────────────────────────────────── */}
          <SectionHeader title={t('perfil.seguridad')} />

          {editingPassword ? (
            <ChangePasswordForm
              onSave={(actual, nueva) =>
                changePasswordMutation.mutate({ actual, nueva })
              }
              onCancel={() => setEditingPassword(false)}
              loading={changePasswordMutation.isPending}
            />
          ) : (
            <View className="mx-5 bg-card rounded-2xl border border-border overflow-hidden">
              <Pressable
                onPress={() => setEditingPassword(true)}
                className="px-5 py-4 flex-row items-center justify-between active:opacity-70"
              >
                <View className="flex-row items-center gap-3">
                  <Ionicons name="key-outline" size={16} color="#64748B" />
                  <Text className="text-sm font-medium text-foreground">
                    {t('perfil.cambiarPassword')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
              </Pressable>
            </View>
          )}

          {/* ── Cuenta ───────────────────────────────────────────── */}
          <SectionHeader title={t('perfil.cuenta')} />

          <View className="mx-5 bg-card rounded-2xl border border-border overflow-hidden">
            <CardRow label={t('perfil.rol')} value={ROL_LABELS[usuario?.rol ?? ''] ?? (usuario?.rol ?? '—')} last={!isTrabajadorTurnos && !isJefeTurnos} />


            {/* ── Trabajador Turnos — accesos rápidos ──────────────── */}
            {isTrabajadorTurnos && (
              <>
                <Pressable
                  onPress={() => router.push('/mi-perfil-laboral')}
                  className="border-t border-border px-5 py-4 flex-row items-center justify-between active:opacity-70"
                >
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="id-card-outline" size={16} color="#64748B" />
                    <Text className="text-sm font-medium text-foreground">Perfil laboral</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </Pressable>
                <Pressable
                  onPress={() => router.push('/mis-postulaciones')}
                  className="border-t border-border px-5 py-4 flex-row items-center justify-between active:opacity-70"
                >
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="list-outline" size={16} color="#64748B" />
                    <Text className="text-sm font-medium text-foreground">Mis postulaciones</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </Pressable>
                <Pressable
                  onPress={() => router.push('/mis-empresas')}
                  className="border-t border-border px-5 py-4 flex-row items-center justify-between active:opacity-70"
                >
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="business-outline" size={16} color="#64748B" />
                    <Text className="text-sm font-medium text-foreground">Mis empresas</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </Pressable>
              </>
            )}

            {/* ── Jefe de Turnos — accesos rápidos ─────────────────── */}
            {isJefeTurnos && (
              <>
                <Pressable
                  onPress={() => router.push('/(tabs)/equipo')}
                  className="border-t border-border px-5 py-4 flex-row items-center justify-between active:opacity-70"
                >
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="people-outline" size={16} color="#64748B" />
                    <Text className="text-sm font-medium text-foreground">Mi equipo</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </Pressable>
                <Pressable
                  onPress={() => router.push('/solicitudes')}
                  className="border-t border-border px-5 py-4 flex-row items-center justify-between active:opacity-70"
                >
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="person-add-outline" size={16} color="#64748B" />
                    <Text className="text-sm font-medium text-foreground">Solicitudes de ingreso</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </Pressable>
                <Pressable
                  onPress={() => router.push('/(tabs)/turnos')}
                  className="border-t border-border px-5 py-4 flex-row items-center justify-between active:opacity-70"
                >
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="calendar-outline" size={16} color="#64748B" />
                    <Text className="text-sm font-medium text-foreground">Gestión de turnos</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </Pressable>
                <Pressable
                  onPress={() => router.push('/cargos')}
                  className="border-t border-border px-5 py-4 flex-row items-center justify-between active:opacity-70"
                >
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="briefcase-outline" size={16} color="#64748B" />
                    <Text className="text-sm font-medium text-foreground">Gestión de cargos</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </Pressable>
                <Pressable
                  onPress={() => router.push('/puntos-marcaje')}
                  className="border-t border-border px-5 py-4 flex-row items-center justify-between active:opacity-70"
                >
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="location-outline" size={16} color="#64748B" />
                    <Text className="text-sm font-medium text-foreground">Puntos de marcaje</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </Pressable>
              </>
            )}
          </View>

          {/* ── Cerrar sesión ────────────────────────────────────── */}
          <Pressable
            onPress={handleLogout}
            disabled={loggingOut}
            className="mx-5 mt-6 h-14 rounded-2xl bg-danger/10 border border-danger/30 items-center justify-center active:opacity-80 disabled:opacity-50"
          >
            {loggingOut ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <Text className="text-base font-semibold text-danger">
                {t('perfil.cerrarSesion')}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
