import React from 'react';
import { View, Text, Image } from 'react-native';
import { getInitials } from '@/lib/formatters';
import { avatarColorForId } from '@/lib/designTokens';

interface Props {
  id?: number;
  nombre?: string | null;
  apellido?: string | null;
  fotoB64?: string | null;
  size?: number;
  textClassName?: string;
}

export function Avatar({ id = 0, nombre, apellido, fotoB64, size = 48, textClassName }: Props) {
  const radius = size / 2;
  const fontSize = size * 0.33;

  if (fotoB64) {
    return (
      <Image
        source={{ uri: `data:image/jpeg;base64,${fotoB64}` }}
        style={{ width: size, height: size, borderRadius: radius }}
        resizeMode="cover"
      />
    );
  }

  return (
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
}
