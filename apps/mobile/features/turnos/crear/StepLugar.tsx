import { Text, TextInput } from '@/components/ui/Text';
import { COLORS } from '@/lib/designTokens';
import React from 'react';
import { View, ScrollView, Switch } from 'react-native';

import { useTheme }    from '@/lib/theme';
import { Button }      from '@/components/ui/Button';
import { LugarInput }  from './LugarInput';
import { LugarAlias }  from './LugarAlias';
import { lugarEsDelGrupo } from '@/features/grupos/grupoUtils';
import type { WizardData } from './types';

type Props = {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
};

/**
 * Paso «Lugar»: dónde es el turno (dirección, nombre corto y, si es el caso, ubicación libre) y a quién buscar al
 * llegar. Va aparte del paso 1 porque el lugar, con su nombre corto y la biblioteca, hacía el formulario larguísimo.
 * Nada de esto es obligatorio: se puede seguir sin lugar (el servidor ya lo aceptaba así).
 */
export function StepLugar({ data, onChange, onNext, onBack }: Props) {
  const theme = useTheme();

  return (
    <ScrollView
      contentContainerClassName="px-5 py-4 gap-5 pb-10"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View className="flex-row items-center justify-between bg-muted rounded-2xl px-4 py-3">
        <View className="flex-1 mr-4">
          <Text className="text-sm font-semibold text-foreground">Ubicación libre</Text>
          <Text className="text-xs text-muted-foreground mt-0.5">
            El trabajador podrá marcar entrada y salida desde cualquier lugar — para turnos sin un punto fijo (rutas, entregas, mandados).
          </Text>
        </View>
        <Switch
          value={data.ubicacion_libre}
          onValueChange={(v) => onChange({ ubicacion_libre: v })}
          trackColor={{ true: theme.primary }}
          thumbColor={COLORS.white}
        />
      </View>

      <View className="gap-1.5">
        <Text className="text-sm font-semibold text-foreground">
          Lugar{data.ubicacion_libre ? ' (opcional)' : ''}
        </Text>
        <LugarInput
          value={data.lugar}
          latitud={data.latitud}
          longitud={data.longitud}
          // Elegir otro lugar (con coordenadas: buscador, biblioteca, GPS o mapa) deja sin efecto el nombre corto del anterior.
          onChange={(lugar, lat, lng) => onChange({ lugar, latitud: lat, longitud: lng, ...(lat != null && lugar !== data.lugar ? { lugar_alias: '' } : {}) })}
        />
        <LugarAlias lugar={data.lugar} latitud={data.latitud} longitud={data.longitud} alias={data.lugar_alias} onChange={(lugar_alias) => onChange({ lugar_alias })} />
        {lugarEsDelGrupo(data) && (
          <Text className="text-xs text-muted-foreground">{`Tomado de «${data.grupo!.nombre}». Puedes cambiarlo.`}</Text>
        )}
      </View>

      <View className="gap-1.5">
        <Text className="text-sm font-semibold text-foreground">Encargado en el punto</Text>
        <Text className="text-xs text-muted-foreground -mt-1">
          A quién debe buscar o llamar el trabajador al llegar (opcional)
        </Text>
        <TextInput
          className="bg-muted rounded-2xl px-4 py-3 text-base text-foreground"
          placeholder="Nombre del encargado"
          placeholderTextColor={COLORS.placeholder}
          value={data.encargado_nombre}
          onChangeText={(t) => onChange({ encargado_nombre: t })}
          returnKeyType="next"
        />
        <TextInput
          className="bg-muted rounded-2xl px-4 py-3 text-base text-foreground"
          placeholder="Teléfono del encargado"
          placeholderTextColor={COLORS.placeholder}
          value={data.encargado_telefono}
          onChangeText={(t) => onChange({ encargado_telefono: t })}
          keyboardType="phone-pad"
        />
      </View>

      <View className="flex-row gap-3">
        <Button label="← Atrás" variant="secondary" onPress={onBack} style={{ flex: 1 }} />
        <Button label="Siguiente →" variant="primary" onPress={onNext} style={{ flex: 2 }} />
      </View>
    </ScrollView>
  );
}
