import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

/** Solo para trabajador_turnos sin ninguna empresa aún — reemplaza a NoShiftCard,
 *  que manda a "Ver turnos disponibles" y esos siempre van a estar vacíos sin
 *  empresa. Color sólido a propósito: es el único bloqueador real para empezar
 *  a trabajar, debe resaltar sobre el resto de tarjetas neutras del home. */
export function BuscarEmpresasCard() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push('/directorio-empresas')}
      className="mx-4 mt-4 bg-primary-500 rounded-2xl p-5 items-center gap-2 active:opacity-90"
    >
      <View className="w-14 h-14 rounded-full bg-white/20 items-center justify-center">
        <Ionicons name="search" size={26} color="#fff" />
      </View>
      <Text className="text-base font-bold text-white">Aún no tienes empresa</Text>
      <Text className="text-sm text-white/90 text-center">
        Busca empresas en el directorio y solicita unirte para empezar a ver turnos disponibles.
      </Text>
      <View className="flex-row items-center gap-1.5 mt-2 bg-white rounded-xl px-4 py-2.5">
        <Text className="text-sm font-bold text-primary-600">Buscar empresas</Text>
        <Ionicons name="arrow-forward" size={14} color="#E83E1F" />
      </View>
    </Pressable>
  );
}
