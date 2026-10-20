import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Text } from '@/components/ui/Text';
import { COLORS, THEME_COLORS } from '@/lib/designTokens';

/**
 * Páginas que se deslizan de lado, con pestañas arriba (Turnos | Nómina).
 * Cada página tiene su propio scroll vertical. Sin `nomina` (jefe de turnos) es una sola página, sin pestañas.
 * ponytail: ScrollView horizontal con pagingEnabled (nativo de React Native) — upgrade path: react-native-pager-view si se quiere el gesto de borde de iOS.
 */
interface Props {
  turnos: React.ReactNode;
  /** null: quien no ve nómina; la pestaña y la página no existen. */
  nomina: React.ReactNode | null;
}

export function ReportePager({ turnos, nomina }: Props) {
  const { width } = useWindowDimensions();
  const ref = useRef<ScrollView>(null);
  const [pagina, setPagina] = useState(0);

  const paginas = [
    { key: 'turnos', label: 'Turnos', icon: 'calendar-outline' as const, color: THEME_COLORS.turnos.primary, contenido: turnos },
    ...(nomina ? [{ key: 'nomina', label: 'Nómina', icon: 'briefcase-outline' as const, color: THEME_COLORS.nomina.primary, contenido: nomina }] : []),
  ];

  // La pestaña activa cambia en cuanto el deslizamiento pasa de la mitad de la página
  function alDeslizar(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setPagina(Math.round(e.nativeEvent.contentOffset.x / width));
  }
  function irA(i: number) {
    setPagina(i);
    ref.current?.scrollTo({ x: i * width, animated: true });
  }

  const contenido = paginas.map((p) => (
    <ScrollView
      key={p.key}
      style={{ width }}
      contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      {p.contenido}
    </ScrollView>
  ));

  if (paginas.length === 1) return <View style={{ flex: 1 }}>{contenido}</View>;

  return (
    <View style={{ flex: 1 }}>
      <View accessibilityRole="tablist" className="flex-row bg-card border-b border-border">
        {paginas.map((p, i) => {
          const activa = i === pagina;
          return (
            <Pressable
              key={p.key}
              onPress={() => irA(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activa }}
              className="flex-1 flex-row items-center justify-center gap-2 pt-3 pb-2.5 active:opacity-70"
              style={{ borderBottomWidth: 3, borderBottomColor: activa ? p.color : 'transparent' }}
            >
              <Ionicons name={p.icon} size={16} color={activa ? p.color : COLORS.mutedForeground} />
              <Text className="text-sm font-bold" style={{ color: activa ? COLORS.foreground : COLORS.mutedForeground }}>
                {p.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={alDeslizar}
        scrollEventThrottle={16}
      >
        {contenido}
      </ScrollView>
    </View>
  );
}
