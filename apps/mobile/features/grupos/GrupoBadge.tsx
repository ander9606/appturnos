import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { COLORS } from '@/lib/designTokens';

/**
 * Etiqueta con el grupo al que pertenece un turno ("Feria del Libro 2026"). La ven todos los roles y se
 * muestra siempre que el turno tenga grupo, aunque la empresa haya apagado la función: los grupos se
 * conservan. Sin grupo no dibuja nada. `sobreMarca` es para fondos naranja (blanco translúcido en lugar del
 * tinte de marca). Va solo el nombre, sin la palabra "grupo": la empresa puede llamarlo "Evento", "Obra"…
 */
export function GrupoBadge({ nombre, sobreMarca = false }: { nombre?: string | null; sobreMarca?: boolean }) {
  const texto = nombre?.trim();
  if (!texto) return null;
  return (
    <View
      className={`flex-row items-center gap-1 self-start max-w-full rounded-lg px-2 py-0.5 ${sobreMarca ? 'bg-white/20' : 'bg-primary/10'}`}
    >
      <Ionicons name="albums-outline" size={11} color={sobreMarca ? COLORS.white : COLORS.primary} />
      <Text
        className={`shrink text-xs font-semibold ${sobreMarca ? 'text-white' : 'text-primary-700'}`}
        numberOfLines={1}
      >
        {texto}
      </Text>
    </View>
  );
}
