import { SkeletonDetail } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { COLORS } from '@/lib/designTokens';
import { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { turnoYaInicio } from '@/features/turnos/turnosUtils';
import { bogotaToday } from '@/lib/formatters';
import { useOferta, useMisTurnos } from '@/features/turnos/useTurnos';
import { TurnosExtraOptIn, esErrorTurnosExtraApagadas } from '@/features/nomina/TurnosExtraOptIn';
import { ApiError } from '@api-client';
import { EncabezadoOferta } from '@/features/turnos/oferta/EncabezadoOferta';
import { InfoOfertaCard } from '@/features/turnos/oferta/InfoOfertaCard';
import { DescripcionOferta } from '@/features/turnos/oferta/DescripcionOferta';
import { PuestosCard } from '@/features/turnos/oferta/PuestosCard';
import { AplicarOfertaCta } from '@/features/turnos/oferta/AplicarOfertaCta';
import { PostulantesCard } from '@/features/turnos/oferta/PostulantesCard';
import { BarraAccionesGestor } from '@/features/turnos/oferta/BarraAccionesGestor';

// ── Screen ────────────────────────────────────────────────────────────────

export default function OfertaDetailScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id     = idParam ? Number(idParam) : null;
  const rol   = useAuthStore((s) => s.usuario?.rol);

  const isGestor = rol === 'admin_empresa' || rol === 'jefe_turnos' || rol === 'jefe_nomina';
  const isWorker = rol === 'trabajador_turnos' || rol === 'trabajador_nomina';
  // jefe_nomina ve la oferta y sus postulantes, pero no la gestiona.
  const puedeGestionar = rol === 'admin_empresa' || rol === 'jefe_turnos';
  // Backend restringe cancelar oferta a admin_empresa/jefe_turnos (no jefe_nomina).
  const puedeCancelarOferta = rol === 'admin_empresa' || rol === 'jefe_turnos';

  const { data: oferta, isLoading, error } = useOferta(id);
  const { data: misTurnos }         = useMisTurnos({ enabled: isWorker });
  const esPasado      = oferta ? oferta.fecha < bogotaToday() : false;
  const turnoIniciado = oferta ? turnoYaInicio(oferta.fecha, oferta.hora_inicio) : false;
  // esPasado solo compara el día — un turno de hoy con hora de inicio ya
  // pasada seguía aceptando postulaciones. El backend valida lo mismo en
  // OfertasService.aplicar().
  const yaNoSePuedePostular = esPasado || turnoIniciado;

  // El backend solo permite editar mientras la oferta sigue 'abierta' o 'borrador'.
  const ofertaEsEditable = oferta?.estado === 'abierta' || oferta?.estado === 'borrador';

  const miAsignacion = isWorker
    ? (misTurnos ?? []).find((a) => a.oferta_id === id)
    : undefined;
  const yaAplicado = !!miAsignacion;
  // Mientras sigue 'pendiente', el puesto puede llenarse con otros postulantes
  // antes de que el gestor te confirme — igual se mantiene tu postulación por
  // si alguien cancela o el gestor amplía las plazas.
  const miPuesto = oferta?.puestos.find((p) => p.id === miAsignacion?.puesto_id);
  const miCupoLleno = !!miPuesto && miPuesto.plazas_cubiertas >= miPuesto.plazas;

  const availablePuestos = oferta?.puestos.filter((p) => p.plazas_cubiertas < p.plazas) ?? [];
  const [selectedPuestoId, setSelectedPuestoId] = useState<number | null>(null);
  const selectedPuesto = availablePuestos.find((p) => p.id === selectedPuestoId) ?? availablePuestos[0];

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <Stack.Screen options={{ title: 'Detalle del turno', headerShown: true }} />
        <SkeletonDetail style={{ paddingHorizontal: 16, paddingTop: 12 }} />
      </SafeAreaView>
    );
  }

  if (!oferta) {
    const apiErr = error instanceof ApiError ? error : null;
    const esExtrasApagadas = esErrorTurnosExtraApagadas(error);
    const esDelayRanking   = apiErr?.status === 403 && apiErr.message.includes('ranking');
    const esNoEncontrada   = apiErr?.status === 404;

    return (
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <Stack.Screen options={{ title: 'Detalle del turno', headerShown: true }} />
        {esExtrasApagadas ? (
          <TurnosExtraOptIn />
        ) : (
          <View className="flex-1 items-center justify-center gap-4 px-6">
            <Ionicons name="search-outline" size={48} color={COLORS.placeholder} />
            <Text className="text-base font-semibold text-foreground text-center">
              {esDelayRanking
                ? 'Este turno aún no está disponible para tu nivel de calificación'
                : esNoEncontrada
                  ? 'Este turno ya no está disponible'
                  : 'Turno no encontrado'}
            </Text>
          </View>
        )}
      </SafeAreaView>
    );
  }

  return (
    <>
      <EncabezadoOferta oferta={oferta} puedeGestionar={puedeGestionar} ofertaEsEditable={ofertaEsEditable} />

      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <ScrollView className="flex-1" contentContainerClassName="px-5 py-5 gap-4 pb-12" showsVerticalScrollIndicator={false}>

          {/* ── Info principal ──────────────────────────────────── */}
          <InfoOfertaCard
            oferta={oferta}
            esPasado={esPasado}
            puedeGestionar={puedeGestionar}
            ofertaEsEditable={ofertaEsEditable}
          />

          {/* ── Falta marcar completada: el turno ya terminó, todos resueltos, nadie le dio Completar ── */}
          {puedeGestionar && oferta.necesita_completar && (
            <View className="bg-warning-light rounded-2xl px-4 py-3 flex-row items-center gap-3">
              <Ionicons name="warning-outline" size={20} color={COLORS.warningText} />
              <Text className="flex-1 text-sm font-medium text-warning">
                Este turno ya terminó y todos quedaron resueltos, pero nadie lo marcó como completado.
              </Text>
            </View>
          )}

          {/* ── Descripción y detalles adicionales ──────────────── */}
          <DescripcionOferta descripcion={oferta.descripcion} notas={oferta.notas_adicionales} />

          {/* ── Puestos / cargos ─────────────────────────────────── */}
          <PuestosCard
            puestos={oferta.puestos}
            isWorker={isWorker}
            yaAplicado={yaAplicado}
            yaNoSePuedePostular={yaNoSePuedePostular}
            availablePuestos={availablePuestos}
            selectedPuesto={selectedPuesto}
            onSelect={setSelectedPuestoId}
          />

          {/* ── CTA trabajador: Aplicar ──────────────────────────── */}
          {isWorker && (
            <AplicarOfertaCta
              id={id}
              esPasado={esPasado}
              turnoIniciado={turnoIniciado}
              yaAplicado={yaAplicado}
              miAsignacion={miAsignacion}
              miCupoLleno={miCupoLleno}
              selectedPuesto={selectedPuesto}
            />
          )}

          {/* ── Postulantes (gestores) ───────────────────────────── */}
          {isGestor && (
            <PostulantesCard
              oferta={oferta}
              esPasado={esPasado}
              turnoIniciado={turnoIniciado}
              puedeGestionar={puedeGestionar}
            />
          )}

        </ScrollView>

        <BarraAccionesGestor
          oferta={oferta}
          puedeGestionar={puedeGestionar}
          puedeCancelarOferta={puedeCancelarOferta}
          turnoIniciado={turnoIniciado}
        />
      </SafeAreaView>
    </>
  );
}
