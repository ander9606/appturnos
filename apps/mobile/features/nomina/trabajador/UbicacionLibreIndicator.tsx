/**
 * UbicacionLibreIndicator — estado del GPS para trabajadores 'libre'
 *
 * A diferencia de 'fijo'/'zonal', acá no hay un punto contra el cual medir
 * distancia — solo se necesita CUALQUIER fix de ubicación antes de marcar,
 * para dejar registro de dónde se marcó (ver useNominaTrabajador).
 */
import { View, Text, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { EstadoUbicacionLibre } from './useNominaTrabajador';

export function UbicacionLibreIndicator({
  estado,
  onReintentar,
}: {
  estado: EstadoUbicacionLibre;
  onReintentar: () => void;
}) {
  if (estado === 'obteniendo') {
    return (
      <View className="bg-muted rounded-2xl px-4 py-3 flex-row items-center gap-3">
        <ActivityIndicator size="small" color="#94A3B8" />
        <Text className="text-sm font-semibold text-muted-foreground flex-1">Obteniendo tu ubicación…</Text>
      </View>
    );
  }

  if (estado === 'lista') {
    return (
      <View className="bg-success-light rounded-2xl px-4 py-3 flex-row items-center gap-3">
        <View className="w-2.5 h-2.5 rounded-full bg-success" />
        <Text className="text-sm font-semibold text-success flex-1">Ubicación lista para marcar</Text>
      </View>
    );
  }

  if (estado === 'denegada') {
    return (
      <View className="bg-warning-light rounded-2xl px-4 py-3 flex-row items-center gap-3">
        <Ionicons name="warning-outline" size={20} color="#92400E" />
        <View className="flex-1">
          <Text className="text-sm font-semibold text-amber-700">Permiso de ubicación requerido</Text>
          <Text className="text-xs text-amber-600 mt-0.5">
            Actívalo en Ajustes → Ubicación para poder marcar.
          </Text>
        </View>
        <TouchableOpacity onPress={() => Linking.openSettings()} className="rounded-xl px-3 py-2 bg-amber-700/10">
          <Text className="text-xs font-bold text-amber-700">Abrir Ajustes</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="bg-danger-light rounded-2xl px-4 py-3 flex-row items-center gap-3">
      <Ionicons name="warning-outline" size={20} color="#991B1B" />
      <View className="flex-1">
        <Text className="text-sm font-semibold text-danger">No se pudo obtener tu ubicación</Text>
        <Text className="text-xs text-danger opacity-80 mt-0.5">Verifica que el GPS esté activado.</Text>
      </View>
      <TouchableOpacity onPress={onReintentar} className="rounded-xl px-3 py-2 bg-danger/10">
        <Text className="text-xs font-bold text-danger">Reintentar</Text>
      </TouchableOpacity>
    </View>
  );
}
