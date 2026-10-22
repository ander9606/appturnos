import React, { useState } from 'react';
import { View, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Spinner } from '@/components/ui/Spinner';
import { COLORS } from '@/lib/designTokens';
import { elegirFotoConMenu } from '@/lib/pickImage';
import { showAlert } from '@/lib/alertDialog';
import { showToast } from '@/lib/toast';
import { useActualizarEmpresa } from './useMiEmpresa';

/** Logo de la empresa — toca para cambiarlo (cámara/galería), igual que la foto de perfil. Se guarda al instante. */
export function LogoEmpresa({ logoUrl, error }: { logoUrl: string | undefined; error?: string }) {
  const actualizar = useActualizarEmpresa();
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleCambiarLogo = async () => {
    const logo = await elegirFotoConMenu({ title: 'Logo de la empresa', quitarLabel: logoUrl ? 'Quitar logo' : undefined });
    if (logo !== undefined) _subirLogo(logo);
  };

  const _subirLogo = async (b64: string | null) => {
    setUploadingLogo(true);
    try {
      await actualizar.mutateAsync({ logo_url: b64 ? `data:image/jpeg;base64,${b64}` : '' });
      showToast(b64 ? 'Logo actualizado.' : 'Logo eliminado.');
    } catch {
      showAlert('Error', 'No se pudo actualizar el logo. Intenta de nuevo.');
    } finally {
      setUploadingLogo(false);
    }
  };

  return (
    <View className="items-center gap-3">
      <Pressable onPress={handleCambiarLogo} disabled={uploadingLogo} className="relative active:opacity-70">
        <View className="w-24 h-24 rounded-2xl bg-muted items-center justify-center overflow-hidden">
          {logoUrl ? (
            <Image
              source={{ uri: logoUrl }}
              className="w-24 h-24"
              resizeMode="contain"
              onError={() => {}}
            />
          ) : (
            <Ionicons name="business-outline" size={40} color={COLORS.placeholder} />
          )}
        </View>
        <View className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary items-center justify-center border-2 border-background">
          {uploadingLogo ? (
            <Spinner size="small" color={COLORS.white} />
          ) : (
            <Ionicons name="camera" size={14} color={COLORS.white} />
          )}
        </View>
      </Pressable>
      <Text className="text-xs text-muted-foreground text-center">
        Toca el logo para cambiarlo
      </Text>
      {error && (
        <Text className="text-xs text-danger text-center">{error}</Text>
      )}
    </View>
  );
}
