import React from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Badge } from '@/components/ui/Badge';
import { fmtDate, fmtRange, type EstadoConfig } from '../turnosUtils';
import type { Asignacion } from '@api-client';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const LIQUIDACION_LABELS: Record<string, string> = {
  mensual: 'Mensual', quincenal: 'Quincenal', semanal: 'Semanal',
};

function InfoRow({ icon, label, value }: { icon: IoniconsName; label: string; value: string }) {
  return (
    <View className="flex-row items-start gap-3 py-3 border-b border-border last:border-0">
      <View className="w-8 h-8 bg-muted rounded-xl items-center justify-center mt-0.5">
        <Ionicons name={icon} size={16} color="#64748B" />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-xs text-muted-foreground">{label}</Text>
        <Text className="text-sm font-medium text-foreground">{value}</Text>
      </View>
    </View>
  );
}

export function TurnoHeroCard({
  asignacion, estadoConfig, isGestor, onOpenMaps,
}: {
  asignacion: Asignacion;
  estadoConfig: EstadoConfig | null;
  isGestor: boolean;
  onOpenMaps: () => void;
}) {
  const { oferta_titulo, oferta_fecha, hora_inicio, hora_fin_estimada,
          lugar, tarifa_dia, encargado_nombre, encargado_telefono,
          empresa_nombre, empresa_tipo_liquidacion, bono_monto, bono_motivo,
          trabajador_nombre, trabajador_apellido } = asignacion;

  const hasMapCoords = asignacion.latitud != null && asignacion.longitud != null;

  return (
    <View
      className="bg-card rounded-3xl overflow-hidden"
      style={{ elevation: 3, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}
    >
      <View
        className="h-2"
        style={{ backgroundColor: estadoConfig?.accentColor ?? '#E2E8F0' }}
      />

      <View className="px-5 py-5 gap-1">
        {empresa_nombre && (
          <View className="flex-row items-center gap-1.5 mb-1">
            <Ionicons name="business-outline" size={12} color="#94A3B8" />
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {empresa_nombre}
            </Text>
          </View>
        )}

        <View className="flex-row items-start justify-between">
          <Text className="text-xl font-bold text-foreground flex-1 pr-3" numberOfLines={2}>
            {oferta_titulo}
          </Text>
          {estadoConfig && (
            <Badge label={estadoConfig.label} variant={estadoConfig.badgeVariant} />
          )}
        </View>

        {isGestor && trabajador_nombre && (
          <View className="flex-row items-center gap-1.5 mt-1">
            <Ionicons name="person-outline" size={13} color="#64748B" />
            <Text className="text-sm font-semibold text-foreground">
              {trabajador_nombre} {trabajador_apellido}
            </Text>
          </View>
        )}

        <View className="mt-3">
          <InfoRow icon="calendar-outline" label="Fecha"   value={fmtDate(oferta_fecha)} />
          <InfoRow icon="time-outline"     label="Horario" value={fmtRange(hora_inicio, hora_fin_estimada)} />

          {/* Location row with Google Maps button */}
          {lugar && (
            <View className="flex-row items-start gap-3 py-3 border-b border-border">
              <View className="w-8 h-8 bg-muted rounded-xl items-center justify-center mt-0.5">
                <Ionicons name="location-outline" size={16} color="#64748B" />
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-xs text-muted-foreground">Lugar</Text>
                <Text className="text-sm font-medium text-foreground">{lugar}</Text>
              </View>
              {hasMapCoords && (
                <TouchableOpacity
                  onPress={onOpenMaps}
                  className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted mt-0.5"
                  accessibilityLabel="Ver en Google Maps"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="map-outline" size={14} color="#3B82F6" />
                  <Text className="text-xs font-semibold text-info">Mapa</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Encargado en el punto — a quién buscar/llamar al llegar */}
          {encargado_nombre && (
            <View className="flex-row items-start gap-3 py-3 border-b border-border">
              <View className="w-8 h-8 bg-muted rounded-xl items-center justify-center mt-0.5">
                <Ionicons name="person-outline" size={16} color="#64748B" />
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-xs text-muted-foreground">Encargado en el punto</Text>
                <Text className="text-sm font-medium text-foreground">{encargado_nombre}</Text>
              </View>
              {encargado_telefono && (
                <TouchableOpacity
                  onPress={() => Linking.openURL(`tel:${encargado_telefono}`)}
                  className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted mt-0.5"
                  accessibilityLabel={`Llamar a ${encargado_nombre}`}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="call-outline" size={14} color="#3B82F6" />
                  <Text className="text-xs font-semibold text-info">Llamar</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <InfoRow icon="cash-outline" label="Tarifa" value={`$${tarifa_dia.toLocaleString('es-CO')} / turno`} />
          {Number(bono_monto) > 0 && (
            <InfoRow
              icon="gift-outline"
              label={bono_motivo ? `Bono extra · ${bono_motivo}` : 'Bono extra'}
              value={`$${Number(bono_monto).toLocaleString('es-CO')}`}
            />
          )}
          {empresa_tipo_liquidacion && (
            <InfoRow
              icon="calendar-number-outline"
              label="Pago"
              value={LIQUIDACION_LABELS[empresa_tipo_liquidacion] ?? empresa_tipo_liquidacion}
            />
          )}
        </View>
      </View>
    </View>
  );
}
