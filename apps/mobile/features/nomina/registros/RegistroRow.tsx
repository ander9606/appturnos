import { Text } from '@/components/ui/Text';
import { COLORS, ACCENT, alpha } from '@/lib/designTokens';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  fmtHora,
  sesionesDelRegistro,
  spanMinutosSesion,
  fmtDuracionMin,
} from '@/features/nomina/trabajador/nominaTrabajadorUtils';
import type { RegistroDiario, DescansoCompensatorio } from '@api-client';
import { TIPOS_DIA } from './tiposDia';
import { SHORT_DAYS } from './fechasRegistro';

// ── Fila de registro ──────────────────────────────────────────────────────

export function RegistroRow({
  registro,
  onEdit,
  canEdit = true,
  compensatorio,
  onReasignar,
  onVerUbicacion,
}: {
  registro: RegistroDiario;
  onEdit: (r: RegistroDiario) => void;
  canEdit?: boolean;
  compensatorio?: DescansoCompensatorio;
  onReasignar?: (c: DescansoCompensatorio) => void;
  onVerUbicacion?: (r: RegistroDiario) => void;
}) {
  const d         = new Date(`${registro.fecha}T00:00:00`);
  const tipoDef   = TIPOS_DIA.find((t) => t.v === registro.tipo_dia);
  const esFestivo = Boolean(registro.es_festivo);
  const tieneUbicacion = registro.latitud_entrada != null || registro.latitud_salida != null;

  const totalHoras = [
    registro.horas_ordinarias,
    registro.horas_extra_diurnas,
    registro.horas_extra_nocturnas,
    registro.horas_nocturnas,
    registro.horas_festivo,
  ].reduce((a, b) => a + Number(b), 0);

  return (
    <View className="flex-row items-center px-4 py-3 gap-3 bg-card border border-border rounded-2xl">
      <View className={`w-11 items-center py-2 rounded-xl ${esFestivo ? 'bg-danger-light' : 'bg-muted'}`}>
        <Text className={`text-[10px] font-medium ${esFestivo ? 'text-danger' : 'text-muted-foreground'}`}>
          {SHORT_DAYS[d.getDay()]}
        </Text>
        <Text className={`text-sm font-bold ${esFestivo ? 'text-danger' : 'text-foreground'}`}>
          {d.getDate()}
        </Text>
      </View>

      <View className="flex-1 gap-0.5">
        {/* Un día con reingreso tiene varias sesiones: las cerradas viven en sesiones_detalle */}
        {sesionesDelRegistro(registro).map((s, i) => {
          const min = spanMinutosSesion(s);
          return (
            <Text key={i} className="text-sm font-medium text-foreground">
              {fmtHora(s.hora_entrada)} → {fmtHora(s.hora_salida)}
              {min != null && <Text className="text-xs text-muted-foreground">  · {fmtDuracionMin(min)}</Text>}
            </Text>
          );
        })}
        {tipoDef && tipoDef.v !== 'ordinario' && (
          <View className="self-start px-2 py-0.5 rounded-full" style={{ backgroundColor: alpha(tipoDef.color, 0.13) }}>
            <Text className="text-[10px] font-semibold" style={{ color: tipoDef.color }}>
              {tipoDef.label}
            </Text>
          </View>
        )}
        {registro.novedad ? (
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>{registro.novedad}</Text>
        ) : null}
      </View>

      <View className="items-end gap-1">
        <Text className="text-sm font-bold text-foreground">{totalHoras.toFixed(1)}h</Text>
        <View className="flex-row items-center gap-2">
          {canEdit && compensatorio && (
            <TouchableOpacity onPress={() => onReasignar?.(compensatorio)} hitSlop={8}>
              <Ionicons name="calendar-outline" size={16} color={tipoDef?.color ?? ACCENT.violeta} />
            </TouchableOpacity>
          )}
          {canEdit && tieneUbicacion && (
            <TouchableOpacity
              onPress={() => onVerUbicacion?.(registro)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Ver ubicación de marcaje"
            >
              <Ionicons name="location-outline" size={16} color={COLORS.info} />
            </TouchableOpacity>
          )}
          {canEdit && (
            <TouchableOpacity onPress={() => onEdit(registro)} hitSlop={8}>
              <Ionicons name="pencil-outline" size={16} color={COLORS.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}
