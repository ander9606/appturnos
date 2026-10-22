import React, { useState } from 'react';
import { View, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SvgXml } from 'react-native-svg';
import { Text } from '@/components/ui/Text';
import { Spinner } from '@/components/ui/Spinner';
import { COLORS } from '@/lib/designTokens';
import { showAlert } from '@/lib/alertDialog';
import { showToast } from '@/lib/toast';
import { useTheme } from '@/lib/theme';
import { SignaturePad } from '@/features/turnos/SignaturePad';
import { useActualizarEmpresa } from './useMiEmpresa';

/** Firma del representante legal: se guarda al instante y se estampa en todos los contratos. */
export function FirmaRepresentante({ firmaB64 }: { firmaB64: string | null }) {
  const theme = useTheme();
  const actualizar = useActualizarEmpresa();

  // Se guarda una sola vez y se estampa en todos los contratos (ver contratoPdf.js), no se firma contrato
  // por contrato. Vive fuera del form de RHF: se guarda al instante, igual que el logo, en vez de esperar
  // al botón "Guardar cambios" del resto de campos.
  const [showFirma, setShowFirma] = useState(false);
  const [uploadingFirma, setUploadingFirma] = useState(false);
  let firmaSvgXml: string | null = null;
  if (firmaB64 && !firmaB64.startsWith('data:')) {
    try { firmaSvgXml = atob(firmaB64); } catch { /* no es SVG — se intenta como imagen abajo */ }
  }

  const handleGuardarFirma = async (b64: string) => {
    setShowFirma(false);
    setUploadingFirma(true);
    try {
      await actualizar.mutateAsync({ firma_representante_b64: b64 });
      showToast('Firma del representante actualizada.');
    } catch {
      showAlert('Error', 'No se pudo guardar la firma. Intenta de nuevo.');
    } finally {
      setUploadingFirma(false);
    }
  };

  const handleQuitarFirma = async () => {
    setUploadingFirma(true);
    try {
      await actualizar.mutateAsync({ firma_representante_b64: '' });
      showToast('Firma eliminada.');
    } catch {
      showAlert('Error', 'No se pudo eliminar la firma.');
    } finally {
      setUploadingFirma(false);
    }
  };

  return (
    <>
      <View className="gap-2">
        <Text className="text-sm font-medium text-foreground">Firma del representante legal</Text>
        <Text className="text-xs text-muted-foreground -mt-1">
          Se imprime en todos los contratos de prestación de servicios.
        </Text>
        <Pressable
          onPress={() => setShowFirma(true)}
          disabled={uploadingFirma}
          className="h-24 rounded-2xl border border-dashed border-border items-center justify-center bg-card active:opacity-70 overflow-hidden"
        >
          {uploadingFirma ? (
            <Spinner color={theme.primary} />
          ) : firmaSvgXml ? (
            <SvgXml xml={firmaSvgXml} width="90%" height={70} />
          ) : firmaB64 ? (
            <Image source={{ uri: firmaB64 }} style={{ width: '90%', height: 70 }} resizeMode="contain" />
          ) : (
            <View className="items-center gap-1">
              <Ionicons name="create-outline" size={20} color={COLORS.placeholder} />
              <Text className="text-xs text-muted-foreground">Toca para firmar</Text>
            </View>
          )}
        </Pressable>
        {firmaB64 && (
          <Pressable onPress={handleQuitarFirma} disabled={uploadingFirma} hitSlop={8} className="self-start">
            <Text className="text-xs font-semibold text-danger">Quitar firma</Text>
          </Pressable>
        )}
      </View>
      <SignaturePad
        visible={showFirma}
        onClose={() => setShowFirma(false)}
        onConfirm={handleGuardarFirma}
        loading={uploadingFirma}
        confirmLabel="Guardar firma"
        title="Firma del representante legal"
        subtitle="Se estampará en todos los contratos de prestación de servicios"
      />
    </>
  );
}
