/**
 * Perfil — Tab "Perfil"
 *
 * Permite al usuario:
 * - Ver y editar sus datos personales (nombre, apellido, email)
 * - Cambiar su contraseña
 * - Cerrar sesión
 */
import React, { useState, useEffect } from 'react';
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
  Switch,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
// ponytail: lazy import — native module only loaded when handler runs, not at route discovery time

import * as LocalAuthentication from 'expo-local-authentication';
import { webSafeSecureStore as SecureStore } from '@/lib/secureStore';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { authApi } from '@api-client';
import { t } from '@/lib/i18n';
import { showToast } from '@/lib/toast';
import type { ApiError } from '@api-client';
import { useTheme } from '@/lib/theme';
import { useNominaPerfil, useActualizarExtras } from '@/features/nomina/useNomina';
import { Avatar } from '@/components/ui/Avatar';

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

// ── Delete Account Form ────────────────────────────────────────────────────

function DeleteAccountForm({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: (password: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [password, setPassword] = useState('');

  return (
    <View className="bg-card rounded-2xl mx-5 border border-danger/30 overflow-hidden">
      <View className="px-5 py-4 border-b border-border">
        <Text className="text-sm font-semibold text-danger">Confirmar eliminación de cuenta</Text>
        <Text className="text-xs text-muted-foreground mt-1">
          Ingresa tu contraseña actual para confirmar. Esta acción no se puede deshacer.
        </Text>
      </View>

      <View className="px-5 py-3">
        <Text className="text-xs text-muted-foreground mb-1">Contraseña</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          className="text-sm text-foreground"
          placeholder="Tu contraseña actual"
          placeholderTextColor="#94A3B8"
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      <View className="flex-row gap-3 px-5 py-4 border-t border-border">
        <Pressable
          onPress={onCancel}
          className="flex-1 h-11 rounded-xl border border-border items-center justify-center active:opacity-70"
        >
          <Text className="text-sm font-semibold text-muted-foreground">{t('perfil.cancelar')}</Text>
        </Pressable>
        <Pressable
          onPress={() => onConfirm(password)}
          disabled={loading || !password}
          className="flex-1 h-11 rounded-xl bg-danger items-center justify-center active:opacity-80 disabled:opacity-50"
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text className="text-sm font-semibold text-white">Eliminar cuenta</Text>
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
  const isAdmin            = usuario?.rol === 'admin_empresa';

  const isTrabajadorNomina = usuario?.rol === 'trabajador_nomina';

  const [editingDatos,    setEditingDatos]    = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [loggingOut,      setLoggingOut]      = useState(false);
  const [uploadingFoto,   setUploadingFoto]   = useState(false);
  const [bioSupported,    setBioSupported]    = useState(false);
  const [bioEnabled,      setBioEnabled]      = useState(false);

  useEffect(() => {
    Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      SecureStore.getItemAsync('appturnos.biometric_enabled'),
    ]).then(([hw, enrolled, pref]) => {
      setBioSupported(hw && enrolled);
      setBioEnabled(pref === '1');
    });
  }, []);

  const handleToggleBio = async (val: boolean) => {
    await SecureStore.setItemAsync('appturnos.biometric_enabled', val ? '1' : '0');
    setBioEnabled(val);
  };

  const { data: nominaPerfil } = useNominaPerfil(isTrabajadorNomina);
  const actualizarExtrasMutation = useActualizarExtras();

  const handleToggleExtras = (val: boolean) => {
    actualizarExtrasMutation.mutate(val, {
      onError: (err) => Alert.alert('Error', (err as ApiError).message ?? t('common.error')),
    });
  };

  // ── Foto de perfil ─────────────────────────────────────────────────

  const handleCambiarFoto = () => {
    Alert.alert('Foto de perfil', undefined, [
      {
        text: 'Tomar foto',
        onPress: async () => {
          const ImagePicker = await import('expo-image-picker');
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) { Alert.alert('Permiso requerido', 'Permite el acceso a la cámara.'); return; }
          const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.5, base64: true, allowsEditing: true, aspect: [1, 1] });
          if (!result.canceled && result.assets[0]?.base64) _subirFoto(result.assets[0].base64);
        },
      },
      {
        text: 'Galería',
        onPress: async () => {
          const ImagePicker = await import('expo-image-picker');
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) { Alert.alert('Permiso requerido', 'Permite el acceso a la galería.'); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.5, base64: true, allowsEditing: true, aspect: [1, 1] });
          if (!result.canceled && result.assets[0]?.base64) _subirFoto(result.assets[0].base64);
        },
      },
      usuario?.foto_perfil ? { text: 'Quitar foto', style: 'destructive' as const, onPress: () => _subirFoto(null) } : null,
      { text: 'Cancelar', style: 'cancel' as const },
    ].filter(Boolean) as any[]);
  };

  const _subirFoto = async (b64: string | null) => {
    setUploadingFoto(true);
    try {
      const perfil = await authApi.actualizarFoto(b64);
      setUsuario(perfil);
    } catch (err) {
      Alert.alert('Error', (err as ApiError).message ?? t('common.error'));
    } finally {
      setUploadingFoto(false);
    }
  };

  // ── Mutations ──────────────────────────────────────────────────────────

  const updateProfileMutation = useMutation({
    mutationFn: (params: { nombre: string; apellido: string; email: string }) =>
      authApi.updateProfile(params),
    onSuccess: (data) => {
      setUsuario(data);
      setEditingDatos(false);
      showToast(t('perfil.successDatos'));
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
      showToast(t('perfil.successPassword'));
      await logout();
    },
    onError: (err: ApiError) => {
      Alert.alert('Error', err.message ?? t('common.error'));
    },
  });

  const eliminarCuentaMutation = useMutation({
    mutationFn: (password: string) => authApi.eliminarCuenta(password),
    onSuccess: async () => {
      await logout();
    },
    onError: (err: ApiError) => {
      Alert.alert('No se pudo eliminar la cuenta', err.message ?? t('common.error'));
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

  const handleEliminarCuenta = () => {
    Alert.alert(
      'Eliminar cuenta',
      'Vamos a anonimizar tu nombre, cédula, teléfono, correo y demás datos de contacto — dejarán de estar asociados a ti. Por obligación legal de nómina, conservamos (de forma anonimizada) tu historial de turnos trabajados, contratos y pagos hasta por 5 años. No podrás volver a iniciar sesión con esta cuenta. Esta acción no se puede deshacer.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: 'Continuar', style: 'destructive', onPress: () => setDeletingAccount(true) },
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

            {/* Avatar con botón de cambio */}
            <TouchableOpacity onPress={handleCambiarFoto} disabled={uploadingFoto} className="mt-2 relative">
              <Avatar
                id={usuario?.id}
                nombre={usuario?.nombre}
                apellido={usuario?.apellido}
                fotoB64={usuario?.foto_perfil}
                size={80}
              />
              <View className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-white items-center justify-center border-2 border-white" style={{ borderColor: theme.primary }}>
                {uploadingFoto
                  ? <ActivityIndicator size="small" color={theme.primary} />
                  : <Ionicons name="camera" size={14} color={theme.primary} />}
              </View>
            </TouchableOpacity>

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

              {bioSupported && (
                <View className="border-t border-border px-5 py-4 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="finger-print" size={16} color="#64748B" />
                    <Text className="text-sm font-medium text-foreground">Bloqueo biométrico</Text>
                  </View>
                  <Switch
                    value={bioEnabled}
                    onValueChange={handleToggleBio}
                    trackColor={{ false: '#E2E8F0', true: theme.primary }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              )}
            </View>
          )}

          {/* ── Cuenta ───────────────────────────────────────────── */}
          <SectionHeader title={t('perfil.cuenta')} />

          <View className="mx-5 bg-card rounded-2xl border border-border overflow-hidden">
            {/* isTrabajadorNomina no agrega filas en esta tarjeta — "Rol" queda como última fila para ese rol */}
            <CardRow label={t('perfil.rol')} value={ROL_LABELS[usuario?.rol ?? ''] ?? (usuario?.rol ?? '—')} last={!isTrabajadorTurnos && !isJefeTurnos && !isAdmin} />

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
                <Pressable
                  onPress={() => router.push('/disponibilidad')}
                  className="border-t border-border px-5 py-4 flex-row items-center justify-between active:opacity-70"
                >
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="calendar-clear-outline" size={16} color="#64748B" />
                    <Text className="text-sm font-medium text-foreground">Mi disponibilidad</Text>
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

            {/* ── Admin Empresa — accesos rápidos ──────────────────── */}
            {isAdmin && (
              <>
                <Pressable
                  onPress={() => router.push('/mi-empresa')}
                  className="border-t border-border px-5 py-4 flex-row items-center justify-between active:opacity-70"
                >
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="business-outline" size={16} color="#64748B" />
                    <Text className="text-sm font-medium text-foreground">Mi empresa</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </Pressable>
                <Pressable
                  onPress={() => router.push('/gestores')}
                  className="border-t border-border px-5 py-4 flex-row items-center justify-between active:opacity-70"
                >
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="people-outline" size={16} color="#64748B" />
                    <Text className="text-sm font-medium text-foreground">Gestores</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </Pressable>
                <Pressable
                  onPress={() => router.push('/reportes')}
                  className="border-t border-border px-5 py-4 flex-row items-center justify-between active:opacity-70"
                >
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="bar-chart-outline" size={16} color="#64748B" />
                    <Text className="text-sm font-medium text-foreground">Reportes</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </Pressable>
                <Pressable
                  onPress={() => router.push('/crear-gestor')}
                  className="border-t border-border px-5 py-4 flex-row items-center justify-between active:opacity-70"
                >
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="person-add-outline" size={16} color="#64748B" />
                    <Text className="text-sm font-medium text-foreground">Crear gestor</Text>
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

          {/* ── Trabajador Nómina — accesos rápidos ─────────────── */}
          {isTrabajadorNomina && (
            <>
              <SectionHeader title="Mi nómina" />
              <View className="mx-5 bg-card rounded-2xl border border-border overflow-hidden">
                <Pressable
                  onPress={() => router.push('/mi-perfil-laboral')}
                  className="px-5 py-4 flex-row items-center justify-between active:opacity-70"
                >
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="id-card-outline" size={16} color="#64748B" />
                    <Text className="text-sm font-medium text-foreground">Mi información laboral</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </Pressable>

                {/* Toggle acepta_extras */}
                <View className="border-t border-border px-5 py-4 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3 flex-1 mr-3">
                    <Ionicons name="briefcase-outline" size={16} color="#64748B" />
                    <View className="flex-1">
                      <Text className="text-sm font-medium text-foreground">Turnos extra</Text>
                      <Text className="text-xs text-muted-foreground mt-0.5">
                        Recibe ofertas de turnos adicionales fuera de tu jornada
                      </Text>
                    </View>
                  </View>
                  {actualizarExtrasMutation.isPending ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <Switch
                      value={Boolean(nominaPerfil?.acepta_extras)}
                      onValueChange={handleToggleExtras}
                      trackColor={{ false: '#E2E8F0', true: theme.primary }}
                      thumbColor="#FFFFFF"
                    />
                  )}
                </View>

                {/* Mis postulaciones — only if acepta_extras */}
                {nominaPerfil?.acepta_extras && (
                  <Pressable
                    onPress={() => router.push('/mis-postulaciones')}
                    className="border-t border-border px-5 py-4 flex-row items-center justify-between active:opacity-70"
                  >
                    <View className="flex-row items-center gap-3">
                      <Ionicons name="list-outline" size={16} color="#64748B" />
                      <Text className="text-sm font-medium text-foreground">Mis postulaciones extra</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                  </Pressable>
                )}
              </View>
            </>
          )}

          {/* ── Mis ausencias + contratos (trabajadores) ─────────── */}
          {(isTrabajadorTurnos || isTrabajadorNomina) && (
            <>
              <SectionHeader title="Ausencias y contratos" />
              <View className="mx-5 bg-card rounded-2xl border border-border overflow-hidden">
                <Pressable
                  onPress={() => router.push('/ausencias')}
                  className="px-5 py-4 flex-row items-center justify-between active:opacity-70"
                >
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="calendar-clear-outline" size={16} color="#64748B" />
                    <Text className="text-sm font-medium text-foreground">Mis ausencias</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </Pressable>
                {isTrabajadorTurnos && (
                  <Pressable
                    onPress={() => router.push('/mis-contratos')}
                    className="border-t border-border px-5 py-4 flex-row items-center justify-between active:opacity-70"
                  >
                    <View className="flex-row items-center gap-3">
                      <Ionicons name="document-text-outline" size={16} color="#64748B" />
                      <Text className="text-sm font-medium text-foreground">Mis contratos</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                  </Pressable>
                )}
              </View>
            </>
          )}

          {/* ── Legal ────────────────────────────────────────────── */}
          <SectionHeader title="Legal" />
          <View className="mx-5 bg-card rounded-2xl border border-border overflow-hidden">
            <Pressable
              onPress={() => router.push('/terminos')}
              className="px-5 py-4 flex-row items-center justify-between active:opacity-70"
            >
              <View className="flex-row items-center gap-3">
                <Ionicons name="shield-checkmark-outline" size={16} color="#64748B" />
                <Text className="text-sm font-medium text-foreground">Términos y condiciones</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
            </Pressable>
            <Pressable
              onPress={() => router.push('/privacidad')}
              className="border-t border-border px-5 py-4 flex-row items-center justify-between active:opacity-70"
            >
              <View className="flex-row items-center gap-3">
                <Ionicons name="lock-closed-outline" size={16} color="#64748B" />
                <Text className="text-sm font-medium text-foreground">Política de privacidad</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
            </Pressable>
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

          {/* ── Zona de peligro ────────────────────────────────────── */}
          <SectionHeader title="Zona de peligro" />
          {deletingAccount ? (
            <DeleteAccountForm
              onConfirm={(password) => eliminarCuentaMutation.mutate(password)}
              onCancel={() => setDeletingAccount(false)}
              loading={eliminarCuentaMutation.isPending}
            />
          ) : (
            <Pressable
              onPress={handleEliminarCuenta}
              className="mx-5 h-14 rounded-2xl bg-danger/10 border border-danger/30 items-center justify-center active:opacity-80"
            >
              <Text className="text-base font-semibold text-danger">Eliminar cuenta</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
