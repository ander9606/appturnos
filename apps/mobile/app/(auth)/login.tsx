/**
 * Pantalla: Login
 *
 * Flujo:
 *   1. Usuario introduce email + contraseña
 *   2. Se llama useAuthStore.login()
 *   3. Si OK → Expo Router redirige automáticamente a (tabs) via _layout.tsx
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
  Dimensions,
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { loginSchema, type LoginFormData } from '@/features/auth/schemas';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { useGoogleAuth } from '@/features/auth/useGoogleAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { t } from '@/lib/i18n';
import { ApiError } from '@api-client';

const { height } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const login  = useAuthStore((s) => s.login);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const { promptAsync: googleLogin, loading: googleLoading } = useGoogleAuth((msg) => setServerError(msg));

  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);
    try {
      await login(data.email, data.password);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401)      setServerError(t('auth.errors.invalidCredentials'));
        else if (err.status === 429) setServerError(t('auth.errors.accountLocked'));
        else if (err.status === 403) setServerError(t('auth.errors.inactiveUser'));
        else                         setServerError(err.message);
      } else if (err instanceof TypeError) {
        setServerError('No se pudo conectar al servidor. Verifica tu conexión.');
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

          <View style={styles.logoBox}>
            <Ionicons name="planet" size={40} color="white" />
          </View>
          <Text style={styles.appName}>Zaturno</Text>
          <Text style={styles.appSub}>Gestión de turnos y nómina</Text>
        </View>

        {/* ── Formulario ── */}
        <View style={styles.form}>
          <Text style={styles.formTitle}>{t('auth.login.title')}</Text>
          <Text style={styles.formSub}>{t('auth.login.subtitle')}</Text>

          {serverError && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
              <Text style={styles.errorText}>{serverError}</Text>
            </View>
          )}

          <View style={styles.fields}>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label={t('auth.login.email')}
                  placeholder={t('auth.login.emailPlaceholder')}
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
                  label={t('auth.login.password')}
                  placeholder={t('auth.login.passwordPlaceholder')}
                  isPassword
                  autoComplete="password"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit(onSubmit)}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.password?.message}
                />
              )}
            />
          </View>

          <TouchableOpacity style={styles.forgotWrap} onPress={() => router.push('/(auth)/recuperar')}>
            <Text style={styles.forgotText}>{t('auth.login.forgotPassword')}</Text>
          </TouchableOpacity>

          <Button
            label={isSubmitting ? t('auth.login.submitting') : t('auth.login.submit')}
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            fullWidth
            size="lg"
          />

          {!!process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB && !!process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID && (
            <>
              <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>O continúa con</Text><View style={styles.dividerLine} /></View>
              <TouchableOpacity style={styles.googleBtn} onPress={() => googleLogin()} disabled={googleLoading} activeOpacity={0.8}>
                <Ionicons name="logo-google" size={20} color="#4285F4" />
                <Text style={styles.googleBtnText}>{googleLoading ? 'Conectando…' : 'Continuar con Google'}</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Links secundarios */}
          <View style={styles.links}>
            <LinkRow
              label="¿Eres trabajador sin cuenta?"
              action="Activa tu cuenta"
              onPress={() => router.push('/(auth)/activar')}
            />
            <LinkRow
              label="¿Primera vez con tu empresa?"
              action="Regístrala aquí"
              onPress={() => router.push('/(auth)/registro-empresa')}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function LinkRow({ label, action, onPress }: { label: string; action: string; onPress: () => void }) {
  return (
    <View style={styles.linkRow}>
      <Text style={styles.linkLabel}>{label} </Text>
      <TouchableOpacity onPress={onPress}>
        <Text style={styles.linkAction}>{action}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { flexGrow: 1 },

  // Header
  header: {
    minHeight: height * 0.32,
    backgroundColor: '#FF5A3C',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 36,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: 'hidden',
  },
  circle1: {
    position: 'absolute', width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(255,255,255,0.07)', top: -80, right: -60,
  },
  circle2: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.05)', bottom: 0, left: -50,
  },
  logoBox: {
    width: 82, height: 82, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  appName: { fontSize: 28, fontWeight: '800', color: 'white', letterSpacing: -0.4 },
  appSub:  { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 4 },

  // Formulario
  form: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 32 },

  formTitle: { fontSize: 22, fontWeight: '700', color: '#0F172A' },
  formSub:   { fontSize: 14, color: '#64748B', marginTop: 4, marginBottom: 20 },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16,
  },
  errorText: { flex: 1, fontSize: 13, fontWeight: '500', color: '#EF4444' },

  fields:     { gap: 14 },
  forgotWrap: { alignSelf: 'flex-end', marginTop: 10, marginBottom: 20 },
  forgotText: { fontSize: 13, fontWeight: '600', color: '#FF5A3C' },

  // Links
  links:      { gap: 10, marginTop: 24 },
  linkRow:    { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' },
  linkLabel:  { fontSize: 13, color: '#94A3B8' },
  linkAction: { fontSize: 13, fontWeight: '700', color: '#FF5A3C' },

  divider:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
  dividerText: { fontSize: 12, color: '#94A3B8' },

  googleBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 14, paddingVertical: 14, backgroundColor: 'white', marginBottom: 20 },
  googleBtnText: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
});
