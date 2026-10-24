/**
 * Detalle del trabajador — vista + edición (admin) + desactivar (admin).
 *
 * Roles:
 *   admin_empresa → puede editar, desactivar y calificar turnos
 *   jefe_turnos   → puede calificar turnos (solo lectura para datos del trabajador)
 *   jefe_nomina   → edita la ficha (nómina y turnos); el sueldo y la hora de entrada solo en nómina; no el tipo ni los datos de pago
 *   nomina        → solo lectura
 */
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { ErrorState } from '@/components/ui/ErrorState';
import React, { useState } from 'react';
import { ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';

import { useAuthStore } from '@/features/auth/useAuthStore';
import { confirm } from '@/lib/confirmDialog';
import { useTrabajador } from '@/features/equipo/useEquipo';
import { useAsignacionesTrabajador } from '@/features/turnos/useTurnos';
import { TrabajadorForm }  from '@/features/equipo/TrabajadorForm';
import { CargosCertificadosCard } from '@/features/equipo/CargosCertificadosCard';
import { usePuntosMarcaje } from '@/features/turnos/usePuntosMarcaje';
import type { TrabajadorFormValues } from '@/features/equipo/schemas';
import type { Asignacion } from '@api-client';
import { useRoleGuard } from '@/components/RoleGuard';
import { CAMPOS_JEFE, CAMPOS_JEFE_TURNOS } from '@/features/equipo/trabajador/fichaTrabajadorUtils';
import {
  HeroTrabajador, CuentaSinActivarBanner, DatosPersonalesCard, DatosAdicionales, MarcacionCard, RankingCard,
} from '@/features/equipo/trabajador/FichaTrabajador';
import { FilaSueldo, ModalSueldo, HistorialSueldo, useEditarSueldo } from '@/features/equipo/trabajador/SueldoTrabajador';
import { TurnosRecientes } from '@/features/equipo/trabajador/TurnosRecientes';
import { BloquearOfertasButton, DesactivarButton, EliminarButton } from '@/features/equipo/trabajador/AccionesTrabajador';
import { useGuardarFicha } from '@/features/equipo/trabajador/useGuardarFicha';

// ── Screen ────────────────────────────────────────────────────────────────

export default function TrabajadorDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const numId   = Number(id);
  const usuario = useAuthStore((s) => s.usuario);
  const isAdmin  = usuario?.rol === 'admin_empresa';
  const canRate  = usuario?.rol === 'admin_empresa' || usuario?.rol === 'jefe_turnos';

  const [editing, setEditing] = useState(false);
  const [formDirty, setFormDirty] = useState(false);

  const { data: t, isLoading, isError, error, refetch } = useTrabajador(numId);
  const { data: puntosMarcaje = [] } = usePuntosMarcaje(isAdmin && t?.tipo !== 'turnos');
  const handleUpdate = useGuardarFicha(numId, t, isAdmin, () => setEditing(false));
  const puedeVerSalario = isAdmin || usuario?.rol === 'jefe_nomina';
  const canEditSalario = isAdmin || (usuario?.rol === 'jefe_nomina' && (t?.tipo === 'nomina' || t?.tipo === 'ambos'));
  const sueldo = useEditarSueldo(numId, t);

  // Turnos recientes del trabajador (solo para roles que pueden ver asignaciones)
  const showTurnos = canRate || isAdmin;
  const { data: asignacionesData } = useAsignacionesTrabajador(
    showTurnos ? numId : null,
    { limit: 10 },
  );
  const turnosRecientes = (asignacionesData?.data ?? [])
    .filter((a) => a.estado === 'completado' || a.estado === 'no_presentado')
    .slice(0, 5);

  const denied = useRoleGuard(['admin_empresa', 'jefe_turnos', 'jefe_nomina', 'nomina']);
  if (denied) return denied;

  // ── Header right button (edit toggle) ────────────────────────────────

  async function toggleEditing() {
    if (editing && formDirty) {
      const ok = await confirm({
        title: '¿Descartar cambios?',
        message: 'Vas a perder lo que editaste en este formulario.',
        cancelLabel: 'Seguir editando',
        confirmLabel: 'Descartar',
        destructive: true,
      });
      if (ok) { setFormDirty(false); setEditing(false); }
      return;
    }
    setEditing((v) => !v);
  }

  const puedeEditarFicha = isAdmin || usuario?.rol === 'jefe_nomina';
  const headerRight = puedeEditarFicha && t && t.activo
    ? () => (
        <Pressable
          onPress={toggleEditing}
          hitSlop={10}
          className="pr-1"
        >
          <Text className="text-primary font-semibold text-sm">
            {editing ? 'Cancelar' : 'Editar'}
          </Text>
        </Pressable>
      )
    : undefined;

  // ── Loading / Error states ────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <Stack.Screen options={{ title: 'Trabajador', headerShown: true, headerRight }} />
        <SkeletonDetail style={{ paddingHorizontal: 16, paddingTop: 12 }} />
      </SafeAreaView>
    );
  }

  if (isError || !t) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-8" edges={['bottom']}>
        <Stack.Screen options={{ title: 'Trabajador', headerShown: true }} />
        <ErrorState error={error} onRetry={refetch} fallback="No se pudo cargar" />
      </SafeAreaView>
    );
  }

  // ── Edit mode ─────────────────────────────────────────────────────────

  if (editing) {
    const defaults: Partial<TrabajadorFormValues> = {
      nombre:       t.nombre,
      apellido:     t.apellido,
      tipo:         t.tipo,
      cedula:       t.cedula       ?? '',
      tipo_documento: t.tipo_documento ?? '',
      fecha_nacimiento: t.fecha_nacimiento?.slice(0, 10) ?? '',
      sexo:         t.sexo ?? '',
      email:        t.email        ?? '',
      telefono:     t.telefono     ?? '',
      direccion:    t.direccion    ?? '',
      contacto_emergencia_nombre: t.contacto_emergencia_nombre ?? '',
      contacto_emergencia_tel:    t.contacto_emergencia_tel    ?? '',
      cargo:        t.cargo        ?? '',
      tarifa_hora:  t.tarifa_hora  ?? undefined,
      salario_base: t.salario_base ?? undefined,
      hora_entrada_esperada: t.hora_entrada_esperada?.slice(0, 5) ?? '',
      eps:          t.eps          ?? '',
      afp:          t.afp          ?? '',
      banco:        t.banco        ?? '',
      tipo_cuenta:  t.tipo_cuenta  ?? '',
      numero_cuenta: t.numero_cuenta ?? '',
      ant_judiciales_fecha:     t.ant_judiciales_fecha?.slice(0, 10)     ?? '',
      ant_disciplinarios_fecha: t.ant_disciplinarios_fecha?.slice(0, 10) ?? '',
    };
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <Stack.Screen
          options={{
            title: 'Editar trabajador',
            headerShown: true,
            headerRight,
          }}
        />
        <TrabajadorForm
          defaultValues={defaults}
          onSubmit={handleUpdate}
          submitLabel="Guardar cambios"
          soloCampos={isAdmin ? undefined : t.tipo === 'turnos' ? CAMPOS_JEFE_TURNOS : CAMPOS_JEFE}
          submittingLabel="Guardando…"
          onDirtyChange={setFormDirty}
        />
      </SafeAreaView>
    );
  }

  // ── Detail view ───────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen
        options={{
          title: `${t.apellido}, ${t.nombre}`,
          headerShown: true,
          animation: 'slide_from_right',
          headerRight,
        }}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero + Sobre mí */}
        <HeroTrabajador t={t} />

        {/* Pending activation banner — shown to admin when worker hasn't set up login yet */}
        {isAdmin && t.usuario_id === null && <CuentaSinActivarBanner t={t} />}

        {/* Info card */}
        <DatosPersonalesCard t={t} />

        {/* Sueldo — jefe_nomina y admin pueden cambiarlo */}
        {canEditSalario && t.activo && <FilaSueldo onEditar={sueldo.abrirSalario} />}

        <DatosAdicionales t={t} />

        {/* Marcación — admin, solo trabajadores de nómina/ambos */}
        {isAdmin && t.tipo !== 'turnos' && <MarcacionCard t={t} puntos={puntosMarcaje} />}

        {/* Ranking card */}
        <RankingCard t={t} />

        {/* Cargos certificados — solo si ya activó su cuenta (existe el vínculo trabajador_empresa) */}
        {canRate && t.usuario_id !== null && (
          <CargosCertificadosCard trabajadorId={t.id} nombre={t.nombre} />
        )}

        {/* Turnos recientes — visible para gestores que pueden calificar */}
        {showTurnos && turnosRecientes.length > 0 && (
          <TurnosRecientes turnos={turnosRecientes as Asignacion[]} canRate={canRate} />
        )}

        {/* Dejar de ofrecerle turnos — admin_empresa + jefe_turnos, solo tipo turnos/ambos */}
        {canRate && t.activo && (t.tipo === 'turnos' || t.tipo === 'ambos') && <BloquearOfertasButton t={t} />}

        {/* Desactivar button — admin only, active workers */}
        {isAdmin && t.activo && <DesactivarButton t={t} />}

        {/* Eliminar button — admin only, once deactivated */}
        {isAdmin && !t.activo && <EliminarButton t={t} />}

        <HistorialSueldo numId={numId} habilitado={puedeVerSalario} />
      </ScrollView>

      <ModalSueldo e={sueldo} />
    </SafeAreaView>
  );
}
