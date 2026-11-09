import { showAlert } from '@/lib/alertDialog';
import { Text, TextInput } from '@/components/ui/Text';
import { COLORS } from '@/lib/designTokens';
import React, { useState } from 'react';
import { View, ScrollView, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMarcarOfertaFallida } from '@/features/turnos/useTurnos';
import { parseTarifa } from '@/features/turnos/crear/utils';
import { Button } from '@/components/ui/Button';
import { confirm } from '@/lib/confirmDialog';
import { formatCOP } from '@/lib/formatters';
import type { OfertaDetalle } from '@api-client';
import { ApiError, COMPENSACION_FALLIDO_MINIMA } from '@api-client';

// ── Turno fallido (gestores) — fuerza mayor: quien ya marcó ingreso recibe
// una compensación en vez de perder el turno sin nada. ─────────────────────

export function TurnoFallidoModal({
  visible,
  oferta,
  marcarFallidaM,
  onClose,
  onDone,
}: {
  visible: boolean;
  oferta: OfertaDetalle;
  marcarFallidaM: ReturnType<typeof useMarcarOfertaFallida>;
  onClose: () => void;
  onDone: () => void;
}) {
  const enProgreso = oferta.asignaciones.filter((a) => a.estado === 'en_progreso' || a.estado === 'completado');
  const otros = oferta.asignaciones.filter((a) =>
    a.estado !== 'en_progreso' && a.estado !== 'completado' && a.estado !== 'cancelado'
  );

  const [motivo, setMotivo] = useState('Fuerza mayor');
  const [montos, setMontos] = useState<Record<number, string>>({});

  React.useEffect(() => {
    if (!visible) return;
    setMotivo('Fuerza mayor');
    setMontos(Object.fromEntries(enProgreso.map((a) => {
      const tarifa = oferta.puestos.find((p) => p.id === a.puesto_id)?.tarifa_dia ?? 0;
      return [a.id, String(tarifa)];
    })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, oferta.id]);

  if (!visible) return null;

  // Piso: la mitad de la tarifa del puesto (el backend lo exige igual).
  const minimoDe = (a: (typeof enProgreso)[number]) =>
    Number(oferta.puestos.find((p) => p.id === a.puesto_id)?.tarifa_dia ?? 0) * COMPENSACION_FALLIDO_MINIMA;
  const nombreDe = (a: (typeof enProgreso)[number]) => `${a.trabajador_nombre} ${a.trabajador_apellido}`;

  async function handleConfirmar() {
    if (!motivo.trim()) {
      showAlert('Falta el motivo', 'Escribe por qué este turno es fuerza mayor.', 'warning');
      return;
    }
    const compensaciones = enProgreso.map((a) => ({
      asignacion_id: a.id,
      monto: parseTarifa(montos[a.id] ?? '0'),
    }));

    const bajos = enProgreso.filter((a, i) => compensaciones[i].monto < minimoDe(a));
    if (bajos.length > 0) {
      showAlert(
        'Compensación muy baja',
        `El mínimo es la mitad de la tarifa del turno:\n${bajos.map((a) => `• ${nombreDe(a)}: mínimo ${formatCOP(minimoDe(a))}`).join('\n')}`,
        'warning',
      );
      return;
    }

    // Paso de confirmación: acción definitiva, así que se muestra qué cambia para cada persona.
    const lineas = enProgreso.map((a, i) => {
      const nuevo = formatCOP(compensaciones[i].monto);
      return a.estado === 'completado' && a.pago_total != null
        ? `• ${nombreDe(a)}: de ${formatCOP(Number(a.pago_total))} a ${nuevo}`
        : `• ${nombreDe(a)}: ${nuevo}`;
    });
    const ok = await confirm({
      title: 'Confirmar turno fallido',
      message: `Se cancelará "${oferta.titulo}" y esto no se puede deshacer.\n\nCompensación:\n${lineas.join('\n')}\n\nQuien ya había terminado su turno pasa de su pago a esa compensación. Confirma que la tarea NO se realizó: si se realizó, debe pagarse según el contrato.`,
      cancelLabel: 'Volver',
      confirmLabel: 'Sí, dar por fallido',
      destructive: true,
    });
    if (!ok) return;

    try {
      await marcarFallidaM.mutateAsync({ ofertaId: oferta.id, motivo: motivo.trim(), compensaciones });
      onDone();
    } catch (err) {
      showAlert('Error', err instanceof ApiError ? err.message : 'No se pudo marcar el turno como fallido.');
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          className="bg-background rounded-t-3xl"
          contentContainerClassName="px-6 pt-5 pb-10 gap-5"
          style={{ maxHeight: '85%' }}
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold text-foreground">Turno fallido</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={COLORS.mutedForeground} />
            </Pressable>
          </View>

          <Text className="text-sm text-muted-foreground">
            El turno se cancelará por fuerza mayor. Quienes ya marcaron ingreso recibirán la compensación
            que definas abajo; el resto queda cancelado sin pago, como siempre.
          </Text>
          <View className="bg-warning-light rounded-xl px-4 py-3">
            <Text className="text-sm font-medium text-warning">
              Úsalo solo si la tarea no se realizó. Si la labor sí se realizó, se paga según el contrato: no la des por fallida.
            </Text>
          </View>

          <View className="gap-1.5">
            <Text className="text-sm font-semibold text-foreground">Motivo</Text>
            <TextInput
              value={motivo}
              onChangeText={setMotivo}
              placeholder="Ej. fuerza mayor"
              placeholderTextColor={COLORS.placeholder}
              maxLength={255}
              className="bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground"
            />
          </View>

          <View className="gap-3">
            <Text className="text-sm font-semibold text-foreground">
              Compensación ({enProgreso.length} ya en turno)
            </Text>
            {enProgreso.map((a) => (
              <View key={a.id} className="gap-1.5">
                <Text className="text-xs text-muted-foreground">
                  {a.trabajador_nombre} {a.trabajador_apellido} · {a.cargo_nombre}
                </Text>
                <View className="flex-row items-center bg-card border border-border rounded-xl px-3 gap-1">
                  <Text className="text-sm font-bold text-muted-foreground">$</Text>
                  <TextInput
                    className="flex-1 py-3 text-sm font-semibold text-foreground"
                    value={montos[a.id] ?? ''}
                    onChangeText={(t) => setMontos((m) => ({ ...m, [a.id]: t.replace(/[^\d.,]/g, '') }))}
                    keyboardType="numeric"
                  />
                </View>
                <Text className="text-[11px] text-muted-foreground">
                  Mínimo {formatCOP(minimoDe(a))} (la mitad de la tarifa del turno)
                </Text>
              </View>
            ))}
          </View>

          {otros.length > 0 && (
            <Text className="text-xs text-muted-foreground">
              {otros.length} trabajador{otros.length > 1 ? 'es' : ''} más que aún no había
              {otros.length > 1 ? 'n' : ''} empezado quedará{otros.length > 1 ? 'n' : ''} cancelado
              {otros.length > 1 ? 's' : ''} sin compensación.
            </Text>
          )}

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Button label="Volver" variant="secondary" fullWidth disabled={marcarFallidaM.isPending} onPress={onClose} />
            </View>
            <View className="flex-1">
              <Button
                label={marcarFallidaM.isPending ? 'Confirmando…' : 'Confirmar turno fallido'}
                variant="danger"
                fullWidth
                loading={marcarFallidaM.isPending}
                onPress={handleConfirmar}
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
