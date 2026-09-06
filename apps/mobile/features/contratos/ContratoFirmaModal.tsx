/**
 * ContratoFirmaModal — Modal para que trabajadores firmen contratos
 *
 * Componente que encapsula la firma digital de contratos después de completar turnos.
 * Reutiliza SignaturePad con mensajes específicos para contratos.
 */
import React from 'react';
import { Alert } from 'react-native';

import { SignaturePad } from '@/features/turnos/SignaturePad';
import { useFirmarContrato } from './useContratos';
import { ApiError } from '@api-client';
import { showToast } from '@/lib/toast';
import * as Haptics from 'expo-haptics';

interface ContratoFirmaModalProps {
  visible: boolean;
  contratoId: number | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ContratoFirmaModal({
  visible,
  contratoId,
  onClose,
  onSuccess,
}: ContratoFirmaModalProps) {
  const firmarMutation = useFirmarContrato();

  const handleFirmar = async (firmaBase64: string) => {
    if (!contratoId) return;
    try {
      await firmarMutation.mutateAsync({
        contratoId,
        firma_b64: firmaBase64,
      });
      onClose();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Contrato firmado — ¡ya puedes cobrar tu pago!');
      onSuccess?.();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'No se pudo firmar el contrato.';
      Alert.alert('Error', msg);
    }
  };

  return (
    <SignaturePad
      visible={visible}
      onClose={onClose}
      onConfirm={handleFirmar}
      loading={firmarMutation.isPending}
      title="Firmar Contrato"
      subtitle="Tu firma autoriza el pago del turno"
      confirmLabel="Firmar Contrato"
    />
  );
}
