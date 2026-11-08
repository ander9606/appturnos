import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import type { RefreshControlProps } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { COLORS } from '@/lib/designTokens';
import { bogotaToday, formatShortDate } from '@/lib/formatters';
import { ShiftCard } from '@/features/turnos/ShiftCard';
import { FaseChip } from './FaseGrupo';
import { avisoSinFirmar, faseDeMiGrupo, porcentajeAvance, resumenAvance, type GrupoDeMisTurnos } from './misGrupos';

type Props = {
  grupos: GrupoDeMisTurnos[];
  /** Qué mostrar cuando la lista está vacía (cambia según la pestaña). */
  vacio: React.ReactElement;
  /** Para refrescar tirando de la lista. */
  refreshControl?: React.ReactElement<RefreshControlProps>;
};

function rango(g: GrupoDeMisTurnos): string {
  return g.fechaInicio === g.fechaFin ? formatShortDate(g.fechaInicio) : `${formatShortDate(g.fechaInicio)} – ${formatShortDate(g.fechaFin)}`;
}

/**
 * Los eventos del trabajador: una tarjeta por grupo con su momento (próximo, en curso, terminado), una barra de avance
 * con sus turnos terminados, lo que sigue y el aviso de contratos sin firmar. Se despliega al tocarla y muestra solo
 * los turnos del trabajador en ese evento.
 */
export function MisGruposView({ grupos, vacio, refreshControl }: Props) {
  const router = useRouter();
  const hoy = bogotaToday();
  const [abiertos, setAbiertos] = useState<string[]>([]);
  const alternar = useCallback((clave: string) => setAbiertos((l) => (l.includes(clave) ? l.filter((c) => c !== clave) : [...l, clave])), []);

  return (
    <FlatList
      data={grupos}
      keyExtractor={(g) => g.clave}
      contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 12 }}
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={vacio}
      renderItem={({ item: g }) => {
        const abierto = abiertos.includes(g.clave);
        const nombre = g.nombre ?? 'Sin nombre';
        const aviso = avisoSinFirmar(g.sinFirmar);
        const pct = porcentajeAvance(g);
        return (
          <View className="bg-card border border-border rounded-2xl overflow-hidden">
            <Pressable
              onPress={() => alternar(g.clave)}
              accessibilityRole="button"
              accessibilityState={{ expanded: abierto }}
              accessibilityLabel={`${nombre}. ${resumenAvance(g)}`}
              className="p-4 gap-2.5 active:opacity-70"
            >
              <View className="flex-row items-start gap-2">
                <Text className="flex-1 text-base font-bold text-foreground" numberOfLines={2}>{nombre}</Text>
                <View className="p-1">
                  <Ionicons name={abierto ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.mutedForeground} />
                </View>
              </View>
              <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
                <FaseChip fase={faseDeMiGrupo(g, hoy)} />
                <Text className="text-sm text-muted-foreground">{rango(g)}</Text>
              </View>
              {g.empresaNombre ? <Text className="text-xs text-muted-foreground" numberOfLines={1}>{g.empresaNombre}</Text> : null}
              <View className="gap-1.5">
                <View className="h-1.5 rounded-full bg-muted overflow-hidden" accessibilityLabel={`${pct}% de tus turnos terminados`}>
                  <View className="h-full rounded-full bg-primary-500" style={{ width: `${pct}%` }} />
                </View>
                <Text className="text-xs text-muted-foreground">{resumenAvance(g)}</Text>
              </View>
              {g.proximo ? <Text className="text-xs font-semibold text-primary-700">Próximo: {formatShortDate(g.proximo)}</Text> : null}
              {aviso ? (
                <View className="flex-row items-start gap-2 bg-warning/10 rounded-xl px-3 py-2">
                  <Ionicons name="alert-circle-outline" size={16} color={COLORS.warning} />
                  <Text className="flex-1 text-xs text-foreground">{aviso}</Text>
                </View>
              ) : null}
            </Pressable>
            {abierto ? (
              <View className="gap-2 px-3 pb-3 pt-3 border-t border-border">
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
