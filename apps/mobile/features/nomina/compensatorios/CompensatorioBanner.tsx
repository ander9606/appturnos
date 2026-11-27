/**
 * CompensatorioBanner — muestra al trabajador_nomina:
 *  - Banner ámbar si tiene días compensatorios PENDIENTES (aún sin fecha).
 *  - Banner verde si tiene días compensatorios ASIGNADOS próximos. Colores por tokens (DISENO §6), cama + fecha en vez de prosa.
 */

import { COLORS } from '@/lib/designTokens';
import { Text } from '@/components/ui/Text';
import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DescansoCompensatorio } from '@api-client';
import { fmtFechaCorta } from '../trabajador/nominaTrabajadorUtils';
import { bogotaToday } from '@/lib/formatters';
import { diasParaVencer, textoVencimiento, colorVencimiento } from './disponibles';

/** Desde cuántas filas pendientes se pliega la lista: con 1–2 no vale la pena esconderlas. */
const PLEGAR_DESDE = 3;

interface Props {
  compensatorios: DescansoCompensatorio[];
}

export function CompensatorioBanner({ compensatorios }: Props) {
  const [pendientesAbiertos, setPendientesAbiertos] = useState(false);
  const [masAbiertos, setMasAbiertos] = useState(false);
  const hoy = bogotaToday();
  const pendientes = compensatorios.filter((c) => c.estado === 'pendiente');
  // ponytail: el backend pasa de 'asignado' a 'tomado' en el mismo request al crear el
  // registro del día (compensatorios.service.js asignar()) — 'asignado' nunca queda
  // observable. Con fecha futura, un 'tomado' es en realidad un descanso próximo, no pasado.
  // Upgrade path: si el backend separa ambos pasos, volver a filtrar por estado==='asignado'.
  const asignados = compensatorios.filter(
    (c) => c.estado === 'tomado' && c.fecha_asignada && c.fecha_asignada >= hoy
  );

  if (pendientes.length === 0 && asignados.length === 0) return null;

  // Los pendientes más antiguos primero: el primero es el que vence antes.
  const pendientesOrd = [...pendientes].sort((a, b) => a.origen_fecha.localeCompare(b.origen_fecha) || a.id - b.id);
  const diasMasAntiguo = pendientesOrd.length > 0 ? diasParaVencer(pendientesOrd[0].origen_fecha, hoy) : 0;
  const plegable = pendientesOrd.length >= PLEGAR_DESDE;
  const verFilas = !plegable || pendientesAbiertos;

  // Los descansos asignados, el más próximo primero: ese siempre se ve (es el accionable); el resto, tras «+N más».
  const asignadosOrd = [...asignados].sort((a, b) => a.fecha_asignada!.localeCompare(b.fecha_asignada!));
  const [proximo, ...restoAsignados] = asignadosOrd;

  return (
    <View className="gap-2">
      {pendientes.length > 0 && (
        <View
          className="bg-warning-light border rounded-2xl px-4 py-3 flex-row items-start gap-3"
          style={{ borderColor: COLORS.warningSoft }}
        >
          <Ionicons name="bed-outline" size={20} color={COLORS.warningText} style={{ marginTop: 1 }} />
          <View className="flex-1 gap-1">
            <TouchableOpacity
              disabled={!plegable}
              onPress={() => setPendientesAbiertos((v) => !v)}
              accessibilityRole={plegable ? 'button' : undefined}
              accessibilityState={plegable ? { expanded: pendientesAbiertos } : undefined}
              accessibilityLabel={plegable ? `${pendientesAbiertos ? 'Contraer' : 'Desplegar'} los días trabajados pendientes` : undefined}
              className="flex-row items-center gap-2"
            >
              <Text className="flex-1 text-sm font-semibold" style={{ color: COLORS.warningText }}>
                {pendientes.length === 1
                  ? '1 descanso compensatorio pendiente'
                  : `${pendientes.length} descansos compensatorios pendientes`}
              </Text>
              {plegable && (
                <Ionicons name={pendientesAbiertos ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.warningText} />
              )}
            </TouchableOpacity>
            <Text className="text-xs" style={{ color: COLORS.warningText }}>
              Tu empleador asignará la fecha y te avisaremos.
            </Text>
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="time-outline" size={12} color={colorVencimiento(diasMasAntiguo)} />
              <Text className="text-xs font-medium" style={{ color: colorVencimiento(diasMasAntiguo) }}>
                {pendientes.length > 1 ? `El más antiguo: ${textoVencimiento(diasMasAntiguo).toLowerCase()}` : textoVencimiento(diasMasAntiguo)}
              </Text>
            </View>
            {verFilas && pendientesOrd.map((c) => (
              <View key={c.id} className="flex-row items-center gap-1.5">
                <Ionicons name="calendar-outline" size={12} color={COLORS.warningText} />
                <Text className="text-xs" style={{ color: COLORS.warningText }}>
                  Trabajaste el {fmtFechaCorta(c.origen_fecha)}
                  {c.clasificacion === 'habitual' ? ' · con recargo' : ''}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {proximo && <DescansoAsignado c={proximo} />}
      {restoAsignados.length > 0 && (
        <TouchableOpacity
          onPress={() => setMasAbiertos((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: masAbiertos }}
          accessibilityLabel={`${masAbiertos ? 'Ocultar' : 'Ver'} ${restoAsignados.length} descansos más`}
          className="self-start flex-row items-center gap-1 py-1"
        >
          <Text className="text-xs font-semibold" style={{ color: COLORS.successText }}>
            {masAbiertos ? 'Ocultar' : `+${restoAsignados.length} más`}
          </Text>
          <Ionicons name={masAbiertos ? 'chevron-up' : 'chevron-down'} size={14} color={COLORS.successText} />
        </TouchableOpacity>
      )}
      {masAbiertos && restoAsignados.map((c) => <DescansoAsignado key={c.id} c={c} />)}
    </View>
  );
}

function DescansoAsignado({ c }: { c: DescansoCompensatorio }) {
  return (
    <View
      className="bg-success-light border rounded-2xl px-4 py-3 flex-row items-start gap-3"
      style={{ borderColor: COLORS.successText }}
    >
      <Ionicons name="bed-outline" size={20} color={COLORS.successText} style={{ marginTop: 1 }} />
      <View className="flex-1 gap-0.5">
        <Text className="text-sm font-semibold" style={{ color: COLORS.successText }}>
          Descanso el {fmtFechaCorta(c.fecha_asignada!)}: no asistes
        </Text>
        <Text className="text-xs" style={{ color: COLORS.successText }}>
          Por tu trabajo el {fmtFechaCorta(c.origen_fecha)}
          {c.clasificacion === 'habitual' ? ' · ese día también lleva recargo' : ''}
        </Text>
      </View>
    </View>
  );
}
