import React from 'react';
import { View, Pressable, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Spinner } from '@/components/ui/Spinner';
import { COLORS } from '@/lib/designTokens';
import { showAlert } from '@/lib/alertDialog';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { useActualizarExtras } from '@/features/nomina/useNomina';
import type { ApiError } from '@api-client';
import { useRouter } from 'expo-router';
import { SectionHeader } from './PerfilUi';

/** "Mi nómina" del trabajador de nómina: su información laboral y la opción de recibir turnos extra. */
export function MiNominaCard({ nominaPerfil }: { nominaPerfil: { acepta_extras?: boolean | number } | undefined }) {
  const router = useRouter();
  const theme  = useTheme();
  const actualizarExtrasMutation = useActualizarExtras();

  const handleToggleExtras = (val: boolean) => {
    actualizarExtrasMutation.mutate(val, {
      onError: (err) => showAlert('Error', (err as ApiError).message ?? t('common.error')),
    });
  };

  return (
  <>
    <SectionHeader title="Mi nómina" />
    <View className="mx-5 bg-card rounded-2xl border border-border overflow-hidden">
      <Pressable
        onPress={() => router.push('/mi-perfil-laboral')}
        className="px-5 py-4 flex-row items-center justify-between active:opacity-70"
      >
        <View className="flex-row items-center gap-3">
          <Ionicons name="id-card-outline" size={16} color={COLORS.mutedForeground} />
          <Text className="text-sm font-medium text-foreground">Mi información laboral</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={COLORS.placeholder} />
      </Pressable>

      {/* Toggle acepta_extras */}
      <View className="border-t border-border px-5 py-4 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3 flex-1 mr-3">
          <Ionicons name="briefcase-outline" size={16} color={COLORS.mutedForeground} />
          <View className="flex-1">
            <Text className="text-sm font-medium text-foreground">Turnos extra</Text>
            <Text className="text-xs text-muted-foreground mt-0.5">
              Recibe ofertas de turnos adicionales fuera de tu jornada
            </Text>
          </View>
        </View>
        {actualizarExtrasMutation.isPending ? (
          <Spinner size="small" color={theme.primary} />
        ) : (
          <Switch
            value={Boolean(nominaPerfil?.acepta_extras)}
            onValueChange={handleToggleExtras}
            trackColor={{ false: COLORS.border, true: theme.primary }}
            thumbColor={COLORS.white}
          />
        )}
      </View>

      {/* Mis postulaciones — only if acepta_extras */}
      {nominaPerfil?.acepta_extras && (
        <Pressable
          onPress={() => router.push('/mis-postulaciones')}
          className="border-t border-border px-5 py-4 flex-row items-center justify-between active:opacity-70"
        >
          <View className="flex-row items-center gap-3">
            <Ionicons name="list-outline" size={16} color={COLORS.mutedForeground} />
            <Text className="text-sm font-medium text-foreground">Mis postulaciones extra</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={COLORS.placeholder} />
        </Pressable>
      )}
    </View>
  </>
  );
}
