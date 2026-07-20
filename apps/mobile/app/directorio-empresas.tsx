/**
 * Directorio de empresas — trabajador_turnos
 *
 * Pantalla de descubrimiento: buscar, filtrar por ciudad y solicitar vínculo.
 * Se accede desde mis-empresas.tsx al tocar "Buscar empresa".
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { empresasApi } from '@api-client';
import type { EmpresaDirectorio } from '@api-client';
import { useSolicitar, useMisEmpresas } from '@/features/empresas/useTrabajadorEmpresa';
import { confirm } from '@/lib/confirmDialog';

// ── Company card ─────────────────────────────────────────────────────────────

type CardState = 'disponible' | 'solicitada' | 'activa' | 'cerrada' | 'archivada';

function getCardState(
  emp: EmpresaDirectorio, vinculadasIds: Set<number>, solicitadasIds: Set<number>, archivadasIds: Set<number>,
): CardState {
  if (vinculadasIds.has(emp.id))  return 'activa';
  if (solicitadasIds.has(emp.id)) return 'solicitada';
  if (archivadasIds.has(emp.id))  return 'archivada';
  if (!emp.acepta_postulaciones)  return 'cerrada';
  return 'disponible';
}

const CARD_STYLES: Record<CardState, { border: string; bg: string; label: string; labelColor: string; labelBg: string }> = {
  disponible: { border: 'border-border',      bg: 'bg-card',       label: 'Solicitar',  labelColor: 'text-primary-500', labelBg: 'bg-primary-50' },
  solicitada: { border: 'border-success/30',  bg: 'bg-success/5',  label: 'Enviada',    labelColor: 'text-success',     labelBg: 'bg-success/10' },
  activa:     { border: 'border-success/30',  bg: 'bg-success/5',  label: 'Vinculada',  labelColor: 'text-success',     labelBg: 'bg-success/10' },
  cerrada:    { border: 'border-border',      bg: 'bg-muted/40',   label: 'Cerrada',    labelColor: 'text-muted-foreground', labelBg: 'bg-muted' },
  archivada:  { border: 'border-warning/30',  bg: 'bg-card',       label: 'Solicitar de nuevo', labelColor: 'text-warning', labelBg: 'bg-warning/10' },
};

function EmpresaCard({
  emp,
  estado,
  onPress,
}: {
  emp: EmpresaDirectorio;
  estado: CardState;
  onPress: () => void;
}) {
  const s = CARD_STYLES[estado];
  const disabled = estado !== 'disponible' && estado !== 'archivada';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-center gap-3 p-4 rounded-2xl border ${s.border} ${s.bg} ${disabled ? 'opacity-60' : 'active:opacity-70'}`}
    >
      {/* Icon */}
      <View className="w-12 h-12 rounded-xl bg-muted items-center justify-center">
        <Ionicons name="business-outline" size={22} color="#64748B" />
      </View>

      {/* Info */}
      <View className="flex-1 min-w-0">
        <Text className="text-base font-bold text-foreground" numberOfLines={1}>
          {emp.nombre}
        </Text>
        {emp.ciudad ? (
          <View className="flex-row items-center gap-1 mt-0.5">
            <Ionicons name="location-outline" size={12} color="#94A3B8" />
            <Text className="text-xs text-muted-foreground">{emp.ciudad}</Text>
          </View>
        ) : null}
      </View>

      {/* State pill */}
      <View className={`rounded-xl px-3 py-1.5 ${s.labelBg}`}>
        {estado === 'disponible' || estado === 'archivada' ? (
          <Text className={`text-xs font-semibold ${s.labelColor}`}>{s.label}</Text>
        ) : estado === 'activa' ? (
          <Ionicons name="checkmark-circle" size={18} color="#059669" />
        ) : estado === 'solicitada' ? (
          <Ionicons name="time-outline" size={18} color="#059669" />
        ) : (
          <Text className={`text-xs font-semibold ${s.labelColor}`}>{s.label}</Text>
        )}
      </View>
    </Pressable>
  );
}

// ── City filter chips ─────────────────────────────────────────────────────────

const CIUDADES = ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Bucaramanga'];

