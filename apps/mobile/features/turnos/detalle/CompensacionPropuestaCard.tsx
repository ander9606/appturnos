import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { formatCOP } from '@/lib/formatters';
import { COLORS } from '@/lib/designTokens';

/**
 * Propuesta de compensación sobre un turno que el trabajador YA trabajó y que le bajaría el pago (el gestor lo dio
 * por fallido por fuerza mayor). El cambio no se aplica solo: el trabajador lo autoriza o no. Mientras esté pendiente
 * (o si lo rechaza) se le paga según su contrato. Ver AsignacionesService.autorizarCompensacion.
 */
export function CompensacionPropuestaCard({
  decision, pagoActual, propuesta, bono, motivo, esGestor, pendiente, onDecidir,
}: {
  decision: 'pendiente' | 'rechazada';
  /** Lo que tiene hoy el turno (según su contrato). */
  pagoActual: number;
  /** Compensación propuesta, sin el bono. */
  propuesta: number;
  bono: number;
  motivo?: string | null;
  esGestor: boolean;
  /** Hay una petición en curso. */
  pendiente: boolean;
  onDecidir: (autoriza: boolean) => void | Promise<void>;
}) {
  const nuevoPago = propuesta + bono;
  const motivoTxt = (motivo || 'fuerza mayor').toLowerCase();

  return (
    <View
      className="bg-card rounded-2xl px-5 py-4 gap-2"
      style={{ elevation: 1, shadowColor: COLORS.shadow, shadowOpacity: 0.04, shadowRadius: 8 }}
    >
      <Text className="text-sm font-semibold text-foreground">
        {decision === 'rechazada'
          ? (esGestor ? 'El trabajador no autorizó el cambio de pago' : 'No autorizaste el cambio de pago')
          : (esGestor ? 'Esperando la autorización del trabajador' : 'Necesitamos tu autorización')}
      </Text>

      {decision === 'pendiente' && (
        <Text className="text-sm text-foreground">
          {esGestor
            ? `El turno se canceló por ${motivoTxt}. Se propone cambiar su pago de ${formatCOP(pagoActual)} a ${formatCOP(nuevoPago)}. El cambio solo se aplica si el trabajador lo autoriza. Mientras no responda, este turno queda en espera: no suma ni resta en la liquidación.`
            : `El turno se canceló por ${motivoTxt}. Se propone cambiar tu pago de ${formatCOP(pagoActual)} a ${formatCOP(nuevoPago)} (compensación). Mientras no respondas, este turno queda en espera: no se suma a tu pago hasta que decidas. Si no lo autorizas, se te paga según tu contrato.`}
        </Text>
      )}
      {decision === 'rechazada' && (
        <Text className="text-sm text-foreground">
          {esGestor
            ? `Se le paga según su contrato (${formatCOP(pagoActual)}).`
            : `Se te paga según tu contrato (${formatCOP(pagoActual)}).`}
        </Text>
      )}

      {decision === 'pendiente' && !esGestor && (
        <View className="flex-row gap-3 mt-1">
          <View className="flex-1">
            <Button label="No autorizo" variant="secondary" fullWidth disabled={pendiente} onPress={() => onDecidir(false)} />
          </View>
          <View className="flex-1">
            <Button label="Autorizo" fullWidth loading={pendiente} onPress={() => onDecidir(true)} />
          </View>
        </View>
      )}
      {/* Autorización de un toque: el consentimiento va escrito junto al botón, con el antes y el después. */}
      {decision === 'pendiente' && !esGestor && (
        <Text className="text-xs text-muted-foreground">
          Al tocar «Autorizo» aceptas que tu pago por este turno pase de {formatCOP(pagoActual)} a {formatCOP(nuevoPago)}.
        </Text>
      )}
    </View>
  );
}
