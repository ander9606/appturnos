/**
 * Mi empresa — perfil de la empresa para el admin_empresa.
 * Campos: logo, razón social, NIT, ciudad, actividad, descripción,
 *         acepta_postulaciones (visible en directorio marketplace).
 */
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { showAlert } from '@/lib/alertDialog';
import React, { useEffect } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import type { TipoLiquidacion, TipoContrato } from '@api-client';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/lib/toast';
import { useMiEmpresa, useActualizarEmpresa } from '@/features/empresas/miEmpresa/useMiEmpresa';
import { schema, type FormData } from '@/features/empresas/miEmpresa/miEmpresaForm';
import { TIPO_LIQUIDACION_OPTIONS, TIPO_CONTRATO_OPTIONS } from '@/features/empresas/miEmpresa/opcionesEmpresa';
import { LogoEmpresa } from '@/features/empresas/miEmpresa/LogoEmpresa';
import { CampoEmpresa } from '@/features/empresas/miEmpresa/CampoEmpresa';
import { FirmaRepresentante } from '@/features/empresas/miEmpresa/FirmaRepresentante';
import { SeccionOpciones } from '@/features/empresas/miEmpresa/SeccionOpciones';
import { RecargosSection } from '@/features/empresas/miEmpresa/RecargosSection';
import { DirectorioSwitch, ReglasPagoLink } from '@/features/empresas/miEmpresa/DirectorioYReglas';

// ── Screen ────────────────────────────────────────────────────────────────