function CityChips({ selected, onToggle }: { selected: string | null; onToggle: (c: string | null) => void }) {
  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={['Todas', ...CIUDADES]}
      keyExtractor={(c) => c}
      contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}
      renderItem={({ item }) => {
        const isAll = item === 'Todas';
        const active = isAll ? selected === null : selected === item;
        return (
          <Pressable
            onPress={() => onToggle(isAll ? null : item)}
            className={`rounded-full px-4 py-1.5 border ${
              active ? 'bg-foreground border-foreground' : 'bg-card border-border'
            } active:opacity-70`}
          >
            <Text className={`text-sm font-medium ${active ? 'text-background' : 'text-foreground'}`}>
              {item}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function DirectorioEmpresasScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [busqueda, setBusqueda] = useState('');
  const [ciudad, setCiudad] = useState<string | null>(null);
  const [requestedIds, setRequestedIds] = useState<Set<number>>(new Set());

  const { data: dirData, isLoading } = useQuery({
    queryKey: ['empresas-directorio', busqueda, ciudad],
    queryFn: () => empresasApi.directorio({ busqueda: busqueda || undefined, ciudad: ciudad || undefined, limit: 80 }),
    staleTime: 2 * 60_000,
  });

  const { data: misData } = useMisEmpresas();
  const solicitar = useSolicitar();

  const empresas = dirData?.data ?? [];

  const vinculadasIds = new Set<number>([
    ...(misData?.activas    ?? []).map((v) => v.empresa_id),
    ...(misData?.invitaciones ?? []).map((v) => v.empresa_id),
  ]);
  const solicitadasIds = new Set<number>([
    ...(misData?.pendientes ?? []).map((v) => v.empresa_id),
    ...requestedIds,
  ]);
  const archivadasIds = new Set<number>(
    (misData?.archivadas ?? []).map((v) => v.empresa_id),
  );

  const handleSolicitar = useCallback(async (emp: EmpresaDirectorio) => {
    const ok = await confirm({
      title: 'Solicitar vínculo',
      message: `¿Deseas enviar una solicitud a ${emp.nombre}? La empresa deberá aprobarla antes de que puedas tomar turnos.`,
      confirmLabel: 'Solicitar',
    });
    if (!ok) return;
    try {
      await solicitar.mutateAsync(emp.id);
      setRequestedIds((prev) => new Set(prev).add(emp.id));
      qc.invalidateQueries({ queryKey: ['trabajador-empresa'] });
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: string }).message)
        : 'No se pudo enviar la solicitud';
      Alert.alert('Error', msg);
    }
  }, [solicitar, qc]);

  const disponibles = empresas.filter((e) =>
    e.acepta_postulaciones && !vinculadasIds.has(e.id) && !solicitadasIds.has(e.id) && !archivadasIds.has(e.id)
  ).length;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Buscar empresa', headerBackTitle: 'Mis empresas' }} />

      {/* Search bar */}
      <View className="px-4 pt-3 pb-1">
        <View className="flex-row items-center bg-muted rounded-2xl px-4 gap-2">
          <Ionicons name="search-outline" size={16} color="#64748B" />
          <TextInput
            className="flex-1 py-3 text-base text-foreground"
            placeholder="Nombre de la empresa…"
            placeholderTextColor="#94A3B8"
            value={busqueda}
            onChangeText={setBusqueda}
            returnKeyType="search"
            autoCorrect={false}
          />
          {busqueda.length > 0 && (
            <Pressable onPress={() => setBusqueda('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color="#94A3B8" />
            </Pressable>
          )}
        </View>
      </View>

      {/* City filter */}
      <CityChips selected={ciudad} onToggle={setCiudad} />

      {/* Result count */}
      {!isLoading && empresas.length > 0 && (
        <View className="px-5 pb-2">
          <Text className="text-xs text-muted-foreground">
            {disponibles} empresa{disponibles !== 1 ? 's' : ''} disponible{disponibles !== 1 ? 's' : ''}
            {empresas.length > disponibles ? ` · ${empresas.length} en total` : ''}
          </Text>
        </View>
      )}

      {/* List */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FF5A3C" />
        </View>
      ) : empresas.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8 gap-3">
          <Ionicons name="search-outline" size={48} color="#CBD5E1" />
          <Text className="text-base font-semibold text-foreground text-center">
            {busqueda || ciudad ? 'Sin resultados' : 'No hay empresas disponibles'}
          </Text>
          {(busqueda || ciudad) && (
            <TouchableOpacity onPress={() => { setBusqueda(''); setCiudad(null); }}>
              <Text className="text-sm text-primary-500 font-semibold">Limpiar filtros</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={empresas}
          keyExtractor={(e) => String(e.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 10 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const estado = getCardState(item, vinculadasIds, solicitadasIds, archivadasIds);
            return (
              <EmpresaCard
                emp={item}
                estado={estado}
                onPress={() => handleSolicitar(item)}
              />
            );
          }}
          // Divides into two visual groups: available first, then rest
          ListFooterComponent={
            empresas.some((e) => !e.acepta_postulaciones) ? (
              <View className="mt-4 pt-4 border-t border-border">
                <Text className="text-xs text-muted-foreground text-center mb-3">
                  Empresas que no están aceptando solicitudes
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}
