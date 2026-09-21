import React from 'react';
import { View, Text, TextInput } from 'react-native';

import { StarRating } from '../StarRating';
import { Button } from '@/components/ui/Button';

export function CalificacionCard({
  calificacion, calificacionComentario, isGestor,
  selectedRating, onRatingChange, comentario, onComentarioChange,
  onGuardar, guardando,
}: {
  calificacion: number | null;
  calificacionComentario: string | null | undefined;
  isGestor: boolean;
  selectedRating: number;
  onRatingChange: (v: number) => void;
  comentario: string;
  onComentarioChange: (v: string) => void;
  onGuardar: () => void;
  guardando: boolean;
}) {
  return (
    <View className="bg-card rounded-2xl px-5 py-4 border border-border">
      <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Calificación
      </Text>
      {calificacion != null ? (
        <View className="gap-2">
          <StarRating mode="display" value={calificacion} size="lg" />
          {calificacionComentario != null && (
            <Text className="text-sm text-foreground italic mt-1">
              "{calificacionComentario}"
            </Text>
          )}
        </View>
      ) : isGestor ? (
        <View className="gap-3">
          <StarRating mode="input" value={selectedRating} onChange={onRatingChange} size="lg" />
          <TextInput
            placeholder="Comentario (opcional)"
            value={comentario}
            onChangeText={onComentarioChange}
            className="text-sm text-foreground border border-border rounded-xl px-3 py-2.5"
            placeholderTextColor="#94A3B8"
            maxLength={500}
            multiline
          />
          <Button
            label={guardando ? 'Guardando…' : 'Guardar calificación'}
            variant="primary"
            fullWidth
            loading={guardando}
            disabled={selectedRating === 0 || guardando}
            onPress={onGuardar}
          />
        </View>
      ) : (
        <View className="flex-row items-center gap-2">
          <StarRating mode="display" value={null} showEmpty size="md" />
          <Text className="text-sm text-muted-foreground">Pendiente de calificación</Text>
        </View>
      )}
    </View>
  );
}