export default function MiEmpresaScreen() {
  const { data: empresa, isLoading } = useMiEmpresa();
  const actualizar = useActualizarEmpresa();
  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nombre:               '',
      nit:                  '',
      representante_nombre: '',
      representante_cedula: '',
      ciudad:               '',
      actividad:            '',
      descripcion:          '',
      logo_url:             '',
      acepta_postulaciones: true,
      tipo_liquidacion:     'mensual' as TipoLiquidacion,
      tipo_contrato:        'laboral' as TipoContrato,
      sumar_nocturnas_festivo: true,
      regla_domingo_habitual:  'ley',
    },
  });

  const logoUrl = watch('logo_url');
  const sumar = watch('sumar_nocturnas_festivo');
  const firmaB64 = empresa?.firma_representante_b64 ?? null;

  useEffect(() => {
    if (empresa) {
      reset({
        nombre:               empresa.nombre ?? '',
        nit:                  empresa.nit ?? '',
        representante_nombre: empresa.representante_nombre ?? '',
        representante_cedula: empresa.representante_cedula ?? '',
        ciudad:               empresa.ciudad ?? '',
        actividad:            empresa.actividad ?? '',
        descripcion:          empresa.descripcion ?? '',
        logo_url:             empresa.logo_url ?? '',
        acepta_postulaciones: Boolean(empresa.acepta_postulaciones),
        tipo_liquidacion:     (empresa.tipo_liquidacion ?? 'mensual') as TipoLiquidacion,
        tipo_contrato:        (empresa.tipo_contrato ?? 'laboral') as TipoContrato,
        sumar_nocturnas_festivo: Boolean(empresa.sumar_nocturnas_festivo ?? true),
        regla_domingo_habitual:  empresa.regla_domingo_habitual ?? 'ley',
      });
    }
  }, [empresa, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      await actualizar.mutateAsync({
        nombre:               data.nombre,
        nit:                  data.nit       || undefined,
        representante_nombre: data.representante_nombre || undefined,
        representante_cedula: data.representante_cedula || undefined,
        ciudad:               data.ciudad    || undefined,
        actividad:            data.actividad || undefined,
        descripcion:          data.descripcion || undefined,
        logo_url:             data.logo_url  || undefined,
        acepta_postulaciones: data.acepta_postulaciones,
        tipo_liquidacion:     data.tipo_liquidacion,
        tipo_contrato:        data.tipo_contrato,
        sumar_nocturnas_festivo: data.sumar_nocturnas_festivo,
        regla_domingo_habitual:  data.regla_domingo_habitual,
      });
      showToast('Datos de la empresa actualizados.');
    } catch {
      showAlert('Error', 'No se pudo guardar. Intenta de nuevo.');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <Stack.Screen options={{ title: 'Mi empresa', headerShown: true }} />
        <SkeletonDetail style={{ paddingHorizontal: 16, paddingTop: 12 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Mi empresa', headerShown: true }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 20 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Logo — toca para cambiarlo (cámara/galería), igual que la foto de perfil ── */}
          <LogoEmpresa logoUrl={logoUrl} error={errors.logo_url?.message} />

          {/* ── Datos legales ─────────────────────────────────────── */}
          <View className="gap-1">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Datos legales
            </Text>
          </View>

          <CampoEmpresa
            control={control}
            name="nombre"
            label="Razón social *"
            placeholder="Logística Demo S.A.S."
            autoCapitalize="words"
            error={errors.nombre?.message}
          />

          <CampoEmpresa
            control={control}
            name="nit"
            label="NIT"
            placeholder="900.123.456-7"
            keyboardType="default"
            error={errors.nit?.message}
          />

          <CampoEmpresa
            control={control}
            name="representante_nombre"
            label="Representante legal"
            placeholder="Nombre completo de quien firma por la empresa"
            autoCapitalize="words"
            error={errors.representante_nombre?.message}
          />

          <CampoEmpresa
            control={control}
            name="representante_cedula"
            label="Cédula del representante"
            placeholder="1.234.567.890"
            error={errors.representante_cedula?.message}
          />

          {/* ── Firma del representante legal ─────────────────────── */}
          <FirmaRepresentante firmaB64={firmaB64} />

          <CampoEmpresa
            control={control}
            name="actividad"
            label="Actividad económica"
            placeholder="Ej. Transporte de carga, Manufactura textil…"
            autoCapitalize="sentences"
            error={errors.actividad?.message}
          />

          <CampoEmpresa
            control={control}
            name="ciudad"
            label="Ciudad"
            placeholder="Bogotá"
            autoCapitalize="words"
            error={errors.ciudad?.message}
          />

          {/* ── Presentación pública ──────────────────────────────── */}
          <View className="gap-1 mt-2">
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Presentación pública
            </Text>
          </View>

          <CampoEmpresa
            control={control}
            name="descripcion"
            label="Descripción"
            placeholder="Cuéntale a los trabajadores de qué trata tu empresa…"
            autoCapitalize="sentences"
            multiline
            numberOfLines={4}
            error={errors.descripcion?.message}
          />

          {/* ── Ciclo de pago de nómina ──────────────────────────── */}
          <SeccionOpciones
            control={control}
            name="tipo_liquidacion"
            title="Ciclo de nómina"
            description="Determina cómo se crean automáticamente los períodos de nómina por hora."
            options={TIPO_LIQUIDACION_OPTIONS}
          />

          {/* ── Régimen de contratación ───────────────────────────── */}
          <SeccionOpciones
            control={control}
            name="tipo_contrato"
            title="Régimen de contratación"
            description="Determina si la liquidación descuenta salud y pensión del pago de cada trabajador."
            options={TIPO_CONTRATO_OPTIONS}
          />

          {/* ── Cálculo de recargos ───────────────────────────────── */}
          <RecargosSection control={control} sumar={sumar} />

          {/* Acepta postulaciones */}
          <DirectorioSwitch control={control} />

          {/* Cómo calculamos los pagos */}
          <ReglasPagoLink />

          {/* Guardar */}
          <Button
            label={isSubmitting ? 'Guardando…' : 'Guardar cambios'}
            onPress={handleSubmit(onSubmit)}
            loading={isSubmitting}
            disabled={!isDirty}
            fullWidth
            size="lg"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
