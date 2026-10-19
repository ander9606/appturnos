import { Text, TextInput } from '@/components/ui/Text';
import { showAlert } from '@/lib/alertDialog';
import { Spinner } from '@/components/ui/Spinner';
import { COLORS } from '@/lib/designTokens';
import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { geocodingApi, type SugerenciaLugar } from '@api-client';

import { MapaSelector } from '@/components/ui/MapaSelector';
import { SugerenciasDropdown } from '@/components/ui/SugerenciasDropdown';
import { useGeocodingSearch } from '@/lib/useGeocodingSearch';
import { DEFAULT_GEOFENCE_RADIUS } from '@/lib/geo';
import { usePuntosParaTurnos } from '@/features/turnos/usePuntosMarcaje';

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  value: string;
  latitud: number | null;
  longitud: number | null;
  onChange: (lugar: string, lat: number | null, lng: number | null) => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function LugarInput({ value, latitud, longitud, onChange }: Props) {
  const { sugerencias, buscando, searched, buscarDebounced, limpiar } = useGeocodingSearch();
  const [locLoading, setLocLoading]     = useState(false);
  const [mapaVisible, setMapaVisible]   = useState(false);
  const [bibliotecaAbierta, setBibliotecaAbierta] = useState(false);
  const { data: puntos = [] } = usePuntosParaTurnos();

  const handleSelectPunto = (p: { nombre: string; latitud: number; longitud: number }) => {
    onChange(p.nombre, p.latitud, p.longitud);
    setBibliotecaAbierta(false);
  };

  // ── Forward geocoding (texto → sugerencias) ──────────────────────────────

  const handleChangeText = (text: string) => {
    // Limpiar coords si el usuario edita el texto manualmente
    onChange(text, null, null);
    buscarDebounced(text);
  };

  const handleSelect = (s: SugerenciaLugar) => {
    onChange(s.display_name, parseFloat(s.lat), parseFloat(s.lon));
    limpiar();
  };

  // ── Reverse geocoding (GPS → dirección) ──────────────────────────────────

  const usarUbicacion = async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permiso requerido', 'Activa el permiso de ubicación para buscar el lugar del turno con tu GPS.', 'warning');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      try {
        const data = await geocodingApi.reverse(lat, lng);
        onChange(data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng);
      } catch {
        // Reverse geocoding failed — just store coordinates
        onChange(`${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng);
      }
    } catch {
      showAlert('No se pudo obtener el GPS', 'Revisa que el GPS esté activado e intenta de nuevo, o busca el lugar por texto.');
    } finally {
      setLocLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View className="gap-1.5">
      {/* Input con icono de búsqueda */}
      <View className="flex-row items-center bg-muted rounded-2xl px-4 gap-2">
        <Ionicons name="search-outline" size={16} color={COLORS.mutedForeground} />
        <TextInput
          className="flex-1 py-3 text-base text-foreground"
          placeholder="Buscar dirección o lugar…"
          placeholderTextColor={COLORS.placeholder}
          value={value}
          onChangeText={handleChangeText}
          returnKeyType="search"
        />
        {buscando && <Spinner size="small" color={COLORS.placeholder} />}
        {value.length > 0 && !buscando && (
          <TouchableOpacity
            onPress={() => { onChange('', null, null); limpiar(); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={16} color={COLORS.placeholder} />
          </TouchableOpacity>
        )}
      </View>

      <SugerenciasDropdown sugerencias={sugerencias} searched={searched} onSelect={handleSelect} />

      {/* Biblioteca de ubicaciones guardadas */}
      {puntos.length > 0 && (
        <TouchableOpacity
          className="flex-row items-center gap-2 self-start px-3 py-2 bg-muted rounded-xl"
          onPress={() => setBibliotecaAbierta((v) => !v)}
        >
          <Ionicons name="bookmark-outline" size={16} color={COLORS.info} />
          <Text className="text-sm font-medium text-info">De la biblioteca de ubicaciones</Text>
        </TouchableOpacity>
      )}

      {bibliotecaAbierta && (
        <View
          className="bg-card rounded-2xl overflow-hidden border border-border"
          style={{ elevation: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 }}
        >
          {puntos.map((p, i) => (
            <TouchableOpacity
              key={p.id}
              className={`px-4 py-3 flex-row items-start gap-2.5 ${
                i < puntos.length - 1 ? 'border-b border-border' : ''
              }`}
              onPress={() => handleSelectPunto(p)}
            >
              <Ionicons name="location-outline" size={15} color={COLORS.mutedForeground} style={{ marginTop: 2 }} />
              <Text className="flex-1 text-sm text-foreground">
                {p.nombre} <Text className="text-muted-foreground">· radio {p.radio_metros} m</Text>
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* GPS + mapa buttons */}
      <View className="flex-row gap-2">
        <TouchableOpacity
          className="flex-row items-center gap-2 self-start px-3 py-2 bg-muted rounded-xl"
          onPress={usarUbicacion}
          disabled={locLoading}
        >
          {locLoading
            ? <Spinner size="small" color={COLORS.info} />
            : <Ionicons name="locate-outline" size={16} color={COLORS.info} />}
          <Text className="text-sm font-medium text-info">
            {locLoading ? 'Obteniendo GPS…' : 'Usar mi ubicación actual'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="flex-row items-center gap-2 self-start px-3 py-2 bg-muted rounded-xl"
          onPress={() => setMapaVisible(true)}
        >
          <Ionicons name="map-outline" size={16} color={COLORS.info} />
          <Text className="text-sm font-medium text-info">Ajustar en mapa</Text>
        </TouchableOpacity>
      </View>

      {/* Confirmación GPS */}
      {latitud !== null && (
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
          <Text className="text-xs text-success">
            GPS: {latitud.toFixed(5)}, {longitud?.toFixed(5)}
          </Text>
        </View>
      )}

      <MapaSelector
        visible={mapaVisible}
        initialLat={latitud}
        initialLng={longitud}
        radiusM={DEFAULT_GEOFENCE_RADIUS}
        onClose={() => setMapaVisible(false)}
        onConfirm={(lat, lng) => {
          onChange(value, lat, lng);
          setMapaVisible(false);
        }}
      />
    </View>
  );
}
