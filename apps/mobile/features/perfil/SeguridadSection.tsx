import React, { useState, useEffect } from 'react';
import { View, Pressable, Switch } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { Text } from '@/components/ui/Text';
import { COLORS } from '@/lib/designTokens';
import { showAlert } from '@/lib/alertDialog';
import { showToast } from '@/lib/toast';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { webSafeSecureStore as SecureStore } from '@/lib/secureStore';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { authApi } from '@api-client';
import type { ApiError } from '@api-client';
import { ChangePasswordForm } from './ChangePasswordForm';
import { SectionHeader } from './PerfilUi';

/** Seguridad: cambiar contraseña y, si el teléfono lo permite, el bloqueo biométrico. */
export function SeguridadSection() {
  const logout = useAuthStore((s) => s.logout);
  const theme  = useTheme();
  const [editingPassword, setEditingPassword] = useState(false);
  const [bioSupported,    setBioSupported]    = useState(false);
  const [bioEnabled,      setBioEnabled]      = useState(false);

  useEffect(() => {
    Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      SecureStore.getItemAsync('appturnos.biometric_enabled'),
    ]).then(([hw, enrolled, pref]) => {
      setBioSupported(hw && enrolled);
      setBioEnabled(pref === '1');
    });
  }, []);

  const handleToggleBio = async (val: boolean) => {
    await SecureStore.setItemAsync('appturnos.biometric_enabled', val ? '1' : '0');
    setBioEnabled(val);
  };

  const changePasswordMutation = useMutation({
    mutationFn: (params: { actual: string; nueva: string }) =>
      authApi.changePassword({ password_actual: params.actual, password_nueva: params.nueva }),
    onSuccess: async () => {
      setEditingPassword(false);
      showToast(t('perfil.successPassword'));
      await logout();
    },
    onError: (err: ApiError) => {
      showAlert('Error', err.message ?? t('common.error'));
    },
  });

  return (
    <>
      <SectionHeader title={t('perfil.seguridad')} />

      {editingPassword ? (
        <ChangePasswordForm
          onSave={(actual, nueva) =>
            changePasswordMutation.mutate({ actual, nueva })
          }
          onCancel={() => setEditingPassword(false)}
          loading={changePasswordMutation.isPending}
        />
      ) : (
        <View className="mx-5 bg-card rounded-2xl border border-border overflow-hidden">
          <Pressable
            onPress={() => setEditingPassword(true)}
            className="px-5 py-4 flex-row items-center justify-between active:opacity-70"
          >
            <View className="flex-row items-center gap-3">
              <Ionicons name="key-outline" size={16} color={COLORS.mutedForeground} />
              <Text className="text-sm font-medium text-foreground">
                {t('perfil.cambiarPassword')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.placeholder} />
          </Pressable>

          {bioSupported && (
            <View className="border-t border-border px-5 py-4 flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <Ionicons name="finger-print" size={16} color={COLORS.mutedForeground} />
                <Text className="text-sm font-medium text-foreground">Bloqueo biométrico</Text>
              </View>
              <Switch
                value={bioEnabled}
                onValueChange={handleToggleBio}
                trackColor={{ false: COLORS.border, true: theme.primary }}
                thumbColor={COLORS.white}
              />
            </View>
          )}
        </View>
      )}
    </>
  );
}
