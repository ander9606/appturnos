import React, { useState, useCallback } from 'react';
import { KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme }        from '@/lib/theme';
import { useCrearOferta }  from '@/features/turnos/useTurnos';
import { StepIndicator }   from '@/features/turnos/crear/StepIndicator';
import { Step1Basicos }    from '@/features/turnos/crear/Step1Basicos';
import { Step2Puestos }    from '@/features/turnos/crear/Step2Puestos';
import { Step3Revisar }    from '@/features/turnos/crear/Step3Revisar';
import { buildFecha, buildTime } from '@/features/turnos/crear/utils';
import { INITIAL }         from '@/features/turnos/crear/types';
import { ApiError }        from '@api-client';
import { useConfirmDiscard } from '@/lib/useConfirmDiscard';
import { useRoleGuard } from '@/components/RoleGuard';
import { showToast } from '@/lib/toast';
import type { WizardData } from '@/features/turnos/crear/types';

const TITLES = ['Información básica', 'Roles y tarifas', 'Revisar y publicar'];

export default function NuevoTurnoScreen() {
  const router  = useRouter();
  const theme   = useTheme();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [data, setData] = useState<WizardData>(INITIAL);

  const crearMutation = useCrearOferta();

  const allowNextLeave = useConfirmDiscard(
    !crearMutation.isSuccess && JSON.stringify(data) !== JSON.stringify(INITIAL)
  );

  const patch = useCallback((p: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...p }));
  }, []);

  const denied = useRoleGuard(['admin_empresa', 'jefe_turnos', 'jefe_nomina']);
  if (denied) return denied;

  const handlePublish = async () => {
    const payload = {
      titulo:            data.titulo.trim(),
      descripcion:       data.descripcion.trim() || undefined,
      fecha:             buildFecha(data),
      hora_inicio:       buildTime(data.hora_inicio!),
      hora_fin_estimada: data.hora_fin ? buildTime(data.hora_fin) : undefined,
      lugar:             data.lugar.trim() || undefined,
      latitud:           data.latitud ?? undefined,
      longitud:          data.longitud ?? undefined,
      encargado_nombre:   data.encargado_nombre.trim() || undefined,
      encargado_telefono: data.encargado_telefono.trim() || undefined,
      para_quien:        data.para_quien,
      visibilidad:       data.visibilidad,
      trabajador_ids:    data.visibilidad === 'dirigida' ? data.destinatarios.map((d) => d.id) : undefined,
      puestos:           data.puestos.map((p) => ({
        cargo_id:   p.cargo_id,
        plazas:     p.plazas,
        tarifa_dia: parseFloat(p.tarifa_dia.replace(/\./g, '').replace(',', '.')) || 0,
      })),
    };

    try {
      const oferta = await crearMutation.mutateAsync(payload);
      const aviso = data.visibilidad === 'dirigida'
        ? `Se notificó a ${data.destinatarios.length} persona${data.destinatarios.length !== 1 ? 's' : ''}.`
        : 'Los trabajadores con los cargos seleccionados recibirán una notificación.';
      showToast(`¡"${payload.titulo}" publicado! ${aviso}`);
      if (oferta.advertencias && oferta.advertencias.length > 0) {
        Alert.alert('Puede que falte personal', oferta.advertencias.join('\n\n'));
      }
      // No navega sola: el botón pasa a "Cerrar" para que quede claro que
      // ya se publicó, en vez de cerrar la pantalla de golpe tras la espera.
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'No se pudo publicar el turno.';
      Alert.alert('Error', msg);
    }
  };

  const handleClose = () => {
    allowNextLeave();
    router.back();
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: TITLES[step - 1],
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          headerBackTitle: 'Salir',
          headerTintColor: theme.primary,
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerShadowVisible: true,
        }}
      />

      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <StepIndicator current={step} />

        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={90}
        >
          {step === 1 && (
            <Step1Basicos data={data} onChange={patch} onNext={() => setStep(2)} />
          )}
          {step === 2 && (
            <Step2Puestos data={data} onChange={patch} onNext={() => setStep(3)} onBack={() => setStep(1)} />
          )}
          {step === 3 && (
            <Step3Revisar
              data={data}
              onBack={() => setStep(2)}
              onPublish={handlePublish}
              isPublishing={crearMutation.isPending}
              isPublished={crearMutation.isSuccess}
              onClose={handleClose}
            />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}
