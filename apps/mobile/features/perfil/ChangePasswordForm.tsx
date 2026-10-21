import { Text, TextInput } from '@/components/ui/Text';
import { Spinner } from '@/components/ui/Spinner';
import { COLORS } from '@/lib/designTokens';
import { t } from '@/lib/i18n';
import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { showAlert } from '@/lib/alertDialog';

export function ChangePasswordForm({
  onSave,
  onCancel,
  loading,
}: {
  onSave: (actual: string, nueva: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [actual, setActual]     = useState('');
  const [nueva, setNueva]       = useState('');
  const [confirmar, setConfirmar] = useState('');

  const handleSave = () => {
    if (nueva.length < 8) {
      showAlert('Error', t('perfil.errorPasswordShort'));
      return;
    }
    if (nueva !== confirmar) {
      showAlert('Error', t('perfil.errorPasswordMatch'));
      return;
    }
    onSave(actual, nueva);
  };

  return (
    <View className="bg-card rounded-2xl mx-5 border border-border overflow-hidden">
      <View className="px-5 py-4 border-b border-border">
        <Text className="text-sm font-semibold text-foreground">{t('perfil.cambiarPassword')}</Text>
      </View>

      {[
        { label: t('perfil.passwordActual'),  value: actual,    setter: setActual },
        { label: t('perfil.passwordNueva'),   value: nueva,     setter: setNueva },
        { label: t('perfil.passwordConfirm'), value: confirmar, setter: setConfirmar },
      ].map(({ label, value, setter }, i, arr) => (
        <View
          key={label}
          className={`px-5 py-3 ${i < arr.length - 1 ? 'border-b border-border' : ''}`}
        >
          <Text className="text-xs text-muted-foreground mb-1">{label}</Text>
          <TextInput
            value={value}
            onChangeText={setter}
            secureTextEntry
            className="text-sm text-foreground"
            placeholder={t('perfil.passwordMin')}
            placeholderTextColor={COLORS.placeholder}
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>
      ))}

      <View className="flex-row gap-3 px-5 py-4 border-t border-border">
        <Pressable
          onPress={onCancel}
          className="flex-1 h-11 rounded-xl border border-border items-center justify-center active:opacity-70"
        >
          <Text className="text-sm font-semibold text-muted-foreground">{t('perfil.cancelar')}</Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          disabled={loading}
          className="flex-1 h-11 rounded-xl bg-primary items-center justify-center active:opacity-80 disabled:opacity-50"
        >
          {loading ? (
            <Spinner size="small" color={COLORS.white} />
          ) : (
            <Text className="text-sm font-semibold text-white">{t('perfil.actualizandoPwd')}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
