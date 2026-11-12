import React from 'react';
import { View, Switch } from 'react-native';
import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import { Text } from '@/components/ui/Text';
import { COLORS } from '@/lib/designTokens';
import { useTheme } from '@/lib/theme';
import { CampoEmpresa } from './CampoEmpresa';
import type { FormData } from './miEmpresaForm';

/**
 * Interruptor "Agrupar turnos" (usa_grupos_turno) y, si está encendido, cómo llama la empresa a
 * un grupo (etiqueta_grupo: "Evento", "Obra"…). Cada admin decide por su empresa.
 */
export function GruposTurnoSection({ control, usa, errors }: {
  control: Control<FormData>;
  usa: boolean;
  errors: FieldErrors<FormData>;
}) {
  const theme = useTheme();
  return (
    <View className="gap-3">
      <View className="bg-card border border-border rounded-2xl px-5 py-4 flex-row items-center justify-between">
        <View className="flex-1 mr-4">
          <Text className="text-sm font-semibold text-foreground">Agrupar turnos</Text>
          <Text className="text-xs text-muted-foreground mt-0.5">
            Une turnos de distintos días bajo un mismo nombre: una feria, una obra, un proyecto
          </Text>
        </View>
        <Controller
          control={control}
          name="usa_grupos_turno"
          render={({ field: { onChange, value } }) => (
            <Switch
              value={value}
              onValueChange={onChange}
              trackColor={{ true: theme.primary }}
              thumbColor={COLORS.white}
              accessibilityLabel="Agrupar turnos"
            />
          )}
        />
      </View>

      {usa ? (
        <CampoEmpresa
          control={control}
          name="etiqueta_grupo"
          label="¿Cómo los llamas?"
          placeholder="Grupo"
          hint="Por ejemplo: Evento, Obra o Proyecto. Si lo dejas vacío se llama «Grupo»."
          maxLength={40}
          autoCapitalize="sentences"
          error={errors.etiqueta_grupo?.message}
        />
      ) : (
        <Text className="text-xs text-muted-foreground px-1">
          Si ya tenías grupos, se conservan: al volver a activarlos todo sigue ahí.
        </Text>
      )}
    </View>
  );
}
