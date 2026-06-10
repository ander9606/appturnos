import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { empresasApi } from '@api-client';
import { Button } from '@/components/ui/Button';
import type { WizardData } from './types';

// ── Hook ──────────────────────────────────────────────────────────────────

function useDirectorio(busqueda: string) {
  return useQuery({
    queryKey: ['empresas-directorio', busqueda],
    queryFn: () => empresasApi.directorio({ busqueda: busqueda || undefined, limit: 50 }),
    staleTime: 2 * 60_000,
  });
}

// ── Props ──────────────────────────────────────────────────────────────────

type Props = {
  data: WizardData;
  onChange: (patch: Partial<WizardData>) => void;
  onBack: () => void;
  onSubmit: () => Promise<void>;
};

// ── Component ──────────────────────────────────────────────────────────────

export function Step4Empresas({ data, onChange, onBack, onSubmit }: Props) {
  const [busqueda, setBusqueda] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { data: result, isLoading } = useDirectorio(busqueda);

  const empresas = result?.data ?? [];

  const toggleEmpresa = (id: number) =>
    onChange({
      empresa_ids: data.empresa_ids.includes(id)
        ? data.empresa_ids.filter((e) => e !== id)
        : [...data.empresa_ids, id],
    });

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      contentContainerClassName="px-5 py-4 gap-5 pb-10"
      keyboardShouldPersistTaps="handled"
    >
      <View className="gap-1">
        <Text className="text-base font-bold text-foreground">Empresas donde quiere trabajar</Text>
        <Text className="text-sm text-muted-foreground">
          Al activar su cuenta, el trabajador enviará solicitudes de vinculación a estas empresas.
          Cada empresa deberá aprobarlas.
        </Text>
      </View>

      {/* Buscador */}
      <View className="flex-row items-center bg-muted rounded-2xl px-4 gap-2">
        <Ionicons name="search-outline" size={16} color="#64748B" />
        <TextInput
          className="flex-1 py-3 text-base text-foreground"
          placeholder="Buscar empresa por nombre…"
          placeholderTextColor="#94A3B8"
          value={busqueda}
          onChangeText={setBusqueda}
          returnKeyType="search"
        />
        {busqueda.length > 0 && (
          <Pressable onPress={() => setBusqueda('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color="#94A3B8" />
          </Pressable>
        )}
      </View>

      {/* Lista */}
      {isLoading ? (
        <ActivityIndicator size="small" color="#FF5A3C" />
      ) : empresas.length === 0 ? (
        <Text className="text-sm text-muted-foreground text-center py-4">
          {busqueda ? 'Sin resultados para esa búsqueda' : 'No hay empresas en el directorio'}
        </Text>
      ) : (
        <View className="gap-2">
          {empresas.map((emp) => {
            const selected = data.empresa_ids.includes(emp.id);
            return (
              <Pressable
                key={emp.id}
                onPress={() => toggleEmpresa(emp.id)}
                className={`flex-row items-center gap-3 p-4 rounded-2xl border ${
                  selected ? 'bg-primary-50 border-primary-300' : 'bg-card border-border'
                }`}
              >
                {/* Logo placeholder / checkmark */}
                <View
                  className={`w-10 h-10 rounded-xl items-center justify-center ${
                    selected ? 'bg-primary-500' : 'bg-muted'
                  }`}
                >
                  {selected ? (
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  ) : (
                    <Ionicons name="business-outline" size={18} color="#64748B" />
                  )}
                </View>

                <View className="flex-1">
                  <Text className={`text-sm font-semibold ${selected ? 'text-primary-600' : 'text-foreground'}`}>
                    {emp.nombre}
                  </Text>
                  {emp.ciudad && (
                    <Text className="text-xs text-muted-foreground mt-0.5">{emp.ciudad}</Text>
                  )}
                </View>

                {!emp.acepta_postulaciones && (
                  <View className="bg-warning/20 px-2 py-0.5 rounded-lg">
                    <Text className="text-xs text-warning font-medium">Cerrada</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Selección actual */}
      {data.empresa_ids.length > 0 && (
        <View className="flex-row items-center gap-2 bg-primary-50 rounded-xl px-4 py-3">
          <Ionicons name="checkmark-circle" size={16} color="#FF5A3C" />
          <Text className="text-sm text-primary-600 font-medium">
            {data.empresa_ids.length} empresa{data.empresa_ids.length !== 1 ? 's' : ''} seleccionada{data.empresa_ids.length !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* Hint cuando no hay selección */}
      {data.empresa_ids.length === 0 && !isLoading && (
        <Text className="text-xs text-muted-foreground text-center">
          Puedes omitir este paso — el trabajador podrá seleccionar empresas desde su perfil.
        </Text>
      )}

      {/* Navigation */}
      <View className="flex-row gap-3 mt-2">
        <View className="flex-1">
          <Button label="← Atrás" variant="secondary" size="lg" fullWidth onPress={onBack} disabled={submitting} />
        </View>
        <View className="flex-1">
          <Button
            label={submitting ? 'Creando…' : 'Crear trabajador'}
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleSubmit}
            loading={submitting}
          />
        </View>
      </View>
    </ScrollView>
  );
}
