import { Text, TextInput } from '@/components/ui/Text';
import { COLORS } from '@/lib/designTokens';
import React, { useState } from 'react';
import { View, TouchableOpacity, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { toISODate } from '@/lib/formatters';
import { fmtFecha } from './fechasPerfil';

// ── Mini field para formularios inline ─────────────────────────────────────

export function MiniField({
  label, value, onChangeText, placeholder, keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
}) {
  return (
    <View>
      <Text className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor={COLORS.placeholder}
        keyboardType={keyboardType ?? 'default'}
        className="text-sm text-foreground border border-border rounded-xl px-3 py-2"
        autoCorrect={false}
        autoCapitalize="none"
      />
    </View>
  );
}

// ── Campo de fecha con picker nativo (evita que el usuario tenga que escribir
//    "AAAA-MM-DD" a mano) — variante compacta reutiliza el look de MiniField. ──

export function DateField({
  label, value, onChange, placeholder, maximumDate, minimumDate, last = false, compact = false,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  maximumDate?: Date;
  minimumDate?: Date;
  last?: boolean;
  compact?: boolean;
}) {
  const [show, setShow] = useState(false);

  function handleChange(_: DateTimePickerEvent, d?: Date) {
    if (d) onChange(toISODate(d));
  }

  // Android: el diálogo nativo se abre vía la API imperativa, no montado
  // como hijo declarativo — igual que abrirHoraAndroid() en turno/[id].tsx.
  // Renderizarlo con `{show && <DateTimePicker display="default" />}` (como
  // estaba antes) hace que cualquier re-render mientras el diálogo está
  // abierto lo remonte, y el widget nativo de Android puede reconstruirse
  // con una fecha inconsistente (ej. saltar al 31 de diciembre del año
  // recién elegido en vez del día que se tocó).
  function abrirAndroid() {
    DateTimePickerAndroid.open({
      value: value ? new Date(`${value}T00:00:00`) : new Date(),
      mode: 'date',
      maximumDate,
      minimumDate,
      onChange: handleChange,
    });
  }

  const trigger = (
    <View className="flex-row items-center gap-1.5">
      <TouchableOpacity
        onPress={() => (Platform.OS === 'android' ? abrirAndroid() : setShow(true))}
        className="flex-1 flex-row items-center gap-1.5 py-0.5"
      >
        <Ionicons name="calendar-outline" size={14} color={COLORS.placeholder} />
        <Text className={`text-sm ${value ? 'text-foreground' : 'text-muted-foreground'}`}>
          {value ? fmtFecha(value) : (placeholder ?? 'Seleccionar fecha')}
        </Text>
      </TouchableOpacity>
      {value ? (
        <TouchableOpacity onPress={() => onChange('')} hitSlop={8}>
          <Ionicons name="close-circle" size={16} color={COLORS.placeholder} />
        </TouchableOpacity>
      ) : null}
    </View>
  );

  // Solo iOS necesita el picker inline montado — Android lo abre imperativamente arriba.
  const picker = Platform.OS === 'ios' ? (
    <>
      {show && (
        <DateTimePicker
          value={value ? new Date(`${value}T00:00:00`) : new Date()}
          mode="date"
          display="inline"
          maximumDate={maximumDate}
          minimumDate={minimumDate}
          onChange={handleChange}
        />
      )}
      {show && (
        <TouchableOpacity onPress={() => setShow(false)} className="bg-primary/10 rounded-xl py-1.5 items-center mt-2">
          <Text className="text-xs font-semibold text-primary">Listo</Text>
        </TouchableOpacity>
      )}
    </>
  ) : null;

  if (compact) {
    return (
      <View>
        <Text className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">{label}</Text>
        <View className="border border-border rounded-xl px-3 py-2">{trigger}</View>
        {picker}
      </View>
    );
  }
  return (
    <View className={`px-5 py-3 bg-card ${!last ? 'border-b border-border' : ''}`}>
      <Text className="text-xs text-muted-foreground mb-1">{label}</Text>
      {trigger}
      {picker}
    </View>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────────────

export function PillRow<T extends string>({
  label,
  options,
  value,
  onChange,
  labels,
}: {
  label: string;
  options: T[];
  value: T | null | undefined;
  onChange: (v: T) => void;
  labels: Record<T, string>;
}) {
  return (
    <View className="px-5 py-3 border-b border-border bg-card">
      <Text className="text-xs text-muted-foreground mb-2">{label}</Text>
      <View className="flex-row gap-2 flex-wrap">
        {options.map((opt) => (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            className={`rounded-full px-3 py-1.5 border ${
              value === opt
                ? 'bg-primary-500 border-primary-500'
                : 'bg-background border-border'
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                value === opt ? 'text-white' : 'text-muted-foreground'
              }`}
            >
              {labels[opt]}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function FieldInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  last = false,
  multiline = false,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
  last?: boolean;
  multiline?: boolean;
  maxLength?: number;
}) {
  return (
    <View
      className={`px-5 py-3 bg-card ${!last ? 'border-b border-border' : ''}`}
    >
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-xs text-muted-foreground">{label}</Text>
        {maxLength != null && (
          <Text className="text-[10px] text-muted-foreground">{value.length}/{maxLength}</Text>
        )}
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? label}
        placeholderTextColor={COLORS.placeholder}
        keyboardType={keyboardType ?? 'default'}
        className="text-sm text-foreground"
        autoCorrect={false}
        autoCapitalize={multiline ? 'sentences' : 'none'}
        multiline={multiline}
        maxLength={maxLength}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={multiline ? { minHeight: 80 } : undefined}
      />
    </View>
  );
}
