import React, { useState } from 'react';
import { Pressable } from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { Text } from '@/components/ui/Text';
import { Spinner } from '@/components/ui/Spinner';
import { COLORS } from '@/lib/designTokens';
import { showAlert } from '@/lib/alertDialog';
import { confirm } from '@/lib/confirmDialog';
import { t } from '@/lib/i18n';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { authApi } from '@api-client';
import type { ApiError } from '@api-client';
import { DeleteAccountForm } from './DeleteAccountForm';
import { SectionHeader } from './PerfilUi';

export function CerrarSesionButton() {
  const logout = useAuthStore((s) => s.logout);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    const ok = await confirm({
      title: t('perfil.cerrarSesion'),
      message: '¿Estás seguro de que deseas cerrar sesión?',
      cancelLabel: t('common.cancel'),
      confirmLabel: t('perfil.cerrarSesion'),
      destructive: true,
    });
    if (!ok) return;
    setLoggingOut(true);
    await logout();
  };

  return (
    <Pressable
      onPress={handleLogout}
      disabled={loggingOut}
      className="mx-5 mt-6 h-14 rounded-2xl bg-danger/10 border border-danger/30 items-center justify-center active:opacity-80 disabled:opacity-50"
    >
      {loggingOut ? (
        <Spinner size="small" color={COLORS.danger} />
      ) : (
        <Text className="text-base font-semibold text-danger">
          {t('perfil.cerrarSesion')}
        </Text>
      )}
    </Pressable>
  );
}

/** Zona de peligro: eliminar la cuenta (con confirmación y contraseña). */
export function ZonaPeligroSection() {
  const logout = useAuthStore((s) => s.logout);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const eliminarCuentaMutation = useMutation({
    mutationFn: (password: string) => authApi.eliminarCuenta(password),
    onSuccess: async () => {
      await logout();
    },
    onError: (err: ApiError) => {
      showAlert('No se pudo eliminar la cuenta', err.message ?? t('common.error'));
    },
  });

  const handleEliminarCuenta = async () => {
    const ok = await confirm({
      title: 'Eliminar cuenta',
      message: 'Vamos a anonimizar tu nombre, cédula, teléfono, correo y demás datos de contacto — dejarán de estar asociados a ti. Por obligación legal de nómina, conservamos (de forma anonimizada) tu historial de turnos trabajados, contratos y pagos hasta por 5 años. No podrás volver a iniciar sesión con esta cuenta. Esta acción no se puede deshacer.',
      cancelLabel: t('common.cancel'),
      confirmLabel: 'Continuar',
      destructive: true,
    });
    if (ok) setDeletingAccount(true);
  };

  return (
    <>
      <SectionHeader title="Zona de peligro" />
      {deletingAccount ? (
        <DeleteAccountForm
          onConfirm={(password) => eliminarCuentaMutation.mutate(password)}
          onCancel={() => setDeletingAccount(false)}
          loading={eliminarCuentaMutation.isPending}
        />
      ) : (
        <Pressable
          onPress={handleEliminarCuenta}
          className="mx-5 h-14 rounded-2xl bg-danger/10 border border-danger/30 items-center justify-center active:opacity-80"
        >
          <Text className="text-base font-semibold text-danger">Eliminar cuenta</Text>
        </Pressable>
      )}
    </>
  );
}
