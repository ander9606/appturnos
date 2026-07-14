import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Step {
  label: string;
  done: boolean;
  onPress: () => void;
}

interface SetupChecklistProps {
  steps: Step[];
}

/** Checklist de primeros pasos del admin_empresa — desaparece sola cuando todo está completo. */
export function SetupChecklist({ steps }: SetupChecklistProps) {
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  return (
    <View className="mx-4 mt-4 bg-card rounded-2xl border border-border p-4 gap-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-bold text-foreground">Primeros pasos</Text>
        <Text className="text-xs font-semibold text-muted-foreground">{doneCount}/{steps.length}</Text>
      </View>

      <View className="h-1.5 bg-muted rounded-full overflow-hidden">
        <View
          className="h-full bg-primary rounded-full"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </View>

      <View className="gap-2.5 mt-1">
        {steps.map((step) => (
          <Pressable
            key={step.label}
            onPress={step.onPress}
            disabled={step.done}
            className="flex-row items-center gap-2.5 active:opacity-70"
          >
            <Ionicons
              name={step.done ? 'checkmark-circle' : 'ellipse-outline'}
              size={20}
              color={step.done ? '#16A34A' : '#94A3B8'}
            />
            <Text className={`text-sm flex-1 ${step.done ? 'text-muted-foreground line-through' : 'text-foreground font-medium'}`}>
              {step.label}
            </Text>
            {!step.done && <Ionicons name="chevron-forward" size={16} color="#94A3B8" />}
          </Pressable>
        ))}
      </View>
    </View>
  );
}
