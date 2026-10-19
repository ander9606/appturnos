import { Text, TextInput } from '@/components/ui/Text';
import { showAlert } from '@/lib/alertDialog';
import { Spinner } from '@/components/ui/Spinner';
import { COLORS } from '@/lib/designTokens';
import React, { useState, useMemo } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/Button';
import { useCargos } from '@/features/turnos/useTurnos';
import { CargoModal } from './CargoModal';
import { validateStep2 } from './utils';
import type { WizardData, PuestoInput } from './types';
import type { Cargo } from '@api-client';
import { confirm } from '@/lib/confirmDialog';

type Props = {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  onNext: () => void;
  onBack: () => void;
};

export function Step2Puestos({ data, onChange, onNext, onBack }: Props) {
  const { data: cargos = [], isLoading } = useCargos();
  const [modalOpen, setModalOpen] = useState(false);

  const usedIds = useMemo(() => new Set(data.puestos.map((p) => p.cargo_id)), [data.puestos]);

  const addPuesto = (cargo: Cargo) => {
    onChange({
      puestos: [
        ...data.puestos,
        { key: String(Date.now()), cargo_id: cargo.id, cargo_nombre: cargo.nombre, plazas: 1, tarifa_dia: '' },
      ],
    });
  };

  const removePuesto = async (key: string) => {
    const puesto = data.puestos.find((p) => p.key === key);
    const doRemove = () => onChange({ puestos: data.puestos.filter((p) => p.key !== key) });

    if (puesto?.tarifa_dia) {
      const ok = await confirm({
        title: '¿Quitar este rol?',
        message: `Perderás la tarifa y plazas que ya cargaste para ${puesto.cargo_nombre}.`,
        confirmLabel: 'Quitar',
        destructive: true,
      });
      if (ok) doRemove();
      return;
    }
    doRemove();
  };

  const updatePuesto = (key: string, patch: Partial<PuestoInput>) => {
    onChange({
      puestos: data.puestos.map((p) => (p.key === key ? { ...p, ...patch } : p)),
    });
  };

  const handleNext = () => {
    const err = validateStep2(data.puestos);
    if (err) { showAlert('Datos incompletos', err, 'warning'); return; }
    onNext();
  };

  return (
    <ScrollView
      contentContainerClassName="px-5 py-4 gap-4 pb-10"
      keyboardShouldPersistTaps="handled"
    >
      <View className="gap-1">
        <Text className="text-sm font-semibold text-foreground">Roles necesarios *</Text>
        <Text className="text-xs text-muted-foreground">
          Agrega cada cargo con su número de plazas y tarifa por turno. Los
          trabajadores con ese cargo recibirán una notificación al publicar.
        </Text>
      </View>

      {data.puestos.map((p) => (
        <View
          key={p.key}
          className="bg-card rounded-2xl px-4 py-4 gap-3"
          style={{ elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6 }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2 flex-1">
              <View className="w-7 h-7 bg-primary-100 rounded-xl items-center justify-center">
                <Ionicons name="briefcase-outline" size={14} color={COLORS.primary} />
              </View>
              <Text className="text-sm font-bold text-foreground flex-1" numberOfLines={1}>
                {p.cargo_nombre}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => removePuesto(p.key)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
            </TouchableOpacity>
          </View>

          <View className="flex-row gap-4">
            <View className="gap-1">
              <Text className="text-xs text-muted-foreground">Plazas</Text>
              <View className="flex-row items-center gap-2">
                <TouchableOpacity
                  className="w-8 h-8 bg-muted rounded-xl items-center justify-center"
                  onPress={() => updatePuesto(p.key, { plazas: Math.max(1, p.plazas - 1) })}
                >
                  <Ionicons name="remove" size={16} color={COLORS.mutedForeground} />
                </TouchableOpacity>
                <Text className="text-base font-bold text-foreground w-6 text-center">
                  {p.plazas}
                </Text>
                <TouchableOpacity
                  className="w-8 h-8 bg-muted rounded-xl items-center justify-center"
                  onPress={() => updatePuesto(p.key, { plazas: p.plazas + 1 })}
                >
                  <Ionicons name="add" size={16} color={COLORS.mutedForeground} />
                </TouchableOpacity>
              </View>
            </View>

            <View className="flex-1 gap-1">
              <Text className="text-xs text-muted-foreground">Tarifa por turno</Text>
              <View className="flex-row items-center bg-muted rounded-xl px-3 gap-1">
                <Text className="text-sm font-bold text-muted-foreground">$</Text>
                <TextInput
                  className="flex-1 py-2 text-sm font-semibold text-foreground"
                  placeholder="120.000"
                  placeholderTextColor={COLORS.placeholder}
                  value={p.tarifa_dia}
                  onChangeText={(t) => updatePuesto(p.key, { tarifa_dia: t.replace(/[^\d.,]/g, '') })}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>
        </View>
      ))}

      <TouchableOpacity
        className="flex-row items-center justify-center gap-2 py-3 border-2 border-dashed border-border rounded-2xl"
        onPress={() => setModalOpen(true)}
        disabled={isLoading}
      >
        {isLoading
          ? <Spinner size="small" color={COLORS.placeholder} />
          : <Ionicons name="add-circle-outline" size={20} color={COLORS.mutedForeground} />}
        <Text className="text-sm font-semibold text-muted-foreground">
          {isLoading ? 'Cargando roles…' : 'Agregar rol'}
        </Text>
      </TouchableOpacity>

      <View className="flex-row gap-3 mt-2">
        <Button label="← Atrás" variant="secondary" onPress={onBack} style={{ flex: 1 }} />
        <Button label="Siguiente →" variant="primary" onPress={handleNext} style={{ flex: 2 }} />
      </View>

      <CargoModal
        visible={modalOpen}
        cargos={cargos}
        usedIds={usedIds}
        onSelect={addPuesto}
        onClose={() => setModalOpen(false)}
      />
    </ScrollView>
  );
}
