import { Text, TextInput } from '@/components/ui/Text';
import { Spinner } from '@/components/ui/Spinner';
import { COLORS } from '@/lib/designTokens';
import { t } from '@/lib/i18n';
import { useState } from 'react';
import { View, Pressable } from 'react-native';

export function DeleteAccountForm({
  onConfirm,
  onCancel,
  loading,
}: {
  onConfirm: (password: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [password, setPassword] = useState('');

  return (
    <View className="bg-card rounded-2xl mx-5 border border-danger/30 overflow-hidden">
      <View className="px-5 py-4 border-b border-border">
        <Text className="text-sm font-semibold text-danger">Confirmar eliminación de cuenta</Text>
        <Text className="text-xs text-muted-foreground mt-1">
          Ingresa tu contraseña actual para confirmar. Esta acción no se puede deshacer.
        </Text>
      </View>

      <View className="px-5 py-3">
        <Text className="text-xs text-muted-foreground mb-1">Contraseña</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          className="text-sm text-foreground"
          placeholder="Tu contraseña actual"
          placeholderTextColor={COLORS.placeholder}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      <View className="flex-row gap-3 px-5 py-4 border-t border-border">
        <Pressable
          onPress={onCancel}
          className="flex-1 h-11 rounded-xl border border-border items-center justify-center active:opacity-70"
        >
          <Text className="text-sm font-semibold text-muted-foreground">{t('perfil.cancelar')}</Text>
        </Pressable>
        <Pressable
          onPress={() => onConfirm(password)}
          disabled={loading || !password}
          className="flex-1 h-11 rounded-xl bg-danger items-center justify-center active:opacity-80 disabled:opacity-50"
        >
          {loading ? (
            <Spinner size="small" color={COLORS.white} />
          ) : (
            <Text className="text-sm font-semibold text-white">Eliminar cuenta</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
