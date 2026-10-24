import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { Spinner } from '@/components/ui/Spinner';
import { Avatar } from '@/components/ui/Avatar';
import { elegirFotoConMenu } from '@/lib/pickImage';
import { showAlert } from '@/lib/alertDialog';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { authApi } from '@api-client';
import type { ApiError } from '@api-client';
import { ROL_LABELS } from './PerfilUi';

/** Encabezado del perfil: foto (con cambio/quitar), nombre, correo y rol. */
export function PerfilCabecera() {
  const usuario    = useAuthStore((s) => s.usuario);
  const setUsuario = useAuthStore((s) => s.setUsuario);
  const theme      = useTheme();
  const [uploadingFoto, setUploadingFoto] = useState(false);

  // ── Foto de perfil ─────────────────────────────────────────────────

  const handleCambiarFoto = async () => {
    const foto = await elegirFotoConMenu({ title: 'Foto de perfil', quitarLabel: usuario?.foto_perfil ? 'Quitar foto' : undefined });
    if (foto !== undefined) _subirFoto(foto);
  };

  const _subirFoto = async (b64: string | null) => {
    setUploadingFoto(true);
    try {
      const perfil = await authApi.actualizarFoto(b64);
      setUsuario(perfil);
    } catch (err) {
      showAlert('Error', (err as ApiError).message ?? t('common.error'));
    } finally {
      setUploadingFoto(false);
    }
  };

  return (
    <View
      className="pt-4 pb-10 px-6 rounded-b-[32px] items-center gap-3"
      style={{ backgroundColor: theme.primary }}
    >
      <Text className="text-white text-lg font-bold self-start">{t('perfil.title')}</Text>

      {/* Avatar con botón de cambio */}
      <TouchableOpacity onPress={handleCambiarFoto} disabled={uploadingFoto} className="mt-2 relative">
        <Avatar
          id={usuario?.id}
          nombre={usuario?.nombre}
          apellido={usuario?.apellido}
          fotoB64={usuario?.foto_perfil}
          size={80}
        />
        <View className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-white items-center justify-center border-2 border-white" style={{ borderColor: theme.primary }}>
          {uploadingFoto
            ? <Spinner size="small" color={theme.primary} />
            : <Ionicons name="camera" size={14} color={theme.primary} />}
        </View>
      </TouchableOpacity>

      <View className="items-center gap-1">
        <Text className="text-white text-xl font-bold">
          {usuario?.nombre} {usuario?.apellido}
        </Text>
        <Text className="text-white/70 text-sm">{usuario?.email}</Text>
        <View className="bg-white/20 rounded-full px-3 py-1 mt-1">
          <Text className="text-white text-xs font-semibold">
            {ROL_LABELS[usuario?.rol ?? ''] ?? usuario?.rol}
          </Text>
        </View>
      </View>
    </View>
  );
}
