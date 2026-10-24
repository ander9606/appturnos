import { Text, TextInput } from '@/components/ui/Text';
import { Spinner } from '@/components/ui/Spinner';
import { showAlert } from '@/lib/alertDialog';
import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { showToast } from '@/lib/toast';
import { useCalificar } from '@/features/turnos/useTurnos';
import { StarRating } from '@/features/turnos/StarRating';
import type { Asignacion } from '@api-client';
import { COLORS } from '@/lib/designTokens';

/** Últimos turnos terminados del trabajador, con calificación inline para quien puede calificar. */
export function TurnosRecientes({ turnos, canRate }: { turnos: Asignacion[]; canRate: boolean }) {
  // Calificación inline: id de la asignación que se está calificando
  const [ratingId,       setRatingId]       = useState<number | null>(null);
  const [ratingStars,    setRatingStars]    = useState(5);
  const [ratingComment,  setRatingComment]  = useState('');
  const calificar = useCalificar();

  async function handleCalificar() {
    if (!ratingId) return;
    try {
      await calificar.mutateAsync({
        id: ratingId,
        calificacion: ratingStars,
        comentario: ratingComment.trim() || undefined,
      });
      setRatingId(null);
      setRatingComment('');
      setRatingStars(5);
      showToast(`Turno calificado con ${ratingStars}/5 estrellas.`);
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'No se pudo guardar la calificación.';
      showAlert('Error', msg);
    }
  }

  return (
    <View className="mx-4 mt-3">
      <Text className="text-sm font-semibold text-foreground mb-2">
        Turnos recientes
      </Text>

      {turnos.map((a: Asignacion) => {
        const yaCalificado = a.calificacion != null;
        const isOpen       = ratingId === a.id;

        return (
          <View
            key={a.id}
            className="bg-card rounded-2xl border border-border mb-2 overflow-hidden"
          >
            {/* Header row */}
            <View className="px-4 py-3 flex-row items-center justify-between">
              <View className="flex-1 mr-3">
                <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                  {(a as any).oferta_titulo ?? `Turno #${a.id}`}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {(a as any).oferta_fecha ?? ''}
                  {a.estado === 'no_presentado' ? '  ·  No presentado' : ''}
                </Text>
              </View>

              {a.estado === 'completado' && (
                yaCalificado ? (
                  <StarRating mode="display" value={a.calificacion} size="sm" />
                ) : canRate ? (
                  <Pressable
                    onPress={() => {
                      setRatingId(isOpen ? null : a.id);
                      setRatingStars(5);
                      setRatingComment('');
                    }}
                    className="bg-warning/10 rounded-full px-3 py-1 active:opacity-70"
                  >
                    <Text className="text-warning text-xs font-semibold">
                      {isOpen ? 'Cancelar' : 'Calificar ★'}
                    </Text>
                  </Pressable>
                ) : (
                  <Text className="text-xs text-muted-foreground italic">Sin calificar</Text>
                )
              )}
            </View>

            {/* Inline rating form */}
            {isOpen && (
              <View className="border-t border-border px-4 pb-4 pt-3 gap-3">
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs font-semibold text-muted-foreground">
                    CALIFICACIÓN
                  </Text>
                  <StarRating
                    mode="input"
                    value={ratingStars}
                    onChange={setRatingStars}
                    size="lg"
                  />
                </View>

                <TextInput
                  className="bg-background border border-border rounded-xl px-3 py-2 text-sm text-foreground"
                  placeholder="Comentario opcional…"
                  placeholderTextColor={COLORS.placeholder}
                  value={ratingComment}
                  onChangeText={setRatingComment}
                  maxLength={500}
                  multiline
                  numberOfLines={2}
                />

                <Pressable
                  onPress={handleCalificar}
                  disabled={calificar.isPending}
                  className={`h-10 rounded-xl items-center justify-center ${
                    calificar.isPending ? 'bg-primary/50' : 'bg-primary active:bg-primary/80'
                  }`}
                >
                  {calificar.isPending ? (
                    <Spinner color="white" size="small" />
                  ) : (
                    <Text className="text-white font-bold text-sm">
                      Confirmar calificación
                    </Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}
