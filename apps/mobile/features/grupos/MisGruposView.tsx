import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import type { RefreshControlProps } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Asignacion } from '@api-client';
import { Text } from '@/components/ui/Text';
import { EmptyState } from '@/components/ui/EmptyState';
import { COLORS } from '@/lib/designTokens';
import { formatShortDate } from '@/lib/formatters';
import { ShiftCard } from '@/features/turnos/ShiftCard';
import { agruparMisTurnos, avisoSinFirmar, resumenAvance, type GrupoDeMisTurnos } from './misGrupos';

type Props = {
  asignaciones: Asignacion[];
  /** Para refrescar tirando de la lista, igual que las demás listas de la pestaña. */
  refreshControl?: React.ReactElement<RefreshControlProps>;
};

function rango(g: GrupoDeMisTurnos): string {
  return g.fechaInicio === g.fechaFin ? formatShortDate(g.fechaInicio) : `${formatShortDate(g.fechaInicio)} – ${formatShortDate(g.fechaFin)}`;
}

/**
 * «Mis turnos» agrupados: una tarjeta por grupo con sus fechas, cuántos turnos suyos lleva terminados y cuántos le
 * faltan, y el aviso si hay contratos sin firmar. Se despliega al tocarla y muestra solo los turnos del trabajador.
 */
export function MisGruposView({ asignaciones, refreshControl }: Props) {
  const router = useRouter();
  const grupos = useMemo(() => agruparMisTurnos(asignaciones), [asignaciones]);
  const [abiertos, setAbiertos] = useState<string[]>([]);
  const alternar = useCallback((clave: string) => setAbiertos((l) => (l.includes(clave) ? l.filter((c) => c !== clave) : [...l, clave])), []);

  return (
    <FlatList
      data={grupos}
      keyExtractor={(g) => g.clave}
      contentContainerClassName="px-5 py-4 gap-3"
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={<EmptyState title="Sin turnos todavía" message="Cuando tengas turnos aparecerán aquí, agrupados." />}
      renderItem={({ item: g }) => {
        const abierto = abiertos.includes(g.clave);
        const nombre = g.nombre ?? 'Sin grupo';
        const aviso = avisoSinFirmar(g.sinFirmar);
        return (
          <View className="bg-card border border-border rounded-2xl overflow-hidden">
            <Pressable
              onPress={() => alternar(g.clave)}
              accessibilityRole="button"
              accessibilityState={{ expanded: abierto }}
              accessibilityLabel={`${nombre}. ${resumenAvance(g)}`}
              className="p-4 gap-1.5 active:opacity-70"
            >
              <View className="flex-row items-start justify-between gap-2">
                <Text className="flex-1 text-base font-bold text-foreground" numberOfLines={2}>{nombre}</Text>
                <Ionicons name={abierto ? 'chevron-up' : 'chevron-down'} size={18} color={COLORS.mutedForeground} />
              </View>
              <Text className="text-sm text-muted-foreground">{rango(g)} · {resumenAvance(g)}</Text>
              {g.empresaNombre ? <Text className="text-xs text-muted-foreground" numberOfLines={1}>{g.empresaNombre}</Text> : null}
              {g.proximo ? <Text className="text-xs font-semibold text-primary-700">Próximo: {formatShortDate(g.proximo)}</Text> : null}
              {aviso ? (
                <View className="flex-row items-start gap-2 bg-warning/10 rounded-xl px-3 py-2 mt-1">
                  <Ionicons name="alert-circle-outline" size={16} color={COLORS.warning} />
                  <Text className="flex-1 text-xs text-foreground">{aviso}</Text>
                </View>
              ) : null}
            </Pressable>
            {abierto ? (
              <View className="gap-2 px-3 pb-3 pt-1 border-t border-border">
                {g.turnos.map((a) => (
                  <ShiftCard key={a.id} asignacion={a} showDate onPress={() => router.push(`/turno/${a.id}`)} />
                ))}
              </View>
            ) : null}
          </View>
        );
      }}
    />
  );
}
