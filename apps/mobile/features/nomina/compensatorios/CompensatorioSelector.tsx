/**
 * Al marcar un día como «Compensatorio» el gestor elige cuál de los descansos pendientes del trabajador se
 * descuenta. Solo ofrece los que se pueden tomar ese día (ventana de 28 días) y deja el más antiguo
 * preseleccionado. El backend vuelve a validarlo: es quien decide de verdad.
 */
import { Text } from '@/components/ui/Text';
import { COLORS } from '@/lib/designTokens';
import React, { useEffect, useMemo } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fmtFechaCorta } from '../trabajador/nominaTrabajadorUtils';
import { useCompensatoriosTodos } from './useCompensatorios';
import { compensatoriosDisponibles, vencimientoCompensatorio } from './disponibles';
import { ClasificacionBadge } from './FilasCompensatorio';

export function CompensatorioSelector({ trabajadorId, fecha, value, onChange }: {
  trabajadorId: number;
  /** Día que se está marcando (YYYY-MM-DD). */
  fecha: string;
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const { data: todos = [], isLoading } = useCompensatoriosTodos();
  const disponibles = useMemo(() => compensatoriosDisponibles(todos, trabajadorId, fecha), [todos, trabajadorId, fecha]);

  // El más antiguo queda preseleccionado; si cambia la fecha y el elegido ya no sirve, vuelve al más antiguo.
  useEffect(() => {
    const id = disponibles.some((c) => c.id === value) ? value : disponibles[0]?.id ?? null;
    if (id !== value) onChange(id);
  }, [disponibles, value, onChange]);

  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-foreground">Compensatorio a descontar</Text>

      {isLoading ? (
        <Text className="text-xs text-muted-foreground">Buscando compensatorios pendientes…</Text>
      ) : disponibles.length === 0 ? (
        <View className="bg-warning-light rounded-xl px-4 py-3 flex-row items-start gap-2">
          <Ionicons name="alert-circle-outline" size={16} color={COLORS.warning} />
          <Text className="text-xs text-warning flex-1 leading-relaxed">
            El trabajador no tiene compensatorios pendientes que se puedan tomar el {fmtFechaCorta(fecha)}.
            Si es un descanso sin compensatorio, usa el tipo «Descanso».
          </Text>
        </View>
      ) : (
        <View className="bg-card border border-border rounded-2xl overflow-hidden">
          {disponibles.map((c, i) => {
            const elegido = c.id === value;
            return (
              <TouchableOpacity
                key={c.id}
                onPress={() => onChange(c.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: elegido }}
                className={`px-4 py-3 flex-row items-center gap-3 ${i > 0 ? 'border-t border-border' : ''}`}
              >
                <Ionicons
                  name={elegido ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={elegido ? COLORS.success : COLORS.mutedForeground}
                />
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-foreground">
                    Trabajó el {fmtFechaCorta(c.origen_fecha)}{i === 0 ? ' · el más antiguo' : ''}
                  </Text>
                  <Text className="text-xs text-muted-foreground">Vence el {fmtFechaCorta(vencimientoCompensatorio(c.origen_fecha))}</Text>
                </View>
                <ClasificacionBadge clasificacion={c.clasificacion} />
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}
