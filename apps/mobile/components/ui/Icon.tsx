import React from 'react';
import { Ionicons } from '@expo/vector-icons';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: object;
}

export function Icon({ name, size = 20, color = '#64748B', style }: IconProps) {
  return <Ionicons name={name} size={size} color={color} style={style} />;
}
