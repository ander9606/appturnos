import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { showAlert } from '@/lib/alertDialog';
import { showToast } from '@/lib/toast';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { authApi } from '@api-client';
import type { ApiError } from '@api-client';
import { EditProfileForm } from './EditProfileForm';
import { CardRow, SectionHeader } from './PerfilUi';

/** Información personal: nombre, apellido y correo, con edición en el sitio. */
export function InfoPersonalSection() {
  const usuario    = useAuthStore((s) => s.usuario);
  const setUsuario = useAuthStore((s) => s.setUsuario);
  const theme      = useTheme();
  const [editingDatos, setEditingDatos] = useState(false);

  const updateProfileMutation = useMutation({
    mutationFn: (params: { nombre: string; apellido: string; email: string }) =>
      authApi.updateProfile(params),
    onSuccess: (data) => {
      setUsuario(data);
      setEditingDatos(false);
      showToast(t('perfil.successDatos'));
    },
    onError: (err: ApiError) => {
      showAlert('Error', err.message ?? t('common.error'));
    },
  });

  return (
    <>
      <SectionHeader title={t('perfil.infoPersonal')} />

      {editingDatos ? (
        <EditProfileForm
          initialNombre={usuario?.nombre ?? ''}
          initialApellido={usuario?.apellido ?? ''}
          initialEmail={usuario?.email ?? ''}
          onSave={(nombre, apellido, email) =>
            updateProfileMutation.mutate({ nombre, apellido, email })
          }
          onCancel={() => setEditingDatos(false)}
          loading={updateProfileMutation.isPending}
        />
      ) : (
        <View className="mx-5 bg-card rounded-2xl border border-border overflow-hidden">
          <CardRow label={t('perfil.nombre')}   value={usuario?.nombre ?? '—'} />
          <CardRow label={t('perfil.apellido')} value={usuario?.apellido ?? '—'} />
          <CardRow label={t('perfil.email')}    value={usuario?.email ?? '—'} last />
          <Pressable
            onPress={() => setEditingDatos(true)}
            className="border-t border-border px-5 py-3 flex-row items-center justify-center gap-2 active:opacity-70"
          >
            <Ionicons name="pencil-outline" size={14} color={theme.primary} />
            <Text className="text-sm font-semibold text-primary">{t('perfil.editarDatos')}</Text>
          </Pressable>
        </View>
      )}
    </>
  );
}
