import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Button } from '@/components/ui/Button';
import { fmtTime } from '../turnosUtils';
import type { Asignacion } from '@api-client';

export function TurnoCompletadoCard({
  asignacion, isGestor, cargandoContrato, onDescargarContrato, onCorregir, onIrAMisContratos,
}: {
  asignacion: Asignacion;
  isGestor: boolean;
  cargandoContrato: boolean;
  onDescargarContrato: () => void;
  onCorregir: () => void;
  onIrAMisContratos: () => void;
}) {
  const { pago_total, horas_trabajadas, hora_ingreso_real, hora_egreso_real } = asignacion;

  return (
    <View className="bg-success-light rounded-2xl px-5 py-5 gap-3">
      <View className="flex-row items-center gap-2">
        <Ionicons name="checkmark-circle" size={26} color="#059669" />
        <Text className="text-base font-bold text-success">¡Turno completado!</Text>
      </View>
      <View className="flex-row gap-4">
        {pago_total != null && (
          <View className="flex-1 bg-white/60 rounded-xl px-4 py-3">
            <Text className="text-xs text-success/70">Pago del turno</Text>
            <Text className="text-lg font-bold text-success">
              ${Number(pago_total).toLocaleString('es-CO')}
            </Text>
          </View>
        )}
        {horas_trabajadas != null && (
          <View className="flex-1 bg-white/60 rounded-xl px-4 py-3">
            <Text className="text-xs text-success/70">Horas en sitio</Text>
            <Text className="text-lg font-bold text-success">
              {Number(horas_trabajadas).toFixed(1)}h
            </Text>
          </View>
        )}
      </View>
      <View className="flex-row items-center gap-2">
        <Text className="text-xs text-success/80">Entrada:</Text>
        <Text className="text-xs font-medium text-success">
          {hora_ingreso_real ? fmtTime(hora_ingreso_real.slice(11, 19)) : '—'}
        </Text>
        <Text className="text-xs text-success/60 mx-1">·</Text>
        <Text className="text-xs text-success/80">Salida:</Text>
        <Text className="text-xs font-medium text-success">
          {hora_egreso_real ? fmtTime(hora_egreso_real.slice(11, 19)) : '—'}
        </Text>
      </View>

      {/* Trabajador sin firmar: botón destacado — no aplica a turnos
          eventuales de nómina (se pagan como bono, sin contrato) */}
      {!isGestor && asignacion.trabajador_tipo !== 'nomina' && asignacion.contrato_firmado === 0 && (
        <View className="bg-warning/10 border border-warning/30 rounded-xl px-3 py-3 gap-2 mt-2">
          <View className="flex-row items-center gap-2">
            <Ionicons name="alert-circle-outline" size={16} color="#F59E0B" />
            <Text className="text-xs font-semibold text-warning flex-1">
              Debes firmar el contrato para cobrar
            </Text>
          </View>
          <Button
            label="Ver Contratos Pendientes"
            variant="primary"
            size="sm"
            fullWidth
            onPress={onIrAMisContratos}
          />
        </View>
      )}

      {/* Turno eventual de nómina: no hay contrato que firmar — se paga
          como bono en la próxima liquidación trimestral. Sin este aviso,
          no se mostraba nada y el trabajador podía quedar esperando un
          contrato que nunca aparece. */}
      {asignacion.trabajador_tipo === 'nomina' && (
        <View className="bg-white/60 rounded-xl px-3 py-3 flex-row items-center gap-2 mt-2">
          <Ionicons name="gift-outline" size={16} color="#059669" />
          <Text className="text-xs font-medium text-success flex-1">
            {isGestor
              ? 'Turno extra — se paga en su próxima liquidación.'
              : 'Este turno se paga en tu próxima liquidación.'}
          </Text>
        </View>
      )}

      {/* Gestor: botones de descargar y corregir — "Contrato" no aplica a
          turnos eventuales de nómina (se pagan como bono) */}
      {isGestor && (
        <View className="flex-row items-center gap-3 mt-2">
          {asignacion.trabajador_tipo !== 'nomina' && (
            <TouchableOpacity
              onPress={onDescargarContrato}
              disabled={cargandoContrato}
              className="flex-row items-center gap-1.5 flex-1"
            >
              {cargandoContrato ? (
                <ActivityIndicator size="small" color="#059669" />
              ) : (
                <Ionicons name="download-outline" size={16} color="#059669" />
              )}
              <Text className="text-xs font-semibold text-success">Contrato</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={onCorregir}
            className="flex-row items-center gap-1.5 flex-1"
          >
            <Ionicons name="time-outline" size={16} color="#059669" />
            <Text className="text-xs font-semibold text-success">Corregir</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
