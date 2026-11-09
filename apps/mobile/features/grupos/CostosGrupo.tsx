import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Skeleton } from '@/components/ui/Skeleton';
import { COLORS } from '@/lib/designTokens';
import { formatCOP } from '@/lib/formatters';
import { useCostosGrupo } from './useGrupos';

const turnos = (n: number) => `${n} turno${n === 1 ? '' : 's'}`;

function Fila({ etiqueta, detalle, valor, aviso = false }: { etiqueta: string; detalle?: string; valor: string; aviso?: boolean }) {
  return (
    <View className="flex-row items-start justify-between gap-3 py-2">
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          {aviso ? <Ionicons name="alert-circle-outline" size={14} color={COLORS.warning} /> : null}
          <Text className={`text-sm ${aviso ? 'font-semibold' : ''} text-foreground`}>{etiqueta}</Text>
        </View>
        {detalle ? <Text className="text-xs text-muted-foreground">{detalle}</Text> : null}
      </View>
      <Text className="text-sm font-semibold text-foreground">{valor}</Text>
    </View>
  );
}

/**
 * Cuánto cuesta el evento, con las mismas reglas que la liquidación (para poder compararlo con el «saldo a pagar»):
 * lo listo para pagar, lo terminado sin firmar (frenado), lo que falta por hacer (estimado) y el total proyectado.
 * Los turnos con una compensación sin responder no suman ni restan: solo se avisa de cuántos hay.
 */
export function CostosGrupo({ grupoId }: { grupoId: number }) {
  const { data: c, isLoading, isError, refetch } = useCostosGrupo(grupoId);

  if (isLoading) {
    return (
      <View className="bg-card border border-border rounded-2xl p-4 gap-2" accessibilityLabel="Cargando costos">
        <Skeleton height={12} width="35%" /><Skeleton height={24} width="55%" /><Skeleton height={12} width="80%" />
      </View>
    );
  }
  if (isError || !c) {
    return (
      <View className="bg-card border border-border rounded-2xl p-4 flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-sm text-muted-foreground">No se pudieron cargar los costos.</Text>
        <Text className="text-sm font-semibold text-primary-700" accessibilityRole="button" onPress={() => refetch()}>Reintentar</Text>
      </View>
    );
  }
  // Un grupo sin nada terminado ni comprometido no tiene costos que mostrar.
  if (c.proyectado <= 0 && c.en_espera.cantidad === 0) return null;

  const desglose = [
    c.real.bonos > 0 ? `bonos ${formatCOP(c.real.bonos)}` : null,
    c.real.descuentos > 0 ? `descuentos −${formatCOP(c.real.descuentos)}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <View className="bg-card border border-border rounded-2xl p-4" accessibilityLabel={`Costo proyectado ${formatCOP(c.proyectado)}`}>
      <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Costos</Text>
      <Text className="text-2xl font-bold text-foreground mt-1">{formatCOP(c.proyectado)}</Text>
      <Text className="text-xs text-muted-foreground">Costo proyectado del evento</Text>

      <View className="mt-3 border-t border-border">
        <Fila etiqueta="Para pagar" detalle={[turnos(c.real.turnos_pagados), desglose].filter(Boolean).join(' · ')} valor={formatCOP(c.real.total)} />
        {c.sin_firmar.cantidad > 0 ? (
          <Fila aviso etiqueta="Sin firmar" detalle={`${turnos(c.sin_firmar.cantidad)} · su pago sigue frenado hasta que firmen`} valor={formatCOP(c.sin_firmar.monto)} />
        ) : null}
        {c.estimado.turnos > 0 ? (
          <Fila etiqueta="Por hacer" detalle={`${turnos(c.estimado.turnos)} · estimado con la tarifa de cada puesto`} valor={formatCOP(c.estimado.total)} />
        ) : null}
      </View>

      {c.en_espera.cantidad > 0 ? (
        <View className="flex-row items-start gap-2 bg-warning/10 rounded-xl px-3 py-2 mt-2">
          <Ionicons name="time-outline" size={16} color={COLORS.warning} />
          <Text className="flex-1 text-xs text-foreground">
            {turnos(c.en_espera.cantidad)} con una compensación sin responder: no suma{c.en_espera.cantidad === 1 ? '' : 'n'} hasta que el trabajador decida.
          </Text>
        </View>
      ) : null}

      <Text className="text-xs text-muted-foreground mt-3">
        {c.trabajadores} trabajador{c.trabajadores === 1 ? '' : 'es'} · {c.horas.toLocaleString('es-CO', { maximumFractionDigits: 1 })} h trabajadas
      </Text>
    </View>
  );
}
