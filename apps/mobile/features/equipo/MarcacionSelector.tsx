/**
 * MarcacionSelector — pills Libre/Fijo/Zonal + picker de punto fijo.
 * Compartido entre asignaciones-lugar.tsx (vista masiva) y trabajador/[id].tsx
 * (edición puntual), ambos guardan vía el mismo PATCH /trabajadores/:id/marcacion.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useActualizarMarcacion } from './useEquipo';
import { confirm } from '@/lib/confirmDialog';
import type { Trabajador, PuntoMarcaje } from '@api-client';

const TIPO_MARCACION_OPTIONS = [
  { value: 'libre' as const, label: 'Libre' },
  { value: 'fijo' as const, label: 'Fijo' },
  { value: 'zonal' as const, label: 'Zonal' },
];

interface Props {
  trabajador: Pick<Trabajador, 'id' | 'nombre' | 'apellido' | 'tipo_marcacion' | 'punto_marcaje_id'>;
  puntos: PuntoMarcaje[];
}

export function MarcacionSelector({ trabajador: t, puntos }: Props) {
  const { mutate, isPending } = useActualizarMarcacion();
  const [showPuntos, setShowPuntos] = useState(false);

  const tipo = t.tipo_marcacion;
  const puntoActual = puntos.find((p) => p.id === t.punto_marcaje_id);
  const puntosFijos = puntos.filter((p) => p.tipo === 'fijo');

  async function elegirTipo(target: 'libre' | 'fijo' | 'zonal') {
    if (target === tipo) return;
    if (target === 'fijo') {
      setShowPuntos(true); // requiere elegir un punto — se guarda al seleccionar
      return;
    }
    if (target === 'libre') {
      const ok = await confirm({
        title: 'Cambiar a libre',
        message: `¿${t.nombre} ${t.apellido} podrá marcar desde cualquier ubicación?`,
      });
      if (!ok) return;
    }
    mutate({ id: t.id, tipo_marcacion: target, punto_marcaje_id: null });
  }

  function asignarPunto(p: PuntoMarcaje) {
    setShowPuntos(false);
    mutate({ id: t.id, tipo_marcacion: 'fijo', punto_marcaje_id: p.id });
  }

  return (
    <>
      <View className="gap-2">
        {tipo === 'fijo' && puntoActual ? (
          <TouchableOpacity onPress={() => setShowPuntos(true)} className="flex-row items-center gap-1">
            <Ionicons name="location-outline" size={12} color="#6366F1" />
            <Text className="text-xs text-primary" numberOfLines={1}>{puntoActual.nombre}</Text>
            <Ionicons name="pencil-outline" size={10} color="#6366F1" />
          </TouchableOpacity>
        ) : tipo === 'fijo' ? (
          <Text className="text-xs text-danger">Sin punto asignado</Text>
        ) : tipo === 'zonal' ? (
          <Text className="text-xs text-muted-foreground">Cualquier punto zonal de la empresa</Text>
        ) : (
          <Text className="text-xs text-muted-foreground">Sin restricción de ubicación</Text>
        )}

        <View className="flex-row gap-2">
          {TIPO_MARCACION_OPTIONS.map((opt) => {
            const active = tipo === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={isPending ? undefined : () => elegirTipo(opt.value)}
                disabled={isPending}
                className={`flex-1 py-1.5 rounded-full items-center ${active ? 'bg-primary/10' : 'bg-muted'}`}
              >
                {isPending && active ? (
                  <ActivityIndicator size="small" color="#6366F1" />
                ) : (
                  <Text className={`text-xs font-semibold ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                    {opt.label}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Modal selector de punto fijo */}
      <Modal visible={showPuntos} transparent animationType="slide" onRequestClose={() => setShowPuntos(false)}>
        <Pressable className="flex-1 bg-black/40" onPress={() => setShowPuntos(false)} />
        <View className="bg-background rounded-t-3xl px-5 pb-10 pt-4 gap-3">
          <View className="w-10 h-1 bg-border rounded-full self-center mb-1" />
          <Text className="text-base font-bold text-foreground">
            Seleccionar punto — {t.nombre}
          </Text>
          {puntosFijos.length === 0 ? (
            <View className="py-8 items-center gap-2">
              <Ionicons name="location-outline" size={32} color="#94A3B8" />
              <Text className="text-sm text-muted-foreground text-center">
                No hay puntos fijos configurados.{'\n'}Créalos en la sección de Empresa.
              </Text>
            </View>
          ) : (
            puntosFijos.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => asignarPunto(p)}
                className={[
                  'flex-row items-center gap-3 px-4 py-3 rounded-2xl border',
                  p.id === t.punto_marcaje_id ? 'bg-primary/5 border-primary' : 'bg-card border-border',
                ].join(' ')}
              >
                <Ionicons
                  name="location"
                  size={18}
                  color={p.id === t.punto_marcaje_id ? '#6366F1' : '#64748B'}
                />
                <View className="flex-1">
                  <Text className={`text-sm font-semibold ${p.id === t.punto_marcaje_id ? 'text-primary' : 'text-foreground'}`}>
                    {p.nombre}
                  </Text>
                  <Text className="text-xs text-muted-foreground">Radio {p.radio_metros} m</Text>
                </View>
                {p.id === t.punto_marcaje_id && (
                  <Ionicons name="checkmark-circle" size={18} color="#6366F1" />
                )}
              </TouchableOpacity>
            ))
          )}
        </View>
      </Modal>
    </>
  );
}
