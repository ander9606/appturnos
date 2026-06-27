import React, { forwardRef, useState } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  /** Show a password toggle (eye icon) */
  isPassword?: boolean;
}

export const Input = forwardRef<TextInput, InputProps>(
  ({ label, error, hint, isPassword, secureTextEntry, style, ...rest }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    const hasError = !!error;
    const borderColor = hasError ? 'border-danger' : 'border-border';
    const focusBorder = hasError ? 'focus:border-danger' : 'focus:border-primary-400';

    return (
      <View className="w-full gap-1.5">
        {label && (
          <Text className="text-sm font-medium text-foreground">{label}</Text>
        )}

        <View className="relative">
          <TextInput
            ref={ref}
            secureTextEntry={isPassword && !showPassword ? true : (secureTextEntry ?? false)}
            placeholderTextColor="#94A3B8"
            className={[
              'w-full rounded-xl border bg-card px-4 py-3 text-base text-foreground',
              'min-h-[48px]',
              borderColor,
              focusBorder,
              isPassword ? 'pr-12' : '',
            ].join(' ')}
            {...rest}
          />

          {isPassword && (
            <TouchableOpacity
              onPress={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-0 bottom-0 items-center justify-center px-1"
              accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color="#94A3B8"
              />
            </TouchableOpacity>
          )}
        </View>

        {error && (
          <Text className="text-xs font-medium text-danger">{error}</Text>
        )}
        {hint && !error && (
          <Text className="text-xs text-muted-foreground">{hint}</Text>
        )}
      </View>
    );
  },
);

Input.displayName = 'Input';
