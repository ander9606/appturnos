/**
 * StarRating — componente de estrellas para calificaciones.
 *
 * Modos:
 *  - mode="display"  → solo lectura, muestra el valor recibido
 *  - mode="input"    → interactivo, el usuario selecciona 1–5
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';

const STARS = [1, 2, 3, 4, 5];

// ── Display mode ──────────────────────────────────────────────────────────

interface DisplayProps {
  mode: 'display';
  value: number | null;
  size?: 'sm' | 'md' | 'lg';
  showEmpty?: boolean; // show empty stars when null
}

// ── Input mode ────────────────────────────────────────────────────────────

interface InputProps {
  mode: 'input';
  value: number;
  onChange: (v: number) => void;
  size?: 'sm' | 'md' | 'lg';
}

type StarRatingProps = DisplayProps | InputProps;

// ── Size map ──────────────────────────────────────────────────────────────

const SIZE_MAP = { sm: 16, md: 22, lg: 30 } as const;

// ── Component ─────────────────────────────────────────────────────────────

export function StarRating(props: StarRatingProps) {
  const size = SIZE_MAP[props.size ?? 'md'];

  if (props.mode === 'display') {
    const { value, showEmpty = false } = props;

    if (value === null && !showEmpty) return null;

    return (
      <View className="flex-row items-center gap-0.5">
        {STARS.map((s) => {
          const filled = value !== null && s <= value;
          return (
            <Text
              key={s}
              style={{ fontSize: size, color: filled ? '#F59E0B' : '#CBD5E1' }}
            >
              ★
            </Text>
          );
        })}
        {value !== null && (
          <Text
            className="text-muted-foreground font-medium ml-1"
            style={{ fontSize: size * 0.6 }}
          >
            {value.toFixed(1)}
          </Text>
        )}
      </View>
    );
  }

  // Input mode
  const { value, onChange } = props;

  return (
    <View className="flex-row items-center gap-1">
      {STARS.map((s) => (
        <Pressable key={s} onPress={() => onChange(s)} hitSlop={6}>
          <Text
            style={{
              fontSize: size,
              color: s <= value ? '#F59E0B' : '#CBD5E1',
            }}
          >
            ★
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
