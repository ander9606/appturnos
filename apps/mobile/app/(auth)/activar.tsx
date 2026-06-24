/**
 * Pantalla: Activar cuenta
 *
 * Flujo:
 *   1. Trabajador introduce cédula + email + contraseña
 *   2. Se llama useAuthStore.activarCuenta()
 *      (internamente: POST /api/auth/activar-cuenta → POST /api/auth/login)
 *   3. Si OK → queda autenticado, _layout.tsx redirige a (tabs)
 *   4. Si error → mensaje en pantalla
 */
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Pressable,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { activarCuentaSchema, type ActivarCuentaFormData } from '@/features/auth/schemas';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { t } from '@/lib/i18n';
import { ApiError, authApi } from '@api-client';

const TIPO_LABEL: Record<string, string> = {
  // tipos de trabajador
  turnos:            'Trabajador de Turnos',
  nomina:            'Trabajador de Nómina',
  ambos:             'Trabajador de Turnos y Nómina',
  // roles de gestor
  jefe_turnos:       'Jefe de Turnos',
  jefe_nomina:       'Jefe de Nómina',
  nomina_gestor:     'Gestor de Nómina',
  // roles completos (usuarios.rol)
  trabajador_turnos: 'Trabajador de Turnos',
  trabajador_nomina: 'Trabajador de Nómina',
};

const { height } = Dimensions.get('window');

export default function ActivarCuentaScreen() {
  const router = useRouter();
  const activarCuenta = useAuthStore((s) => s.activarCuenta);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [invitacionInfo, setInvitacionInfo] = React.useState<{ empresa_nombre: string; tipo: string } | null>(null);

  const checkCedula = async (cedula: string) => {
    if (cedula.length < 4) return;
    try {
      const res = await authApi.verificarCedula(cedula);
      if (res.existe && res.invitacion) {
        setInvitacionInfo({ empresa_nombre: res.invitacion.empresa_nombre, tipo: res.tipo ?? '' });
      } else {
        setInvitacionInfo(null);
      }
    } catch {
      setInvitacionInfo(null);
    }
  };

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ActivarCuentaFormData>({
    resolver: zodResolver(activarCuentaSchema),
    defaultValues: { cedula: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async (data: ActivarCuentaFormData) => {
    setServerError(null);
    try {
      await activarCuenta({
        cedula: data.cedula,
        email: data.email,
        password: data.password,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404)        setServerError(t('auth.errors.cedulaNotFound'));
        else if (err.status === 409 && err.message.includes('email'))
                                       setServerError(t('auth.errors.emailInUse'));
        else if (err.status === 409)   setServerError(t('auth.errors.alreadyActivated'));
        else if (err.status === 401)   setServerError(t('auth.errors.invalidCredentials'));
        else                           setServerError(err.message);
      } else {
        setServerError(t('auth.errors.generic'));
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.circle1} />
          <View style={styles.circle2} />

          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="chevron-back" size={22} color="white" />
          </Pressable>

          <View style={styles.logoBox}>
            <Ionicons name="key-outline" size={38} color="white" />
          </View>
          <Text style={styles.title}>{t('auth.activar.title')}</Text>
          <Text style={styles.subtitle}>{t('auth.activar.subtitle')}</Text>
        </View>

        {/* ── Formulario ── */}
        <View style={styles.form}>
          {serverError && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
              <Text style={styles.errorText}>{serverError}</Text>
            </View>
          )}

          <View style={styles.fields}>
            <Controller
              control={control}
              name="cedula"
              render={({ field: { onChange, onBlur, value } }) => (
                <>
                  <Input
                    label={t('auth.activar.cedula')}
                    placeholder={t('auth.activar.cedulaPlaceholder')}
                    keyboardType="number-pad"
                    returnKeyType="next"
                    value={value}
                    onChangeText={onChange}
                    onBlur={() => { onBlur(); checkCedula(value); }}
                    error={errors.cedula?.message}
                  />
                  {invitacionInfo && (
                    <View style={styles.invitacionBanner}>
                      <Ionicons name="business-outline" size={16} color="#0EA5E9" />
                      <Text style={styles.invitacionText}>
                        Tienes una invitación de{' '}
                        <Text style={styles.invitacionBold}>{invitacionInfo.empresa_nombre}</Text>
                        {invitacionInfo.tipo ? ` como ${TIPO_LABEL[invitacionInfo.tipo] ?? invitacionInfo.tipo}` : ''}.
                        Completa tu activación aquí.
                      </Text>
                    </View>
                  )}
                </>
              )}
            />

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label={t('auth.activar.email')}
                  placeholder={t('auth.activar.emailPlaceholder')}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  returnKeyType="next"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.email?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label={t('auth.activar.password')}
                  placeholder={t('auth.activar.passwordPlaceholder')}
                  isPassword
                  hint="Mínimo 8 caracteres"
                  returnKeyType="next"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.password?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label={t('auth.activar.confirmPassword')}
                  placeholder={t('auth.activar.confirmPlaceholder')}
                  isPassword
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit(onSubmit)}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.confirmPassword?.message}
                />
              )}
            />
          </View>

          <View style={styles.submitWrap}>
            <Button
              label={isSubmitting ? t('auth.activar.submitting') : t('auth.activar.submit')}
              onPress={handleSubmit(onSubmit)}
              loading={isSubmitting}
              fullWidth
              size="lg"
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('auth.activar.alreadyAccount')} </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.footerLink}>{t('auth.activar.loginLink')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { flexGrow: 1 },

  // Header
  header: {
    minHeight: height * 0.30,
    backgroundColor: '#FF5A3C',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 32,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: 'hidden',
  },
  circle1: {
    position: 'absolute', width: 240, height: 240, borderRadius: 120,
    backgroundColor: 'rgba(255,255,255,0.07)', top: -80, right: -50,
  },
  circle2: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.05)', bottom: -20, left: -40,
  },
  backBtn: {
    position: 'absolute', top: 52, left: 16,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoBox: {
    width: 76, height: 76, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  title:    { fontSize: 24, fontWeight: '800', color: 'white', letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 4, paddingHorizontal: 32, textAlign: 'center' },

  // Form
  form: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 32 },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16,
  },
  errorText: { flex: 1, fontSize: 13, fontWeight: '500', color: '#EF4444' },

  fields:     { gap: 14 },
  submitWrap: { marginTop: 24 },

  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  footerText: { fontSize: 14, color: '#94A3B8' },
  footerLink: { fontSize: 14, fontWeight: '700', color: '#FF5A3C' },

  invitacionBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#F0F9FF', borderWidth: 1, borderColor: '#BAE6FD',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: 8,
  },
  invitacionText: { flex: 1, fontSize: 13, color: '#0369A1', lineHeight: 18 },
  invitacionBold: { fontWeight: '700' },
});
