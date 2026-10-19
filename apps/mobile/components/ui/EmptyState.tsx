import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { PlanetIllustration, type PlanetVariant } from '@/components/ui/PlanetIllustration';

/** Qué tipo de vacío es: define la ilustración. */
export type EmptyVariant = Extract<PlanetVariant, 'orbit' | 'search' | 'done'>;

interface Props {
  /** `empty` = nada todavía (por defecto) · `search` = sin resultados de una búsqueda o filtro · `done` = todo al día. */
  variant?: 'empty' | 'search' | 'done';
  title: string;
  message?: string;
  /** Botón para salir del vacío ("Crear el primero"). */
  action?: { label: string; onPress: () => void | Promise<unknown> };
  /** Versión corta para listas pequeñas, selectores o tarjetas. */
  compact?: boolean;
}

const ILUSTRACION: Record<NonNullable<Props['variant']>, EmptyVariant> = { empty: 'orbit', search: 'search', done: 'done' };

/**
 * Estado vacío de marca: el planeta del logo con su anillo en órbita (los errores lo muestran
 * con el anillo fuera de lugar — ver ErrorState). Para usar como `ListEmptyComponent` o en lugar de una lista.
 */
export function EmptyState({ variant = 'empty', title, message, action, compact }: Props) {
  return (
    <View className={compact ? 'items-center gap-1 py-6 px-6' : 'items-center justify-center gap-1 py-12 px-8'}>
      <PlanetIllustration variant={ILUSTRACION[variant]} width={compact ? 110 : 170} />
      <Text className="text-lg font-bold text-foreground text-center mt-1">{title}</Text>
      {message && <Text className="text-sm text-muted-foreground text-center">{message}</Text>}
      {action && (
        <View className="mt-3">
          <Button label={action.label} onPress={action.onPress} variant="secondary" size={compact ? 'sm' : 'md'} />
        </View>
      )}
    </View>
  );
}
