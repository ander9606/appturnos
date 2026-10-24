/**
 * Pantalla: Activar cuenta
 *
 * Flujo de 2 pasos (igual que registro.tsx):
 *   Paso 1 — cédula + email + contraseña → envía OTP al email
 *   Paso 2 — verificación del código OTP → activa la cuenta y autentica
 *
 * El OTP prueba que quien activa controla ese correo — necesario porque la
 * cédula (lo único que identifica al trabajador aquí) no es un secreto.
 */
import { Text } from '@/components/ui/Text';
import { COLORS, alpha } from '@/lib/designTokens';
import React from 'react';
import {
  View,
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

import { activarCuentaSchema, type ActivarCuentaFormData } from '@/features/auth/schemas';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { t } from '@/lib/i18n';
import { ApiError, authApi } from '@api-client';
import { TIPO_LABEL } from '@/lib/roleLabels';

const { height } = Dimensions.get('window');

export default function ActivarCuentaScreen() {
  const router = useRouter();
  const activarCuenta = useAuthStore((s) => s.activarCuenta);
  const [step, setStep] = React.useState<'datos' | 'otp'>('datos');
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [invitacionInfo, setInvitacionInfo] = React.useState<{ empresa_nombre: string; tipo: string } | null>(null);
  const [cuentaExistente, setCuentaExistente] = React.useState(false);

  const emailTokenRef = React.useRef<string | null>(null);
  const formDataRef = React.useRef<ActivarCuentaFormData | null>(null);

  const [emailOtp, setEmailOtp] = React.useState('');
  const [otpError, setOtpError] = React.useState<string | null>(null);
  const [emailVerified, setEmailVerified] = React.useState(false);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);
  const [resending, setResending] = React.useState(false);

  const checkCedula = async (cedula: string) => {
    if (cedula.length < 4) return;
    try {
      const res = await authApi.verificarCedula(cedula);
      setCuentaExistente(!!res.tiene_cuenta);
      if (res.existe && res.invitacion) {
        setInvitacionInfo({ empresa_nombre: res.invitacion.empresa_nombre, tipo: res.tipo ?? '' });
      } else {
        setInvitacionInfo(null);
      }
    } catch {
      setInvitacionInfo(null);
      setCuentaExistente(false);
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

  const onSubmitDatos = async (data: ActivarCuentaFormData) => {
    setServerError(null);
    try {
      await authApi.enviarOtp({ tipo: 'email', destino: data.email });
      formDataRef.current = data;
      setStep('otp');
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : t('auth.errors.generic'));
    }
  };

  const verificarEmail = async () => {
    if (emailOtp.length !== 6) { setOtpError('El código tiene 6 dígitos'); return; }
    setOtpError(null);
    setIsVerifying(true);
    try {
      const { token } = await authApi.verificarOtp({
        tipo: 'email',
        destino: formDataRef.current!.email,
        codigo: emailOtp,
      });
      emailTokenRef.current = token;
      setEmailVerified(true);
    } catch (err) {
      setOtpError(err instanceof ApiError ? err.message : 'Código incorrecto');
    } finally {
      setIsVerifying(false);
    }
  };

  const reenviarCodigo = async () => {
    setResending(true);
    try { await authApi.enviarOtp({ tipo: 'email', destino: formDataRef.current!.email }); }
    finally { setResending(false); }
  };

  const crearCuenta = async () => {
    const data = formDataRef.current;
    if (!data || !emailVerified || !emailTokenRef.current) {
      setServerError('Verifica el código antes de continuar.');
      return;
    }
    setServerError(null);
    setIsCreating(true);
    try {
      await activarCuenta({
        cedula: data.cedula,
        email: data.email,
        password: data.password,
        email_token: emailTokenRef.current,
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
    } finally {
      setIsCreating(false);
    }
  };

  const data = formDataRef.current;

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
            <Ionicons name={step === 'datos' ? 'key-outline' : 'shield-checkmark-outline'} size={38} color="white" />
          </View>
          <Text style={styles.title}>
            {step === 'datos' ? t('auth.activar.title') : 'Verificar identidad'}
          </Text>
          <Text style={styles.subtitle}>
            {step === 'datos' ? t('auth.activar.subtitle') : 'Ingresa el código que enviamos a tu correo'}
          </Text>
        </View>

        {/* ── Formulario ── */}
        <View style={styles.form}>
          {serverError && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={16} color={COLORS.danger} />
              <Text style={styles.errorText}>{serverError}</Text>
            </View>
          )}

          {step === 'datos' && (
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
                    {invitacionInfo && !cuentaExistente && (
                      <View style={styles.invitacionBanner}>
                        <Ionicons name="business-outline" size={16} color={COLORS.info} />
                        <Text style={styles.invitacionText}>
                          Tienes una invitación de{' '}
                          <Text style={styles.invitacionBold}>{invitacionInfo.empresa_nombre}</Text>
                          {invitacionInfo.tipo ? ` como ${TIPO_LABEL[invitacionInfo.tipo] ?? invitacionInfo.tipo}` : ''}.
                          Completa tu activación aquí.
                        </Text>
                      </View>
                    )}
                    {cuentaExistente && (
                      <View style={styles.invitacionBanner}>
                        <Ionicons name="information-circle-outline" size={16} color={COLORS.info} />
                        <Text style={styles.invitacionText}>
                          Esta cédula ya tiene una cuenta
                          {invitacionInfo ? (
                            <>
                              {' '}con una invitación de <Text style={styles.invitacionBold}>{invitacionInfo.empresa_nombre}</Text>
                            </>
                          ) : null}
                          . Inicia sesión con tu correo y contraseña para continuar.
                        </Text>
                      </View>
                    )}
                  </>
                )}
              />

              {!cuentaExistente && (
                <>
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
                        onSubmitEditing={handleSubmit(onSubmitDatos)}
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        error={errors.confirmPassword?.message}
                      />
                    )}
                  />
                </>
              )}

              <View style={styles.submitWrap}>
                {cuentaExistente ? (
                  <Button
                    label={t('auth.activar.loginLink')}
                    onPress={() => router.push('/(auth)/login')}
                    fullWidth
                    size="lg"
                  />
                ) : (
                  <Button
                    label={isSubmitting ? 'Enviando código…' : t('auth.activar.submit')}
                    onPress={handleSubmit(onSubmitDatos)}
                    loading={isSubmitting}
                    fullWidth
                    size="lg"
                  />
                )}
              </View>

              <View style={styles.footer}>
                <Text style={styles.footerText}>{t('auth.activar.alreadyAccount')} </Text>
                <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                  <Text style={styles.footerLink}>{t('auth.activar.loginLink')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {step === 'otp' && data && (
            <View style={styles.fields}>
              <View style={styles.otpCard}>
                <View style={styles.otpCardHeader}>
                  <Ionicons
                    name={emailVerified ? 'checkmark-circle' : 'mail-outline'}
                    size={20}
                    color={emailVerified ? COLORS.success : COLORS.placeholder}
                  />
                  <Text style={styles.otpCardTitle}>Código de correo electrónico</Text>
                </View>
                <Text style={styles.otpCardSubtitle}>
                  Enviado a <Text style={{ fontWeight: '600' }}>{data.email}</Text>
                </Text>

                {!emailVerified ? (
                  <>
                    <Input
                      label=""
                      placeholder="000000"
                      keyboardType="number-pad"
                      maxLength={6}
                      value={emailOtp}
                      onChangeText={setEmailOtp}
                      error={otpError ?? undefined}
                    />
                    <View style={styles.otpActions}>
                      <View style={{ flex: 1 }}>
                        <Button
                          label={isVerifying ? 'Verificando…' : 'Verificar'}
                          onPress={verificarEmail}
                          loading={isVerifying}
                          size="sm"
                          fullWidth
                        />
                      </View>
                      <TouchableOpacity onPress={reenviarCodigo} disabled={resending} style={styles.otpResend}>
                        <Text style={styles.footerLink}>{resending ? 'Reenviando…' : 'Reenviar'}</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <Text style={{ color: COLORS.success, fontWeight: '600', fontSize: 13 }}>✓ Correo verificado</Text>
                )}
              </View>

              <Button
                label={isCreating ? t('auth.activar.submitting') : t('auth.activar.submit')}
                onPress={crearCuenta}
                loading={isCreating}
                disabled={!emailVerified}
                fullWidth
                size="lg"
              />

              <TouchableOpacity onPress={() => setStep('datos')} style={{ alignItems: 'center', paddingVertical: 8 }}>
                <Text style={styles.footerText}>← Volver y editar datos</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.background },
  scroll: { flexGrow: 1 },

  // Header
  header: {
    minHeight: height * 0.30,
    backgroundColor: COLORS.primary,
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
    backgroundColor: alpha(COLORS.danger, 0.07), borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16,
  },
  errorText: { flex: 1, fontSize: 13, fontWeight: '500', color: COLORS.danger },

  fields:     { gap: 14 },
  submitWrap: { marginTop: 24 },

  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 16 },
  footerText: { fontSize: 14, color: COLORS.placeholder },
  footerLink: { fontSize: 14, fontWeight: '700', color: COLORS.primary },

  invitacionBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: COLORS.infoLight, borderWidth: 1, borderColor: COLORS.infoBorder,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: 8,
  },
  invitacionText: { flex: 1, fontSize: 13, color: COLORS.infoText, lineHeight: 18 },
  invitacionBold: { fontWeight: '700' },

  otpCard: {
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 16, padding: 16, gap: 12,
  },
  otpCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  otpCardTitle: { fontSize: 14, fontWeight: '600', color: COLORS.foreground },
  otpCardSubtitle: { fontSize: 12, color: COLORS.placeholder },
  otpActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  otpResend: { justifyContent: 'center', paddingHorizontal: 4 },
});
