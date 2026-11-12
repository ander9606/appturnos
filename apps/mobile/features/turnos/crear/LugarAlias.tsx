import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, TextInput } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { COLORS } from '@/lib/designTokens';
import { showAlert } from '@/lib/alertDialog';
import { ApiError } from '@api-client';
import { usePuntosParaTurnos, useCrearPuntoMarcaje } from '@/features/turnos/usePuntosMarcaje';
import { sugerirAlias } from '@/features/turnos/lugarAlias';

type Props = {
  /** Dirección que eligió el usuario (la del buscador, el GPS o el mapa). */
  lugar: string;
  latitud: number | null;
  longitud: number | null;
  alias: string;
  onChange: (alias: string) => void;
};

const igual = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * "Nombre corto" opcional de un lugar, para las tarjetas y la cuenta de cobro (la dirección completa queda para el
 * mapa y el contrato). Solo aparece cuando hay una dirección que no es de la biblioteca: un lugar de la biblioteca ya
 * tiene nombre corto. Con coordenadas, ofrece guardar el lugar en la biblioteca con ese nombre (opcional: lo decide
 * quien lo crea), para elegirlo ya corto la próxima vez.
 */
export function LugarAlias({ lugar, latitud, longitud, alias, onChange }: Props) {
  const { data: puntos = [] } = usePuntosParaTurnos();
  const crearPunto = useCrearPuntoMarcaje();

  if (!lugar.trim() || puntos.some((p) => igual(p.nombre, lugar))) return null;

  const nombre = alias.trim();
  const enBiblioteca = nombre !== '' && puntos.some((p) => igual(p.nombre, nombre));
  const sugerencia = nombre === '' ? sugerirAlias(lugar) : null;
  const puedeGuardar = nombre !== '' && !enBiblioteca && latitud != null && longitud != null;

  async function guardarEnBiblioteca() {
    try {
      await crearPunto.mutateAsync({ nombre, latitud: latitud!, longitud: longitud!, radio_metros: 100, alcance: 'todos', tipo: 'fijo' });
    } catch (err) {
      showAlert('No se pudo guardar', err instanceof ApiError ? err.message : 'Inténtalo de nuevo.');
    }
  }

  return (
    <View className="gap-1.5">
      <Text className="text-sm font-semibold text-foreground">Nombre corto (opcional)</Text>
      <TextInput
        value={alias}
        onChangeText={onChange}
        maxLength={80}
        placeholder="Ej.: Corferias"
        accessibilityLabel="Nombre corto del lugar"
        className="bg-muted rounded-2xl px-4 py-3 text-base text-foreground"
      />
      <Text className="text-xs text-muted-foreground">
        Se usa en las tarjetas y en la cuenta de cobro. La dirección completa queda para el mapa y el contrato.
      </Text>
      <View className="flex-row flex-wrap items-center gap-2">
        {sugerencia ? (
          <TouchableOpacity
            onPress={() => onChange(sugerencia)}
            accessibilityRole="button"
            className="px-3 py-1.5 rounded-xl bg-primary-50 border border-primary-300"
          >
            <Text className="text-xs font-semibold text-primary-600">{`Usar «${sugerencia}»`}</Text>
          </TouchableOpacity>
        ) : null}
        {puedeGuardar ? (
          <Button
            label="Guardar en mi biblioteca"
            variant="ghost"
            size="sm"
            loading={crearPunto.isPending}
            onPress={guardarEnBiblioteca}
            icon={<Ionicons name="bookmark-outline" size={14} color={COLORS.primary} />}
          />
        ) : null}
        {enBiblioteca ? (
          <View className="flex-row items-center gap-1">
            <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
            <Text className="text-xs text-success">En tu biblioteca</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
