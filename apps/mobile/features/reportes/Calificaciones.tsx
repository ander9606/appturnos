import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { CalificacionesTurnos, PersonaCalificada } from '@api-client';
import { Text } from '@/components/ui/Text';
import { COLORS, alpha } from '@/lib/designTokens';

/** 4.13 → "4,1" */
export const calificacionTxt = (n: number) => n.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nombreDe = (p: { nombre: string; apellido: string | null }) => `${p.nombre}${p.apellido ? ` ${p.apellido}` : ''}`;

/** Estrella + promedio, en pequeño (para filas de personas). */
export function PromedioEstrella({ promedio }: { promedio: number }) {
  return (
    <View className="flex-row items-center gap-0.5" accessibilityLabel={`Calificación ${calificacionTxt(promedio)} de 5`}>
      <Ionicons name="star" size={12} color={COLORS.warning} />
      <Text className="text-xs font-semibold text-foreground">{calificacionTxt(promedio)}</Text>
    </View>
  );
}

/** Para una calificación, subir es bueno (al revés que el costo). */
function Cambio({ delta }: { delta: number | null }) {
  if (delta == null) return null;
  const plano = Math.abs(delta) < 0.05;
  const sube = delta > 0;
  const fondo = plano ? COLORS.infoLight : sube ? COLORS.successLight : COLORS.warningLight;
  const texto = plano ? COLORS.infoText : sube ? COLORS.successText : COLORS.warningText;
  return (
    <View
      className="flex-row items-center gap-1 self-start rounded-full px-2.5 py-1"
      style={{ backgroundColor: fondo }}
      accessibilityLabel={plano ? 'Sin cambio frente al período anterior' : `${sube ? 'Subió' : 'Bajó'} ${calificacionTxt(Math.abs(delta))} frente al período anterior`}
    >
      <Ionicons name={plano ? 'remove' : sube ? 'arrow-up' : 'arrow-down'} size={12} color={texto} />
      <Text className="text-xs font-semibold" style={{ color: texto }}>{plano ? 'Sin cambio' : calificacionTxt(Math.abs(delta))}</Text>
    </View>
  );
}

/** Calificación promedio del período, su distribución por estrellas y lo que falta calificar. */
export function TarjetaCalificaciones({ cal }: { cal: CalificacionesTurnos }) {
  const max = Math.max(...Object.values(cal.distribucion), 1);
  return (
    <View className="bg-card border border-border rounded-2xl p-5">
      <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Calificación de los turnos</Text>
      {cal.promedio == null ? (
        <Text className="text-sm text-muted-foreground mt-2">Todavía no hay turnos calificados en este período.</Text>
      ) : (
        <>
          <View className="flex-row items-end gap-2 mt-1">
            <Ionicons name="star" size={28} color={COLORS.warning} style={{ marginBottom: 6 }} />
            <Text className="text-4xl font-extrabold text-foreground">{calificacionTxt(cal.promedio)}</Text>
            <Text className="text-base text-muted-foreground mb-1.5">de 5</Text>
          </View>
          <View className="flex-row items-center gap-2 mt-2">
            <Cambio delta={cal.delta} />
            {cal.previo != null && <Text className="text-xs text-muted-foreground">vs {calificacionTxt(cal.previo)} en el período anterior</Text>}
          </View>
          <View className="mt-4 gap-2">
            {([5, 4, 3, 2, 1] as const).map((e) => (
              <View key={e} className="flex-row items-center gap-2">
                <Text className="w-7 text-xs text-muted-foreground">{e} ★</Text>
                <View className="flex-1 h-2 rounded-full" style={{ backgroundColor: alpha(COLORS.warning, 0.15) }}>
                  <View className="h-2 rounded-full" style={{ width: `${(cal.distribucion[e] / max) * 100}%`, backgroundColor: COLORS.warning }} />
                </View>
                <Text className="w-8 text-right text-xs font-semibold text-foreground">{cal.distribucion[e]}</Text>
              </View>
            ))}
          </View>
        </>
      )}
      <Text className="text-xs text-muted-foreground mt-3">
        {cal.calificadas} {cal.calificadas === 1 ? 'turno calificado' : 'turnos calificados'}
        {cal.sin_calificar > 0 ? ` · ${cal.sin_calificar} completado${cal.sin_calificar === 1 ? '' : 's'} sin calificar` : ''}
      </Text>
    </View>
  );
}

function ListaCalificados({ titulo, lista }: { titulo: string; lista: PersonaCalificada[] }) {
  if (!lista.length) return null;
  return (
    <View className="mb-3">
      <Text className="text-xs font-semibold text-foreground px-1 mb-2">{titulo}</Text>
      <View className="bg-card border border-border rounded-2xl overflow-hidden">
        {lista.map((p) => (
          <View key={p.trabajador_id} className="flex-row items-center px-4 py-3 border-b border-border">
            <Text className="flex-1 text-sm font-medium text-foreground" numberOfLines={1}>{nombreDe(p)}</Text>
            <Text className="text-xs text-muted-foreground mr-3">{p.n} calificaciones</Text>
            <PromedioEstrella promedio={p.promedio} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** Mejor y menor calificados del período (solo con 3 o más calificaciones). */
export function ListasCalificados({ mejores, peores }: { mejores: PersonaCalificada[]; peores: PersonaCalificada[] }) {
  return (
    <>
      <ListaCalificados titulo="Mejor calificados" lista={mejores} />
      <ListaCalificados titulo="Menor calificación" lista={peores} />
    </>
  );
}
