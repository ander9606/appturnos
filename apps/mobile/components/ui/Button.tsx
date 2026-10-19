import { Spinner } from '@/components/ui/Spinner';
import { COLORS } from '@/lib/designTokens';
import React from 'react';
import {
  TouchableOpacity,
  Text,
  type TouchableOpacityProps,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSingleFlight } from '@/lib/useSingleFlight';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'successOutline';
type Size    = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<TouchableOpacityProps, 'onPress'> {
  label: string;
  /** Si devuelve una promesa, el botón queda en carga hasta que termine y se bloquea el doble toque. */
  onPress?: () => void | Promise<unknown>;
  onPressDisabled?: () => void; // fires when tapped while disabled (for informational feedback)
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const BASE = 'flex-row items-center justify-center rounded-xl active:opacity-80';

const VARIANT_STYLES: Record<Variant, { container: string; text: string }> = {
  primary:        { container: 'bg-primary-500',         text: 'text-white font-semibold' },
  secondary:      { container: 'bg-primary-50 border border-primary-300', text: 'text-primary-600 font-semibold' },
  ghost:          { container: 'bg-transparent',          text: 'text-primary-500 font-medium' },
  danger:         { container: 'bg-danger',               text: 'text-white font-semibold' },
  success:        { container: 'bg-success',              text: 'text-white font-semibold' },
  // Mismo tono que 'success' pero en contorno — para acciones que cierran/resuelven
  // algo real (con efectos en pago, contratos, notificaciones) y no deben leerse
  // como un CTA festivo de "listo" a todo color, sin dejar de ser fáciles de encontrar.
  successOutline: { container: 'bg-success-light border border-success/30', text: 'text-success font-semibold' },
};

const SIZE_STYLES: Record<Size, { container: string; text: string }> = {
  sm: { container: 'px-4 py-2 min-h-[36px]', text: 'text-sm' },
  md: { container: 'px-5 py-3 min-h-[48px]', text: 'text-base' },
  lg: { container: 'px-6 py-4 min-h-[56px]', text: 'text-lg' },
};

export function Button({
  label,
  onPress,
  onPressDisabled,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  ...rest
}: ButtonProps) {
  const { run, busy } = useSingleFlight(onPress);
  const enCarga    = loading || busy;
  const isDisabled = disabled || enCarga;
  const v = VARIANT_STYLES[variant];
  const s = SIZE_STYLES[size];

  const handlePress = () => {
    if (busy) return;
    if (isDisabled) {
      onPressDisabled?.();
      return;
    }
    if (!onPress) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    run();
  };

  const shadow = variant === 'primary' && !isDisabled ? {
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  } : variant === 'danger' && !isDisabled ? {
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  } : undefined;

  return (
    <TouchableOpacity
      {...rest}
      onPress={handlePress}
      disabled={isDisabled && !onPressDisabled}
      style={shadow}
      className={[
        BASE,
        v.container,
        s.container,
        fullWidth ? 'w-full' : 'self-start',
        isDisabled ? 'opacity-50' : '',
      ].join(' ')}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: enCarga }}
    >
      {enCarga ? (
        <Spinner
          size="small"
          color={
            variant === 'primary' || variant === 'danger' || variant === 'success' ? COLORS.white
            : variant === 'successOutline' ? COLORS.success
            : COLORS.primary
          }
        />
      ) : (
        <Text className={[v.text, s.text].join(' ')}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}
