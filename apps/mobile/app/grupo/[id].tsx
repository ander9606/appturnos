import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ApiError } from '@api-client';
import type { TurnoDeGrupo } from '@api-client';
import { useRoleGuard } from '@/components/RoleGuard';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { showAlert } from '@/lib/alertDialog';
import { confirm } from '@/lib/confirmDialog';
import { COLORS } from '@/lib/designTokens';
import { formatTimeRange } from '@/lib/formatters';
import { fmtDate } from '@/features/turnos/oferta/fechasOferta';
import { DuplicarOfertaModal } from '@/features/turnos/oferta/DuplicarOfertaModal';
import { FaseChip } from '@/features/grupos/FaseGrupo';
import { rangoDeFechas, subtituloGrupo, ultimoTurnoCopiable } from '@/features/grupos/grupoUtils';
import { useCambiarEstadoGrupo, useGrupo } from '@/features/grupos/useGrupos';

function FilaTurno({ turno, onPress }: { turno: TurnoDeGrupo; onPress: () => void }) {
  const cancelado = turno.estado === 'cancelada';
  const horario = turno.hora_fin_estimada ? formatTimeRange(turno.hora_inicio, turno.hora_fin_estimada) : turno.hora_inicio.slice(0, 5);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="bg-card border border-border rounded-2xl p-4 gap-1 active:opacity-70"
    >
      <Text className="text-xs font-semibold text-muted-foreground uppercase">{fmtDate(turno.fecha)}</Text>
      <Text className={`text-base font-bold ${cancelado ? 'text-muted-foreground line-through' : 'text-foreground'}`} numberOfLines={2}>
        {turno.titulo}
      </Text>
      <Text className="text-sm text-muted-foreground">
        {horario}{turno.fin_dia_siguiente ? ' (día sig.)' : ''}
        {cancelado ? ' · Cancelado' : ` · ${turno.plazas_cubiertas} de ${turno.plazas} plazas cubiertas`}
      </Text>
    </Pressable>
  );
}

/** Detalle de un grupo: sus datos, sus turnos por fecha y las acciones rápidas (agregar, duplicar, cerrar). */
export default function GrupoDetalleScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const grupoId = Number(id);
  const grupo = useGrupo(grupoId);
  const cambiarEstado = useCambiarEstadoGrupo();
  const [duplicando, setDuplicando] = useState(false);
  const denied = useRoleGuard(['admin_empresa', 'jefe_turnos']);
  if (denied) return denied;

  const g = grupo.data;
  const ultimo = g ? ultimoTurnoCopiable(g.turnos) : null;
  const cerrado = g?.estado === 'cerrado';

  async function alternarEstado() {
    if (!g) return;
    const cerrar = !cerrado;
    if (cerrar) {
      const ok = await confirm({
        title: 'Cerrar grupo',
        message: `«${g.nombre}» saldrá de la lista de activos y ya no se podrán agregarle turnos. Puedes reabrirlo cuando quieras.`,
        confirmLabel: 'Cerrar',
      });
      if (!ok) return;
    }
    try {
      await cambiarEstado.mutateAsync({ id: g.id, cerrar });
    } catch (err) {
      // Un 409 trae el motivo ("tiene turnos sin terminar…"): se muestra tal cual.
      showAlert('No se pudo completar', err instanceof ApiError ? err.message : 'Inténtalo de nuevo.');
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: g?.nombre ?? 'Grupo', headerTintColor: COLORS.primary }} />
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        {grupo.isLoading ? <SkeletonDetail style={{ padding: 16 }} /> : grupo.isError || !g ? (
          <ErrorState error={grupo.error} onRetry={grupo.refetch} fallback="No se pudo cargar el grupo" />
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 96, gap: 12 }}>
            <View className="bg-card border border-border rounded-2xl p-4 gap-2">
              <View className="flex-row items-start justify-between gap-2">
                <Text className="flex-1 text-lg font-bold text-foreground">{g.nombre}</Text>
                <FaseChip fase={g.fase} />
              </View>
              <Text className="text-sm text-muted-foreground">{rangoDeFechas(g) ? subtituloGrupo(g) : 'Sin turnos todavía'}</Text>
              {g.lugar ? (
                <View className="flex-row items-center gap-1">
                  <Ionicons name="location-outline" size={14} color={COLORS.mutedForeground} />
                  <Text className="flex-1 text-sm text-muted-foreground">{g.lugar}</Text>
                </View>
              ) : null}
              {g.descripcion ? <Text className="text-sm text-foreground">{g.descripcion}</Text> : null}
            </View>

            {!cerrado && (
              <View className="gap-2">
                <Button
                  label="Agregar turno"
                  variant="secondary"
                  fullWidth
                  onPress={() => router.push({ pathname: '/turno/nuevo', params: { grupoId: String(g.id) } })}
                />
                {ultimo && (
                  <Button label="Duplicar último turno" variant="ghost" fullWidth onPress={() => setDuplicando(true)} />
                )}
              </View>
            )}

            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-2">
              Turnos ({g.turnos.length})
            </Text>
            {g.turnos.length === 0 ? (
              <EmptyState compact title="Todavía no hay turnos" message="Usa «Agregar turno» para crear el primero." />
            ) : (
              g.turnos.map((t) => <FilaTurno key={t.id} turno={t} onPress={() => router.push(`/oferta/${t.id}`)} />)
            )}

            <Button
              label={cerrado ? 'Reabrir grupo' : 'Cerrar grupo'}
              variant={cerrado ? 'secondary' : 'ghost'}
              fullWidth
              onPress={alternarEstado}
            />
          </ScrollView>
        )}
        {ultimo && (
          <DuplicarOfertaModal visible={duplicando} oferta={{ id: ultimo.id, hora_inicio: ultimo.hora_inicio }} onClose={() => setDuplicando(false)} />
        )}
      </SafeAreaView>
    </>
  );
}
