import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

import { MapaSelector } from '@/components/ui/MapaSelector';
import { DEFAULT_GEOFENCE_RADIUS } from '@/lib/geo';

// ── Types ─────────────────────────────────────────────────────────────────────

type Sugerencia = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

type Props = {
  value: string;
  latitud: number | null;
  longitud: number | null;
  onChange: (lugar: string, lat: number | null, lng: number | null) => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function LugarInput({ value, latitud, longitud, onChange }: Props) {
  const [sugerencias, setSugerencias]   = useState<Sugerencia[]>([]);
  const [buscando, setBuscando]         = useState(false);
  const [locLoading, setLocLoading]     = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mapaVisible, setMapaVisible]   = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Forward geocoding (texto → sugerencias) ──────────────────────────────

  const buscar = useCallback(async (q: string) => {
    if (q.trim().length < 3) {
      setSugerencias([]);
      setDropdownOpen(false);
      return;
    }
    setBuscando(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&countrycodes=co`,
        { headers: { 'Accept-Language': 'es', 'User-Agent': 'AppTurnos/1.0' } },
      );
      const data: Sugerencia[] = await res.json();
      setSugerencias(data);
      setDropdownOpen(data.length > 0);
    } catch {
      setSugerencias([]);
      setDropdownOpen(false);
    } finally {
      setBuscando(false);
    }
  }, []);

  const handleChangeText = (text: string) => {
    // Limpiar coords si el usuario edita el texto manualmente
    onChange(text, null, null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscar(text), 400);
  };

  const handleSelect = (s: Sugerencia) => {
    onChange(s.display_name, parseFloat(s.lat), parseFloat(s.lon));
    setSugerencias([]);
    setDropdownOpen(false);
  };

  // ── Reverse geocoding (GPS → dirección) ──────────────────────────────────

  const usarUbicacion = async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'Activa los permisos de ubicación en ajustes.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
          { headers: { 'Accept-Language': 'es', 'User-Agent': 'AppTurnos/1.0' } },
        );
        const data = await res.json();
        onChange(data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng);
      } catch {
        // Reverse geocoding failed — just store coordinates
        onChange(`${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng);
      }
    } catch {
      Alert.alert('Error', 'No se pudo obtener la ubicación.');
    } finally {
      setLocLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View className="gap-1.5">
      {/* Input con icono de búsqueda */}
      <View className="flex-row items-center bg-muted rounded-2xl px-4 gap-2">
        <Ionicons name="search-outline" size={16} color="#64748B" />
        <TextInput
          className="flex-1 py-3 text-base text-foreground"
          placeholder="Buscar dirección o lugar…"
          placeholderTextColor="#94A3B8"
          value={value}
          onChangeText={handleChangeText}
          onFocus={() => sugerencias.length > 0 && setDropdownOpen(true)}
          returnKeyType="search"
        />
        {buscando && <ActivityIndicator size="small" color="#94A3B8" />}
        {value.length > 0 && !buscando && (
          <TouchableOpacity
            onPress={() => { onChange('', null, null); setSugerencias([]); setDropdownOpen(false); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={16} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Dropdown de sugerencias */}
      {dropdownOpen && sugerencias.length > 0 && (
        <View
          className="bg-card rounded-2xl overflow-hidden border border-border"
          style={{ elevation: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 }}
        >
          {sugerencias.map((s, i) => (
            <TouchableOpacity
              key={s.place_id}
              className={`px-4 py-3 flex-row items-start gap-2.5 ${
                i < sugerencias.length - 1 ? 'border-b border-border' : ''
              }`}
              onPress={() => handleSelect(s)}
            >
              <Ionicons name="location-outline" size={15} color="#64748B" style={{ marginTop: 2 }} />
              <Text className="flex-1 text-sm text-foreground" numberOfLines={2}>
                {s.display_name}
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
            ? <ActivityIndicator size="small" color="#3B82F6" />
            : <Ionicons name="locate-outline" size={16} color="#3B82F6" />}
          <Text className="text-sm font-medium text-info">
            {locLoading ? 'Obteniendo GPS…' : 'Usar mi ubicación actual'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="flex-row items-center gap-2 self-start px-3 py-2 bg-muted rounded-xl"
          onPress={() => setMapaVisible(true)}
        >
          <Ionicons name="map-outline" size={16} color="#3B82F6" />
          <Text className="text-sm font-medium text-info">Ajustar en mapa</Text>
        </TouchableOpacity>
      </View>

      {/* Confirmación GPS */}
      {latitud !== null && (
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="checkmark-circle" size={14} color="#059669" />
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
