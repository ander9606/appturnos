import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  type TouchableOpacityProps,
} from 'react-native';
import * as Haptics from 'expo-haptics';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size    = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<TouchableOpacityProps, 'onPress'> {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const BASE = 'flex-row items-center justify-center rounded-xl active:opacity-80';

const VARIANT_STYLES: Record<Variant, { container: string; text: string }> = {
  primary:   { container: 'bg-primary-500',         text: 'text-white font-semibold' },
  secondary: { container: 'bg-primary-50 border border-primary-300', text: 'text-primary-600 font-semibold' },
  ghost:     { container: 'bg-transparent',          text: 'text-primary-500 font-medium' },
  danger:    { container: 'bg-danger',               text: 'text-white font-semibold' },
  success:   { container: 'bg-success',              text: 'text-white font-semibold' },
};

const SIZE_STYLES: Record<Size, { container: string; text: string }> = {
  sm: { container: 'px-4 py-2 min-h-[36px]', text: 'text-sm' },
  md: { container: 'px-5 py-3 min-h-[48px]', text: 'text-base' },
  lg: { container: 'px-6 py-4 min-h-[56px]', text: 'text-lg' },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const v = VARIANT_STYLES[variant];
  const s = SIZE_STYLES[size];

  const handlePress = () => {
    if (isDisabled || !onPress) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <TouchableOpacity
      {...rest}
      onPress={handlePress}
      disabled={isDisabled}
      className={[
        BASE,
        v.container,
        s.container,
        fullWidth ? 'w-full' : 'self-start',
        isDisabled ? 'opacity-50' : '',
      ].join(' ')}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'danger' || variant === 'success' ? '#fff' : '#FF5A3C'}
        />
      ) : (
        <Text className={[v.text, s.text].join(' ')}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}
