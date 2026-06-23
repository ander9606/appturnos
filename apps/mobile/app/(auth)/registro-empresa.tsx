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
} from 'react-native';
import { Link } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '@/features/auth/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ApiError } from '@api-client';

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
        nit: data.nit || undefined,
        actividad: data.actividad || undefined,
        descripcion: data.descripcion || undefined,
        telefono: data.telefono || undefined,
        email_empresa: data.email_empresa || undefined,
        direccion: data.direccion || undefined,
        ciudad: data.ciudad || undefined,
        nombre: data.nombre,
        apellido: data.apellido || undefined,
        email: data.email,
        password: data.password,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) setServerError('El email ya está registrado.');
        else setServerError(err.message);
      } else {
        setServerError('Error inesperado. Intenta de nuevo.');
      }
    }
  };

  const SectionLabel = ({ children }: { children: string }) => (
    <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-2">
      {children}
    </Text>
  );

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="light" />
      <ScrollView
        contentContainerClassName="flex-grow"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="items-center justify-end bg-primary-500 pt-14 pb-10 rounded-b-[40px]">
          <View
            className="rounded-2xl bg-white/20 items-center justify-center mb-4"
            style={{ width: 72, height: 72 }}
          >
            <Ionicons name="briefcase-outline" size={36} color="white" />
          </View>
          <Text className="text-2xl font-bold text-white">Registra tu empresa</Text>
          <Text className="text-sm text-white/75 mt-1 px-8 text-center">
            Crea tu cuenta y empieza a gestionar turnos
          </Text>
        </View>

        {/* Form */}
        <View className="flex-1 px-6 pt-6 pb-6 gap-4">
          {serverError && (
            <View className="bg-danger-light border border-danger/30 rounded-xl px-4 py-3">
              <Text className="text-sm font-medium text-danger">{serverError}</Text>
            </View>
          )}

          <SectionLabel>Datos de la empresa</SectionLabel>

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

          <View className="flex-row gap-3">
            <View className="flex-1">
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
            <View className="flex-1">
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

          <SectionLabel>Contacto</SectionLabel>

          <View className="flex-row gap-3">
            <View className="flex-1">
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
            <View className="flex-1">
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

          <SectionLabel>Tu cuenta de administrador</SectionLabel>

          <View className="flex-row gap-3">
            <View className="flex-1">
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
            <View className="flex-1">
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

          <Button
            label={isSubmitting ? 'Creando empresa...' : 'Crear empresa'}
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            fullWidth
            size="lg"
          />

          <View className="flex-row justify-center gap-1 mt-1">
            <Text className="text-sm text-muted-foreground">¿Ya tienes cuenta?</Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text className="text-sm font-semibold text-primary-500">Iniciar sesión</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
