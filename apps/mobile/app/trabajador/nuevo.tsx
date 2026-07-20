import React, { useState } from 'react';
import { Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';

import { useCrearTrabajador } from '@/features/equipo/useEquipo';
import { StepIndicator } from '@/features/equipo/perfil/StepIndicator';
import { Step1DatosPersonales } from '@/features/equipo/perfil/Step1DatosPersonales';
import { Step2SeguridadSocial } from '@/features/equipo/perfil/Step2SeguridadSocial';
import { Step3Documentos } from '@/features/equipo/perfil/Step3Documentos';
import { Step4Empresas } from '@/features/equipo/perfil/Step4Empresas';
import { INITIAL } from '@/features/equipo/perfil/types';
import { buildFecha, buildMesAnio } from '@/features/equipo/perfil/utils';
import type { WizardData } from '@/features/equipo/perfil/types';
import { useRoleGuard } from '@/components/RoleGuard';
import { useConfirmDiscard } from '@/lib/useConfirmDiscard';

export default function NuevoTrabajadorScreen() {
  const router = useRouter();
  const { mutateAsync, isSuccess } = useCrearTrabajador();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>(INITIAL);

  const allowLeave = useConfirmDiscard(!isSuccess && JSON.stringify(data) !== JSON.stringify(INITIAL));

  const denied = useRoleGuard(['admin_empresa', 'jefe_turnos', 'jefe_nomina']);
  if (denied) return denied;

  const isNomina = data.tipo === 'nomina';
  const totalSteps = isNomina ? 3 : 4;

  const patch = (p: Partial<WizardData>) => setData((prev) => ({ ...prev, ...p }));

  const handleCreate = async () => {
    try {
      const t = await mutateAsync({
        nombre:   data.nombre,
        apellido: data.apellido,
        tipo:     data.tipo,
        tipo_documento: data.tipo_documento,
        cedula:   data.cedula   || undefined,
        fecha_nacimiento: buildFecha(data.nac_d, data.nac_m, data.nac_a) ?? undefined,
        sexo:     data.sexo     || undefined,
        telefono: data.telefono || undefined,
        email:    data.email    || undefined,
        contacto_emergencia_nombre: data.emergencia_nombre || undefined,
        contacto_emergencia_tel:    data.emergencia_tel    || undefined,
        eps:          data.eps          || undefined,
        afp:          data.afp          || undefined,
        banco:        data.banco        || undefined,
        tipo_cuenta:  data.tipo_cuenta  || undefined,
        numero_cuenta: data.numero_cuenta || undefined,
        tarifa_hora:  data.tarifa_hora  ? parseFloat(data.tarifa_hora)  : undefined,
        salario_base: data.salario_base ? parseFloat(data.salario_base) : undefined,
        ant_judiciales_fecha:    buildFecha(data.antj_d, data.antj_m, data.antj_a) ?? undefined,
        ant_disciplinarios_fecha: buildFecha(data.antd_d, data.antd_m, data.antd_a) ?? undefined,
        experiencias: data.experiencias.map((e) => ({
          empresa_nombre: e.empresa_nombre,
          cargo:          e.cargo,
          fecha_inicio:   buildMesAnio(e.inicio_m, e.inicio_a) ?? `${e.inicio_a}-${e.inicio_m.padStart(2, '0')}-01`,
          fecha_fin:      (e.fin_m && e.fin_a) ? buildMesAnio(e.fin_m, e.fin_a) : null,
        })),
        diplomas: data.diplomas.map((d) => ({
          titulo:      d.titulo,
          institucion: d.institucion,
          anio:        d.anio ? parseInt(d.anio, 10) : null,
        })),
        empresa_ids: data.empresa_ids.length ? data.empresa_ids : undefined,
        cargo_ids: data.cargo_ids.length ? data.cargo_ids : undefined,
      });
      allowLeave();
      router.replace(`/trabajador/${t.id}`);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Ocurrió un error. Intenta de nuevo.';
      Alert.alert('Error al crear', msg);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Nuevo trabajador',
          headerShown: true,
          headerBackTitle: 'Equipo',
          animation: 'slide_from_right',
        }}
      />
      <StepIndicator current={step} total={totalSteps} />
      {step === 1 && (
        <Step1DatosPersonales data={data} onChange={patch} onNext={() => setStep(2)} />
      )}
      {step === 2 && (
        <Step2SeguridadSocial data={data} onChange={patch} onBack={() => setStep(1)} onNext={() => setStep(3)} />
      )}
      {step === 3 && (
        <Step3Documentos
          data={data}
          onChange={patch}
          onBack={() => setStep(2)}
          onNext={() => (isNomina ? handleCreate() : setStep(4))}
        />
      )}
      {step === 4 && (
        <Step4Empresas data={data} onChange={patch} onBack={() => setStep(3)} onSubmit={handleCreate} />
      )}
    </SafeAreaView>
  );
}
