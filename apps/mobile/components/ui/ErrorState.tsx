import React from 'react';
import { Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { PlanetIllustration } from '@/components/ui/PlanetIllustration';
import { apiErrorMessage, errorKind } from '@/lib/apiErrorMessage';
import { t } from '@/lib/i18n';

interface Props {
  error?: unknown;
  onRetry: () => void | Promise<unknown>;
  /** Texto para el caso genérico cuando el error no trae mensaje del backend (p. ej. "Error al cargar turnos"). */
  fallback?: string;
  /** Versión corta para meter dentro de una tarjeta o sección (sin ocupar toda la pantalla). */
  compact?: boolean;
}

/**
 * Estado de error de marca: el planeta del logo con el anillo fuera de lugar.
 * Sin conexión → anillo caído · falla del servidor → anillo torcido · otro → mensaje del backend.
 */
export function ErrorState({ error, onRetry, fallback, compact }: Props) {
  const kind = errorKind(error);
  const title = t(`errors.${kind}.title`);
  const body = kind === 'generic' ? apiErrorMessage(error, fallback ?? t('common.error')) : t(`errors.${kind}.body`);

  return (
    <View
      accessibilityRole="alert"
      className={compact ? 'items-center gap-2 py-6 px-6' : 'flex-1 items-center justify-center gap-3 px-8'}
    >
      <PlanetIllustration variant={kind === 'offline' ? 'fallen' : 'tilted'} width={compact ? 120 : 190} />
      <Text className="text-lg font-bold text-foreground text-center">{title}</Text>
      <Text className="text-sm text-muted-foreground text-center">{body}</Text>
      <Button label={t('common.retry')} onPress={onRetry} variant="secondary" size={compact ? 'sm' : 'md'} />
    </View>
  );
}
