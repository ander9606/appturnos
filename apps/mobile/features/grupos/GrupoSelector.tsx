import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { COLORS } from '@/lib/designTokens';
import { useOpcionesGrupos } from '@/features/empresas/useOpcionesGrupos';
import type { GrupoElegido } from '@/features/turnos/crear/types';
import { ElegirGrupoModal } from './ElegirGrupoModal';
import { CrearGrupoModal } from './CrearGrupoModal';
import { aElegido } from './grupoUtils';

type Props = {
  grupo: GrupoElegido | null;
  onChange: (g: GrupoElegido | null) => void;
  /** Fecha del turno (YYYY-MM-DD): el selector muestra primero los grupos de su período de facturación. */
  fecha?: string;
};

/**
 * Campo opcional "a qué grupo pertenece este turno". Solo aparece si la empresa usa grupos. Usa la
 * etiqueta de la empresa como título del campo ("Evento", "Obra"…) y textos sin artículo, para que
 * funcione igual con cualquier nombre (en español "un evento" pero "una obra").
 */
export function GrupoSelector({ grupo, onChange, fecha }: Props) {
  const { usa, etiqueta } = useOpcionesGrupos();
  const [lista, setLista] = useState(false);
  const [crear, setCrear] = useState(false);
  if (!usa) return null;

  return (
    <View className="gap-1.5">
      <Text className="text-sm font-semibold text-foreground">{etiqueta}</Text>

      {grupo ? (
        <View className="flex-row items-center gap-2 bg-primary/10 border border-primary rounded-2xl pl-4 pr-2 py-2">
          <Ionicons name="albums-outline" size={16} color={COLORS.primary} />
          <Text className="flex-1 text-sm font-semibold text-foreground" numberOfLines={1}>{grupo.nombre}</Text>
          <Pressable
            onPress={() => setLista(true)}
            accessibilityRole="button"
            accessibilityLabel={`Cambiar ${etiqueta}`}
            className="px-2 py-1.5 active:opacity-70"
          >
            <Text className="text-xs font-semibold text-primary-600">Cambiar</Text>
          </Pressable>
          <Pressable
            onPress={() => onChange(null)}
            accessibilityRole="button"
            accessibilityLabel={`Quitar ${etiqueta}`}
            className="p-1.5 active:opacity-70"
          >
            <Ionicons name="close" size={18} color={COLORS.mutedForeground} />
          </Pressable>
        </View>
      ) : (
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => setLista(true)}
            accessibilityRole="button"
            accessibilityLabel={`Elegir ${etiqueta}`}
            className="flex-1 bg-muted rounded-2xl px-4 py-3 flex-row items-center justify-between active:opacity-70"
          >
            <Text className="text-base text-muted-foreground">Elegir…</Text>
            <Ionicons name="chevron-down" size={16} color={COLORS.placeholder} />
          </Pressable>
          <Button label="+ Crear" variant="secondary" onPress={() => setCrear(true)} />
        </View>
      )}

      <ElegirGrupoModal
        visible={lista}
        etiqueta={etiqueta}
        seleccionadoId={grupo?.id}
        fecha={fecha}
        onSelect={(g) => { onChange(aElegido(g)); setLista(false); }}
        onCrear={() => { setLista(false); setCrear(true); }}
        onClose={() => setLista(false)}
      />
      <CrearGrupoModal
        visible={crear}
        etiqueta={etiqueta}
        onCreado={(g) => { onChange(aElegido(g)); setCrear(false); }}
        onClose={() => setCrear(false)}
      />
    </View>
  );
}
