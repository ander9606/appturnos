/**
 * Perfil — Tab "Perfil"
 *
 * Permite al usuario:
 * - Ver y editar sus datos personales (nombre, apellido, email)
 * - Cambiar su contraseña
 * - Cerrar sesión
 */
import React from 'react';
import { ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { useNominaPerfil } from '@/features/nomina/useNomina';
import { PerfilCabecera } from '@/features/perfil/PerfilCabecera';
import { InfoPersonalSection } from '@/features/perfil/InfoPersonalSection';
import { SeguridadSection } from '@/features/perfil/SeguridadSection';
import { CuentaCard, AusenciasCard, LegalCard } from '@/features/perfil/TarjetasPerfil';
import { MiNominaCard } from '@/features/perfil/MiNominaCard';
import { CerrarSesionButton, ZonaPeligroSection } from '@/features/perfil/SesionSection';

export default function PerfilScreen() {
  const usuario = useAuthStore((s) => s.usuario);
  const isTrabajadorTurnos = usuario?.rol === 'trabajador_turnos';
  const isTrabajadorNomina = usuario?.rol === 'trabajador_nomina';

  const { data: nominaPerfil } = useNominaPerfil(isTrabajadorNomina);

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
          <PerfilCabecera />
          <InfoPersonalSection />
          <SeguridadSection />
          <CuentaCard rol={usuario?.rol} />

          {isTrabajadorNomina && <MiNominaCard nominaPerfil={nominaPerfil} />}

          {(isTrabajadorTurnos || isTrabajadorNomina) && <AusenciasCard isTrabajadorTurnos={isTrabajadorTurnos} />}

          <LegalCard />
          <CerrarSesionButton />
          <ZonaPeligroSection />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
