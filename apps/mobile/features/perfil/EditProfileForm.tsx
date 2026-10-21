import { Text, TextInput } from '@/components/ui/Text';
import { Spinner } from '@/components/ui/Spinner';
import { COLORS } from '@/lib/designTokens';
import { t } from '@/lib/i18n';
import { useState } from 'react';
import { View, Pressable } from 'react-native';

export function EditProfileForm({
  initialNombre,
  initialApellido,
  initialEmail,
  onSave,
  onCancel,
  loading,
}: {
  initialNombre: string;
  initialApellido: string;
  initialEmail: string;
  onSave: (nombre: string, apellido: string, email: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [nombre, setNombre]     = useState(initialNombre);
  const [apellido, setApellido] = useState(initialApellido);
  const [email, setEmail]       = useState(initialEmail);

  return (
    <View className="bg-card rounded-2xl mx-5 border border-border overflow-hidden">
      <View className="px-5 py-4 border-b border-border">
        <Text className="text-sm font-semibold text-foreground">{t('perfil.infoPersonal')}</Text>
      </View>

      {[
        { label: t('perfil.nombre'),   value: nombre,   setter: setNombre,   key: 'nombre' },
        { label: t('perfil.apellido'), value: apellido, setter: setApellido, key: 'apellido' },
        { label: t('perfil.email'),    value: email,    setter: setEmail,    key: 'email' },
      ].map(({ label, value, setter, key }, i, arr) => (
        <View
          key={key}
          className={`px-5 py-3 ${i < arr.length - 1 ? 'border-b border-border' : ''}`}
        >
          <Text className="text-xs text-muted-foreground mb-1">{label}</Text>
          <TextInput
            value={value}
            onChangeText={setter}
            className="text-sm text-foreground"
            autoCapitalize={key === 'email' ? 'none' : 'words'}
            keyboardType={key === 'email' ? 'email-address' : 'default'}
            autoCorrect={false}
            placeholder={label}
            placeholderTextColor={COLORS.placeholder}
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
          onPress={() => onSave(nombre.trim(), apellido.trim(), email.trim())}
          disabled={loading}
          className="flex-1 h-11 rounded-xl bg-primary items-center justify-center active:opacity-80 disabled:opacity-50"
        >
          {loading ? (
            <Spinner size="small" color={COLORS.white} />
          ) : (
            <Text className="text-sm font-semibold text-white">{t('perfil.guardarCambios')}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
