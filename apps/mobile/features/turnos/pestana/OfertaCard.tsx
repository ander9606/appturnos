import { Text } from '@/components/ui/Text';
import { Badge }   from '@/components/ui/Badge';
import { Button }  from '@/components/ui/Button';
import { COLORS } from '@/lib/designTokens';
import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Asignacion, Oferta } from '@api-client';
import { formatShortDate, fmtRangeSimple, turnosSolapan } from './turnosPestana';

/** Tarjeta de una oferta disponible en la lista del trabajador (postular, elegir cargo o ver detalle). */
export function OfertaCard({
  item, today, yaAplicado, turnosConfirmados, aplicando, onAplicar,
}: {
  item: Oferta;
  today: string;
  yaAplicado: boolean;
  turnosConfirmados: Asignacion[];
  aplicando: boolean;
  onAplicar: (ofertaId: number, puestoId: number) => void;
}) {
  const router = useRouter();
  const esPasado = item.fecha < today;
  const plazasLibres = item.puestos?.reduce((s, p) => s + (p.plazas - p.plazas_cubiertas), 0) ?? 0;
  const tarifaMin = item.puestos?.length > 0 ? Math.min(...item.puestos.map(p => p.tarifa_dia)) : 0;
  const hayVariasTarifas = item.puestos?.length > 1 && item.puestos.some(p => p.tarifa_dia !== tarifaMin);
  const puestosDisponibles = item.puestos?.filter(p => p.plazas_cubiertas < p.plazas) ?? [];
  const firstAvailablePuesto = puestosDisponibles[0];
  const hayVariosCargos = puestosDisponibles.length > 1;
  const hayTraslape = !esPasado && turnosSolapan(item, turnosConfirmados);

  return (
    <TouchableOpacity
      onPress={() => router.push(`/oferta/${item.id}` as any)}
      activeOpacity={0.8}
      className="bg-card rounded-2xl overflow-hidden flex-row"
      style={{
        elevation: esPasado ? 0 : 2,
        shadowColor: COLORS.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: esPasado ? 0 : 0.06,
        shadowRadius: 8,
        opacity: esPasado ? 0.65 : 1,
      }}
    >
      {/* Accent bar */}
      <View
        className="w-1.5"
        style={{ backgroundColor: esPasado ? COLORS.borderStrong : hayTraslape ? COLORS.warning : COLORS.primary400 }}
      />

      <View className="flex-1 px-4 py-4 gap-2">
        {item.empresa_nombre && (
          <View className="flex-row items-center gap-1">
            <Ionicons name="business-outline" size={12} color={COLORS.placeholder} />
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide" numberOfLines={1}>
              {item.empresa_nombre}
            </Text>
          </View>
        )}

        <View className="flex-row items-start justify-between gap-2">
          <Text className="text-base font-semibold text-foreground flex-1" numberOfLines={1}>
            {item.titulo}
          </Text>
          {esPasado ? (
            <Badge label="Pasado" variant="default" size="sm" />
          ) : plazasLibres > 0 ? (
            <Badge
              label={`${plazasLibres} libre${plazasLibres > 1 ? 's' : ''}`}
              variant={plazasLibres <= 2 ? 'warning' : 'info'}
              size="sm"
            />
          ) : null}
        </View>

        {hayVariosCargos ? (
          <View className="flex-row items-center gap-1 -mt-1">
            <Ionicons name="briefcase-outline" size={12} color={COLORS.mutedForeground} />
            <Text className="text-xs text-muted-foreground">
              {puestosDisponibles.length} cargos disponibles
            </Text>
          </View>
        ) : (firstAvailablePuesto ?? item.puestos?.[0])?.cargo_nombre && (
          <View className="flex-row items-center gap-1 -mt-1">
            <Ionicons name="briefcase-outline" size={12} color={COLORS.mutedForeground} />
            <Text className="text-xs text-muted-foreground">
              {(firstAvailablePuesto ?? item.puestos?.[0])?.cargo_nombre}
            </Text>
          </View>
        )}

        {hayTraslape && (
          <View className="flex-row items-center gap-1.5 bg-warning/10 rounded-xl px-2.5 py-1.5">
            <Ionicons name="warning-outline" size={13} color={COLORS.warningDark} />
            <Text className="text-xs font-medium text-warning flex-1">
              Ya tienes un turno confirmado en este horario
            </Text>
          </View>
        )}

        <View className="flex-row gap-3 flex-wrap">
          <View className="flex-row items-center gap-1">
            <Ionicons name="calendar-outline" size={13} color={COLORS.mutedForeground} />
            <Text className="text-sm text-muted-foreground">
              {formatShortDate(item.fecha)}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Ionicons name="time-outline" size={13} color={COLORS.mutedForeground} />
            <Text className="text-sm text-muted-foreground">
              {fmtRangeSimple(item.hora_inicio, item.hora_fin_estimada, item.fin_dia_siguiente)}
            </Text>
          </View>
          {item.lugar && (
            <View className="flex-row items-center gap-1 flex-1">
              <Ionicons name="location-outline" size={13} color={COLORS.mutedForeground} />
              <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                {item.lugar}
              </Text>
            </View>
          )}
        </View>

        <View className="flex-row items-center justify-between mt-1">
          <Text className={`text-sm font-semibold ${esPasado ? 'text-muted-foreground' : 'text-success'}`}>
            {hayVariasTarifas ? 'Desde ' : ''}${tarifaMin.toLocaleString('es-CO')} / turno
          </Text>
          {esPasado ? (
            <Text className="text-xs text-muted-foreground">Evento finalizado</Text>
          ) : yaAplicado ? (
            <Badge label="Ya postulado" variant="info" size="sm" />
          ) : !firstAvailablePuesto ? (
            <Badge label="Sin plazas" variant="default" size="sm" />
          ) : hayVariosCargos ? (
            <Button
              label="Elegir cargo"
              variant="primary"
              size="sm"
              onPress={() => router.push(`/oferta/${item.id}` as any)}
            />
          ) : (
            <Button
              label={aplicando ? 'Aplicando…' : 'Aplicar'}
              variant="primary"
              size="sm"
              loading={aplicando}
              onPress={() => onAplicar(item.id, firstAvailablePuesto.id)}
            />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
