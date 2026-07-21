/**
 * MapaSelector — picker de ubicación interactivo (mapa + pin arrastrable).
 * Usado tanto al crear turnos (LugarInput) como al crear puntos de marcaje
 * de nómina (puntos-marcaje.tsx) — mismo componente, dos puntos de entrada.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Circle, type LatLng } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

import { Button } from './Button';
import { COLORS } from '@/lib/designTokens';

// Bogotá — centro de referencia cuando no hay coords ni GPS disponible.
const FALLBACK_CENTER: LatLng = { latitude: 4.7110, longitude: -74.0721 };

type Props = {
  visible: boolean;
  initialLat: number | null;
  initialLng: number | null;
  /** Radio en metros a dibujar como referencia visual (geofence). Opcional. */
  radiusM?: number;
  onConfirm: (lat: number, lng: number) => void;
  onClose: () => void;
};

export function MapaSelector({ visible, initialLat, initialLng, radiusM, onConfirm, onClose }: Props) {
  const [pin, setPin] = useState<LatLng>(FALLBACK_CENTER);
  const [loading, setLoading] = useState(false);

  // Al abrir: usar coords ya elegidas, o GPS, o el fallback.
  useEffect(() => {
    if (!visible) return;

    if (initialLat !== null && initialLng !== null) {
      setPin({ latitude: initialLat, longitude: initialLng });
      return;
    }

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        if (!cancelled) {
          setPin({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        }
      } catch {
        // se queda en FALLBACK_CENTER
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [visible, initialLat, initialLng]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-3 border-b border-border">
          <Text className="text-base font-bold text-foreground">Ajustar ubicación</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color="#64748B" />
          </Pressable>
        </View>

        {/* Mapa */}
        <View className="flex-1">
          {loading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color={COLORS.info} />
            </View>
          ) : (
            <MapView
              style={{ flex: 1 }}
              region={{
                latitude: pin.latitude,
                longitude: pin.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              onPress={(e) => setPin(e.nativeEvent.coordinate)}
            >
              <Marker
                coordinate={pin}
                draggable
                onDragEnd={(e) => setPin(e.nativeEvent.coordinate)}
              />
              {!!radiusM && (
                <Circle
                  center={pin}
                  radius={radiusM}
                  strokeColor={COLORS.info}
                  fillColor={`${COLORS.info}20`}
                />
              )}
            </MapView>
          )}
        </View>

        {/* Footer */}
        <View className="px-5 py-4 gap-3 border-t border-border">
          <Text className="text-xs text-muted-foreground text-center">
            Toca el mapa o arrastra el pin para ajustar el punto exacto
          </Text>
          <Text className="text-xs font-medium text-foreground text-center">
            {pin.latitude.toFixed(6)}, {pin.longitude.toFixed(6)}
          </Text>
          <Button
            label="Confirmar ubicación"
            variant="primary"
            size="lg"
            fullWidth
            onPress={() => onConfirm(pin.latitude, pin.longitude)}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
