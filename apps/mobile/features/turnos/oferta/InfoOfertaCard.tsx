import React from 'react';
import { View, TouchableOpacity, Linking, Platform, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { COLORS } from '@/lib/designTokens';
import { useTheme } from '@/lib/theme';
import { showAlert } from '@/lib/alertDialog';
import { showToast } from '@/lib/toast';
import { useActualizarOferta } from '@/features/turnos/useTurnos';
import { ApiError } from '@api-client';
import type { OfertaDetalle } from '@api-client';
import { fmtDate } from './fechasOferta';

function fmtRange(start: string, end: string | null, finDiaSiguiente?: number | null) {
  const s = start.slice(0, 5).replace(/^0/, '');
  return end ? `${s} – ${end.slice(0, 5).replace(/^0/, '')}${finDiaSiguiente ? ' (día sig.)' : ''}` : s;
}

/** Tarjeta principal: título, plazas, fecha, horario, lugar (con mapa) y ubicación libre. */
export function InfoOfertaCard({ oferta, esPasado, puedeGestionar, ofertaEsEditable }: {
  oferta: OfertaDetalle;
  esPasado: boolean;
  puedeGestionar: boolean;
  ofertaEsEditable: boolean;
}) {
  const theme = useTheme();
  const actualizarOfertaM = useActualizarOferta();
  const totalPlazas     = oferta.puestos.reduce((s, p) => s + p.plazas, 0);
  const plazasCubiertas = oferta.puestos.reduce((s, p) => s + p.plazas_cubiertas, 0);
  const hasCoords = oferta.latitud != null && oferta.longitud != null;

  function openInMaps() {
    if (!hasCoords) return;
    const lat   = oferta.latitud!;
    const lng   = oferta.longitud!;
    const label = encodeURIComponent(oferta.lugar ?? 'Turno');
    const url = Platform.select({
      ios:     `maps://app?q=${label}&ll=${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
    }) ?? `https://maps.google.com/?q=${lat},${lng}`;
    Linking.openURL(url).catch(() =>
      Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`)
    );
  }

  async function handleToggleUbicacionLibre(value: boolean) {
    try {
      await actualizarOfertaM.mutateAsync({ id: oferta.id, ubicacion_libre: value });
      showToast(value ? 'Turno marcado con ubicación libre.' : 'Ubicación libre desactivada.');
    } catch (err) {
      showAlert('Error', err instanceof ApiError ? err.message : 'No se pudo actualizar el turno.');
    }
  }

  return (
    <View className="bg-card rounded-3xl overflow-hidden"
      style={{ elevation: 3, shadowColor: COLORS.shadow, shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}>
      <View className="h-2" style={{ backgroundColor: esPasado ? COLORS.borderStrong : COLORS.primary400 }} />
      <View className="px-5 py-5 gap-3">
        <View className="flex-row items-start justify-between gap-2">
          <Text className="text-xl font-bold text-foreground flex-1 pr-2" numberOfLines={2}>
            {oferta.titulo}
          </Text>
          <View className="px-2.5 py-1 rounded-full bg-muted">
            <Text className="text-xs font-semibold text-muted-foreground">
              {plazasCubiertas}/{totalPlazas} plazas
            </Text>
          </View>
        </View>

        {/* Fecha */}
        <View className="flex-row items-center gap-3">
          <View className="w-8 h-8 bg-muted rounded-xl items-center justify-center">
            <Ionicons name="calendar-outline" size={16} color={COLORS.mutedForeground} />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-muted-foreground">Fecha</Text>
            <Text className="text-sm font-medium text-foreground">{fmtDate(oferta.fecha)}</Text>
          </View>
        </View>

        {/* Horario */}
        <View className="flex-row items-center gap-3">
          <View className="w-8 h-8 bg-muted rounded-xl items-center justify-center">
            <Ionicons name="time-outline" size={16} color={COLORS.mutedForeground} />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-muted-foreground">Horario</Text>
            <Text className="text-sm font-medium text-foreground">
              {fmtRange(oferta.hora_inicio, oferta.hora_fin_estimada, oferta.fin_dia_siguiente)}
            </Text>
          </View>
        </View>

        {/* Lugar */}
        {oferta.lugar && (
          <View className="flex-row items-center gap-3">
            <View className="w-8 h-8 bg-muted rounded-xl items-center justify-center">
              <Ionicons name="location-outline" size={16} color={COLORS.mutedForeground} />
            </View>
            <View className="flex-1">
              <Text className="text-xs text-muted-foreground">Lugar</Text>
              <Text className="text-sm font-medium text-foreground">{oferta.lugar}</Text>
            </View>
            {hasCoords && (
              <TouchableOpacity onPress={openInMaps}
                className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="map-outline" size={14} color={COLORS.info} />
                <Text className="text-xs font-semibold text-info">Mapa</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Ubicación libre: gestor puede editarla mientras la oferta siga
            abierta/borrador; el resto solo ve el aviso si está activa. */}
        {puedeGestionar && ofertaEsEditable ? (
          <View className="flex-row items-center gap-3">
            <View className="w-8 h-8 bg-muted rounded-xl items-center justify-center">
              <Ionicons name="navigate-circle-outline" size={16} color={COLORS.mutedForeground} />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-medium text-foreground">Ubicación libre</Text>
              <Text className="text-xs text-muted-foreground">
                Sin restricción al marcar ingreso/egreso
              </Text>
            </View>
            <Switch
              value={oferta.ubicacion_libre === 1}
              onValueChange={handleToggleUbicacionLibre}
              disabled={actualizarOfertaM.isPending}
              trackColor={{ true: theme.primary }}
              thumbColor={COLORS.white}
            />
          </View>
        ) : oferta.ubicacion_libre === 1 ? (
          <View className="flex-row items-center gap-3">
            <View className="w-8 h-8 bg-muted rounded-xl items-center justify-center">
              <Ionicons name="navigate-circle-outline" size={16} color={COLORS.mutedForeground} />
            </View>
            <View className="flex-1">
              <Text className="text-xs text-muted-foreground">Ubicación</Text>
              <Text className="text-sm font-medium text-foreground">Libre — sin restricción geográfica</Text>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}
