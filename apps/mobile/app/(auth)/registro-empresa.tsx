/**
 * Pantalla: Registro de empresa nueva
 * POST /api/auth/registro-empresa → crea empresa + admin_empresa → auto-login
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
import { z } from 'zod';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '@/features/auth/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ApiError } from '@api-client';

const { height } = Dimensions.get('window');

const schema = z.object({
  nombre_empresa: z.string().min(2, 'Nombre de empresa requerido'),
  nit:            z.string().optional(),
  actividad:      z.string().max(200).optional(),
  descripcion:    z.string().max(500).optional(),
  telefono:       z.string().max(30).optional(),
  email_empresa:  z.string().email('Email inválido').optional().or(z.literal('')),
  direccion:      z.string().max(300).optional(),
  ciudad:         z.string().max(100).optional(),
  nombre:         z.string().min(2, 'Tu nombre es requerido'),
  apellido:       z.string().optional(),
  email:          z.string().email('Email inválido'),
  password:       z.string().min(8, 'Mínimo 8 caracteres'),
  confirmar:      z.string(),
}).refine(d => d.password === d.confirmar, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmar'],
});

type Form = z.infer<typeof schema>;

export default function RegistroEmpresaScreen() {
  const router           = useRouter();
  const registrarEmpresa = useAuthStore((s) => s.registrarEmpresa);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      nombre_empresa: '', nit: '', actividad: '', descripcion: '',
      telefono: '', email_empresa: '', direccion: '', ciudad: '',
      nombre: '', apellido: '', email: '', password: '', confirmar: '',
    },
  });

  const onSubmit = async (data: Form) => {
    setServerError(null);
    try {
      await registrarEmpresa({
        nombre_empresa: data.nombre_empresa,
        nit:            data.nit            || undefined,
        actividad:      data.actividad      || undefined,
        descripcion:    data.descripcion    || undefined,
        telefono:       data.telefono       || undefined,
        email_empresa:  data.email_empresa  || undefined,
        direccion:      data.direccion      || undefined,
        ciudad:         data.ciudad         || undefined,
        nombre:         data.nombre,
        apellido:       data.apellido       || undefined,
        email:          data.email,
        password:       data.password,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.status === 409 ? 'El email ya está registrado.' : err.message);
      } else {
        setServerError('Error inesperado. Intenta de nuevo.');
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
            <Ionicons name="briefcase" size={38} color="white" />
          </View>
          <Text style={styles.title}>Registra tu empresa</Text>
          <Text style={styles.subtitle}>Crea tu cuenta y empieza a gestionar turnos</Text>
        </View>

        {/* ── Formulario ── */}
        <View style={styles.form}>
          {serverError && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
              <Text style={styles.errorText}>{serverError}</Text>
            </View>
          )}

          <Section label="Datos de la empresa" icon="business-outline" />

          <Controller control={control} name="nombre_empresa" render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Nombre de la empresa *"
              placeholder="Ej. Eventos Horizonte S.A.S"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.nombre_empresa?.message}
              returnKeyType="next"
            />
          )} />

          <View style={styles.row}>
            <View style={styles.half}>
              <Controller control={control} name="nit" render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="NIT"
                  placeholder="900.123.456-7"
                  value={value ?? ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  returnKeyType="next"
                />
              )} />
            </View>
            <View style={styles.half}>
              <Controller control={control} name="ciudad" render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Ciudad"
                  placeholder="Bogotá"
                  value={value ?? ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  returnKeyType="next"
                />
              )} />
            </View>
          </View>

          <Controller control={control} name="actividad" render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Actividad económica"
              placeholder="Ej. Organización de eventos"
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              returnKeyType="next"
            />
          )} />

          <Controller control={control} name="descripcion" render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Descripción"
              placeholder="Breve descripción de tu empresa..."
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              multiline
              numberOfLines={3}
              returnKeyType="next"
            />
          )} />

          <Section label="Contacto" icon="call-outline" />

          <View style={styles.row}>
            <View style={styles.half}>
              <Controller control={control} name="telefono" render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Teléfono"
                  placeholder="+57 300 000 0000"
                  keyboardType="phone-pad"
                  value={value ?? ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  returnKeyType="next"
                />
              )} />
            </View>
            <View style={styles.half}>
              <Controller control={control} name="email_empresa" render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Email empresa"
                  placeholder="info@empresa.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={value ?? ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.email_empresa?.message}
                  returnKeyType="next"
                />
              )} />
            </View>
          </View>

          <Controller control={control} name="direccion" render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Dirección"
              placeholder="Calle 123 # 45-67"
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              returnKeyType="next"
            />
          )} />

          <Section label="Tu cuenta de administrador" icon="person-circle-outline" />

          <View style={styles.row}>
            <View style={styles.half}>
              <Controller control={control} name="nombre" render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Nombre *"
                  placeholder="Juan"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.nombre?.message}
                  returnKeyType="next"
                />
              )} />
            </View>
            <View style={styles.half}>
              <Controller control={control} name="apellido" render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Apellido"
                  placeholder="Pérez"
                  value={value ?? ''}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  returnKeyType="next"
                />
              )} />
            </View>
          </View>

          <Controller control={control} name="email" render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Email *"
              placeholder="admin@tuempresa.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.email?.message}
              returnKeyType="next"
            />
          )} />

          <Controller control={control} name="password" render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Contraseña *"
              isPassword
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.password?.message}
              hint="Mínimo 8 caracteres"
              returnKeyType="next"
            />
          )} />

          <Controller control={control} name="confirmar" render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Confirmar contraseña *"
              isPassword
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.confirmar?.message}
              returnKeyType="done"
              onSubmitEditing={handleSubmit(onSubmit)}
            />
          )} />

          <View style={styles.submitWrap}>
            <Button
              label={isSubmitting ? 'Creando empresa...' : 'Crear empresa'}
              onPress={handleSubmit(onSubmit)}
              loading={isSubmitting}
              fullWidth
              size="lg"
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>¿Ya tienes cuenta? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.footerLink}>Iniciar sesión</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Section({ label, icon }: { label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={14} color="#FF5A3C" />
      </View>
      <Text style={styles.sectionLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { flexGrow: 1 },

  // Header
  header: {
    minHeight: height * 0.26,
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
  logoBox: {
    width: 76, height: 76, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  title:    { fontSize: 24, fontWeight: '800', color: 'white', letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 4 },

  // Form
  form: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32, gap: 12 },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  errorText: { flex: 1, fontSize: 13, fontWeight: '500', color: '#EF4444' },

  // Section header
  section: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 8, marginBottom: 2,
  },
  sectionIcon: {
    width: 24, height: 24, borderRadius: 8,
    backgroundColor: '#FFF1EE',
    alignItems: 'center', justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: '#64748B',
    textTransform: 'uppercase', letterSpacing: 0.8,
  },

  row:  { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },

  submitWrap: { marginTop: 8 },

  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  footerText: { fontSize: 14, color: '#94A3B8' },
  footerLink: { fontSize: 14, fontWeight: '700', color: '#FF5A3C' },
});
