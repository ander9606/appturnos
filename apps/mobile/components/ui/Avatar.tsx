import React, { useState } from 'react';
import { View, Text, Image, Pressable, Modal } from 'react-native';
import { getInitials } from '@/lib/formatters';
import { avatarColorForId } from '@/lib/designTokens';

interface Props {
  id?: number;
  nombre?: string | null;
  apellido?: string | null;
  fotoB64?: string | null;
  size?: number;
  textClassName?: string;
  expandable?: boolean;
}

export function Avatar({ id = 0, nombre, apellido, fotoB64, size = 48, textClassName, expandable }: Props) {
  const [showFoto, setShowFoto] = useState(false);
  const radius = size / 2;
  const fontSize = size * 0.33;

  const avatar = fotoB64 ? (
    <Image
      source={{ uri: `data:image/jpeg;base64,${fotoB64}` }}
      style={{ width: size, height: size, borderRadius: radius }}
      resizeMode="cover"
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: avatarColorForId(id),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '700', fontSize }} className={textClassName}>
        {getInitials(nombre ?? '', apellido ?? '')}
      </Text>
    </View>
  );

  if (!expandable || !fotoB64) return avatar;

  return (
    <>
      <Pressable onPress={() => setShowFoto(true)} accessibilityRole="button" accessibilityLabel="Ver foto de perfil">
        {avatar}
      </Pressable>
      <Modal visible={showFoto} transparent animationType="fade" onRequestClose={() => setShowFoto(false)}>
        <Pressable className="flex-1 bg-black/90 items-center justify-center" onPress={() => setShowFoto(false)}>
          <Image
            source={{ uri: `data:image/jpeg;base64,${fotoB64}` }}
            style={{ width: 280, height: 280, borderRadius: 140 }}
            resizeMode="cover"
          />
        </Pressable>
      </Modal>
    </>
  );
}
