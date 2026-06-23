/**
 * Pantalla de bienvenida — primera pantalla al abrir la app.
 * Dos caminos: trabajador (activar/login) o empresa (contacto).
 */
import React from 'react';
import {
  View,
  Text,
  Pressable,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

const { height } = Dimensions.get('window');

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar style="light" />

      {/* Hero */}
      <View
        className="items-center justify-end pt-16 pb-12 rounded-b-[48px]"
        style={{ backgroundColor: '#FF5A3C', minHeight: height * 0.44 }}
      >
        <View className="w-20 h-20 rounded-3xl bg-white/20 items-center justify-center mb-5">
          <Ionicons name="calendar-outline" size={42} color="white" />
        </View>
        <Text className="text-3xl font-bold text-white tracking-tight">AppTurnos</Text>
        <Text className="text-base text-white/70 mt-1.5 text-center px-8">
          Gestión de turnos y nómina
        </Text>

        {/* Dots decorativos */}
        <View className="flex-row gap-1.5 mt-6">
          {[0, 1, 2].map(i => (
            <View
              key={i}
              className="rounded-full bg-white"
              style={{ width: i === 1 ? 20 : 6, height: 6, opacity: i === 1 ? 1 : 0.4 }}
            />
          ))}
        </View>
      </View>

      {/* Content */}
      <View className="flex-1 px-6 pt-8 pb-6 justify-between">
        <View className="gap-3">
          <Text className="text-xl font-bold text-foreground text-center mb-1">
            ¿Cómo quieres continuar?
          </Text>

          <OptionCard
            icon="person-outline"
            title="Soy trabajador"
            description="Activa tu cuenta o inicia sesión para ver tus turnos y nómina"
            onPress={() => router.push('/(auth)/activar')}
          />

          <OptionCard
            icon="briefcase-outline"
            title="Tengo una empresa"
            description="Inicia sesión como administrador para gestionar tu equipo"
            onPress={() => router.push('/(auth)/login')}
            variant="outline"
          />
        </View>

        {/* Footer */}
        <View className="items-center mt-4">
          <Text className="text-xs text-muted-foreground text-center">
            ¿Ya tienes cuenta?{' '}
          </Text>
          <Pressable onPress={() => router.push('/(auth)/login')} className="mt-0.5">
            <Text className="text-sm font-semibold" style={{ color: '#FF5A3C' }}>
              Iniciar sesión →
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

function OptionCard({
  icon,
  title,
  description,
  onPress,
  variant = 'filled',
}: {
  icon: IoniconsName;
  title: string;
  description: string;
  onPress: () => void;
  variant?: 'filled' | 'outline';
}) {
  const filled = variant === 'filled';
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-4 rounded-2xl p-4 active:opacity-80 border"
      style={{
        backgroundColor: filled ? '#FF5A3C' : '#FFFFFF',
        borderColor: filled ? '#FF5A3C' : '#E2E8F0',
      }}
    >
      <View
        className="w-12 h-12 rounded-xl items-center justify-center flex-shrink-0"
        style={{ backgroundColor: filled ? 'rgba(255,255,255,0.2)' : '#FFF1EE' }}
      >
        <Ionicons name={icon} size={24} color={filled ? 'white' : '#FF5A3C'} />
      </View>
      <View className="flex-1">
        <Text
          className="text-base font-bold"
          style={{ color: filled ? 'white' : '#0F172A' }}
        >
          {title}
        </Text>
        <Text
          className="text-sm mt-0.5 leading-5"
          style={{ color: filled ? 'rgba(255,255,255,0.75)' : '#64748B' }}
        >
          {description}
        </Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={filled ? 'rgba(255,255,255,0.6)' : '#94A3B8'}
      />
    </Pressable>
  );
}
