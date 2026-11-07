import React, { useState } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ApiError, esAvisoCierre } from '@api-client';
import { useRoleGuard } from '@/components/RoleGuard';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { showAlert } from '@/lib/alertDialog';
import { actionSheet } from '@/lib/actionSheet';
import { confirm } from '@/lib/confirmDialog';
import { COLORS } from '@/lib/designTokens';
import { DuplicarOfertaModal } from '@/features/turnos/oferta/DuplicarOfertaModal';
import { FaseChip } from '@/features/grupos/FaseGrupo';
import { FilaTurno } from '@/features/grupos/FilaTurno';
import { EditarGrupoModal } from '@/features/grupos/EditarGrupoModal';
import { useOpcionesGrupos } from '@/features/empresas/useOpcionesGrupos';
import { rangoDeFechas, resumenPlazas, ultimoTurnoCopiable } from '@/features/grupos/grupoUtils';
import { useCambiarEstadoGrupo, useGrupo } from '@/features/grupos/useGrupos';

/** Detalle de un grupo: sus datos, sus turnos por fecha y las acciones rápidas (agregar, duplicar, cerrar). */
export default function GrupoDetalleScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const grupoId = Number(id);
  const grupo = useGrupo(grupoId);
  const cambiarEstado = useCambiarEstadoGrupo();
  const [duplicando, setDuplicando] = useState(false);
  const [editando, setEditando] = useState(false);
  const { etiqueta } = useOpcionesGrupos();
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
        title: `Cerrar ${etiqueta.toLowerCase()}`,
        message: `«${g.nombre}» saldrá de la lista de activos y ya no se podrán agregar turnos. Puedes reabrir cuando quieras.`,
        confirmLabel: 'Cerrar',
      });
      if (!ok) return;
    }
    try {
      await cambiarEstado.mutateAsync({ id: g.id, cerrar });
    } catch (err) {
      // Turnos terminados sin contrato firmado: no es un error, es un aviso. Si el usuario insiste, se cierra igual.
      if (cerrar && esAvisoCierre(err)) {
        const seguir = await confirm({
          title: 'Hay pagos frenados',
          message: err.message,
          confirmLabel: 'Cerrar de todos modos',
        });
        if (!seguir) return;
        try {
          await cambiarEstado.mutateAsync({ id: g.id, cerrar: true, confirmar: true });
        } catch (err2) {
          showAlert('No se pudo completar', err2 instanceof ApiError ? err2.message : 'Inténtalo de nuevo.');
        }
        return;
      }
      // Un 409 trae el motivo ("tiene turnos sin terminar…"): se muestra tal cual.
      showAlert('No se pudo completar', err instanceof ApiError ? err.message : 'Inténtalo de nuevo.');
    }
  }

  async function abrirMenu() {
    if (!g) return;
    const nombre = etiqueta.toLowerCase();
    const eleccion = await actionSheet({
      title: g.nombre,
      items: [
        { key: 'editar', label: 'Editar', icon: 'create-outline' },
        ...(!cerrado && ultimo ? [{ key: 'duplicar', label: 'Duplicar último turno', icon: 'copy-outline' as const }] : []),
        { key: 'estado', label: `${cerrado ? 'Reabrir' : 'Cerrar'} ${nombre}`, icon: cerrado ? 'lock-open-outline' : 'lock-closed-outline' },
      ],
    });
    if (eleccion === 'editar') setEditando(true);
    else if (eleccion === 'duplicar') setDuplicando(true);
    else if (eleccion === 'estado') await alternarEstado();
  }

  const plazas = g ? resumenPlazas(g.turnos) : null;

  return (
    <>
      <Stack.Screen
        options={{
          title: g?.nombre ?? etiqueta,
          headerTintColor: COLORS.primary,
          // Las acciones secundarias (editar, duplicar, cerrar) van en este menú; la principal, «Agregar turno», junto a la lista.
          headerRight: g ? () => (
            <TouchableOpacity onPress={abrirMenu} hitSlop={10} accessibilityRole="button" accessibilityLabel="Más opciones" style={{ marginRight: 4 }}>
              <Ionicons name="ellipsis-horizontal-circle-outline" size={26} color={COLORS.primary} />
            </TouchableOpacity>
          ) : undefined,
        }}
      />
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        {grupo.isLoading ? <SkeletonDetail style={{ padding: 16 }} /> : grupo.isError || !g ? (
          <ErrorState error={grupo.error} onRetry={grupo.refetch} fallback="No se pudo cargar la información" />
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16 }}>
            <View className="bg-card border border-border rounded-2xl p-4 gap-3">
              <View className="flex-row items-center justify-between gap-2">
                <FaseChip fase={g.fase} />
                <Text className="flex-1 text-right text-sm text-muted-foreground" numberOfLines={1}>
                  {rangoDeFechas(g) ?? 'Sin turnos todavía'}
                </Text>
              </View>
              {g.lugar ? (
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="location-outline" size={15} color={COLORS.mutedForeground} />
                  <Text className="flex-1 text-sm text-foreground">{g.lugar_alias || g.lugar}</Text>
                </View>
              ) : null}
              {g.descripcion ? <Text className="text-sm text-muted-foreground">{g.descripcion}</Text> : null}
              {plazas && plazas.turnos > 0 ? (
                <View className="flex-row border-t border-border pt-3">
                  <View className="flex-1">
                    <Text className="text-xl font-bold text-foreground">{plazas.turnos}</Text>
                    <Text className="text-xs text-muted-foreground">{plazas.turnos === 1 ? 'turno' : 'turnos'}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-xl font-bold text-foreground">{plazas.cubiertas}<Text className="text-sm font-medium text-muted-foreground"> de {plazas.plazas}</Text></Text>
                    <Text className="text-xs text-muted-foreground">plazas cubiertas</Text>
                  </View>
                </View>
              ) : null}
            </View>

            <View className="gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Turnos ({g.turnos.length})</Text>
                {!cerrado && (
                  <Button
                    label="Agregar turno"
                    size="sm"
                    icon={<Ionicons name="add" size={18} color={COLORS.white} />}
                    onPress={() => router.push({ pathname: '/turno/nuevo', params: { grupoId: String(g.id) } })}
                  />
                )}
              </View>
              {g.turnos.length === 0 ? (
                <EmptyState compact title="Todavía no hay turnos" message="Usa «Agregar turno» para crear el primero." />
              ) : (
                g.turnos.map((t) => <FilaTurno key={t.id} turno={t} onPress={() => router.push(`/oferta/${t.id}`)} />)
              )}
            </View>
          </ScrollView>
        )}
        {g && <EditarGrupoModal visible={editando} grupo={g} etiqueta={etiqueta} onClose={() => setEditando(false)} />}
        {ultimo && (
          <DuplicarOfertaModal visible={duplicando} oferta={{ id: ultimo.id, hora_inicio: ultimo.hora_inicio }} onClose={() => setDuplicando(false)} />
        )}
      </SafeAreaView>
    </>
  );
}
