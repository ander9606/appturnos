import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { COLORS } from '@/lib/designTokens';
import { FuncionesCargoModal } from '@/features/turnos/FuncionesCargoModal';
import type { OfertaPuesto } from '@api-client';

/** Cargos y tarifas de la oferta. El trabajador que aún puede postularse elige aquí el cargo y puede ver sus funciones. */
export function PuestosCard({ puestos, isWorker, yaAplicado, yaNoSePuedePostular, availablePuestos, selectedPuesto, onSelect }: {
  puestos: OfertaPuesto[];
  isWorker: boolean;
  yaAplicado: boolean;
  yaNoSePuedePostular: boolean;
  availablePuestos: OfertaPuesto[];
  selectedPuesto: OfertaPuesto | undefined;
  onSelect: (id: number) => void;
}) {
  const [funcionesPuesto, setFuncionesPuesto] = useState<OfertaPuesto | null>(null);

  return (
    <>
      <View className="bg-card rounded-2xl px-5 py-4 gap-3"
        style={{ elevation: 1, shadowColor: COLORS.shadow, shadowOpacity: 0.04, shadowRadius: 8 }}>
        <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {isWorker && !yaAplicado && !yaNoSePuedePostular && availablePuestos.length > 1
            ? '¿A qué cargo quieres aplicar?'
            : 'Cargos y tarifas'}
        </Text>
        {puestos.map((p) => {
          const seleccionable = isWorker && !yaAplicado && !yaNoSePuedePostular
            && availablePuestos.length > 1 && p.plazas_cubiertas < p.plazas;
          const seleccionado = seleccionable && p.id === selectedPuesto?.id;
          const Row = (
            <View className={`flex-row items-center justify-between py-2 border-b border-border last:border-0 ${seleccionable ? 'px-3 rounded-xl border' : ''} ${seleccionado ? 'bg-primary/10 border-primary' : seleccionable ? 'border-border' : ''}`}>
              <View className="flex-1 gap-0.5 flex-row items-center gap-2">
                {seleccionable && (
                  <Ionicons
                    name={seleccionado ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={seleccionado ? COLORS.primary400 : COLORS.placeholder}
                  />
                )}
                <View className="flex-1 gap-0.5">
                  <Text className="text-sm font-semibold text-foreground">{p.cargo_nombre}</Text>
                  {p.notas && (
                    <Text className="text-xs text-muted-foreground">{p.notas}</Text>
                  )}
                  {isWorker && (
                    <TouchableOpacity onPress={() => setFuncionesPuesto(p)} hitSlop={6} className="flex-row items-center gap-1 mt-0.5">
                      <Ionicons name="list-outline" size={12} color={COLORS.info} />
                      <Text className="text-xs text-info font-medium">Ver funciones</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              <View className="items-end gap-0.5">
                <Text className="text-sm font-bold text-success">
                  ${p.tarifa_dia.toLocaleString('es-CO')}
                </Text>
                <Text className="text-xs text-muted-foreground">
                  {p.plazas_cubiertas}/{p.plazas} plazas
                </Text>
              </View>
            </View>
          );
          return seleccionable ? (
            <TouchableOpacity key={p.id} onPress={() => onSelect(p.id)}>
              {Row}
            </TouchableOpacity>
          ) : (
            <View key={p.id}>{Row}</View>
          );
        })}
      </View>

      <FuncionesCargoModal
        visible={!!funcionesPuesto}
        onClose={() => setFuncionesPuesto(null)}
        cargoId={funcionesPuesto?.cargo_id ?? null}
        cargoNombre={funcionesPuesto?.cargo_nombre ?? ''}
      />
    </>
  );
}
