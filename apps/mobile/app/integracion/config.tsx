/**
 * Pantalla de configuración de la integración logiq360.
 * Solo visible para admin_empresa.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Switch,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useIntegracionConfig, useActualizarIntegracion, useEmparejar } from '@/features/integracion/useIntegracion';
import { useTheme } from '@/lib/theme';
import { useRoleGuard } from '@/components/RoleGuard';

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 pt-6 pb-2">
      {title}
    </Text>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <View className="bg-card border-b border-border px-4 py-4">
      {children}
    </View>
  );
}

function Label({ text }: { text: string }) {
  return <Text className="text-xs text-muted-foreground mb-1">{text}</Text>;
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function IntegracionConfigScreen() {
  const router  = useRouter();
  const theme   = useTheme();

  const { data: cfg, isLoading, refetch, isRefetching } = useIntegracionConfig();
  const { mutateAsync: guardar, isPending } = useActualizarIntegracion();
  const { mutateAsync: emparejar, isPending: emparejando } = useEmparejar();

  const [codigoPair, setCodigoPair] = useState('');
  const [activo, setActivo] = useState(false);

  useEffect(() => {
    if (cfg) setActivo(Boolean(cfg.activo));
  }, [cfg]);

  const denied = useRoleGuard(['admin_empresa']);
  if (denied) return denied;

  async function handleEmparejar() {
    const codigo = codigoPair.trim();
    if (!codigo) return;
    try {
      const r = await emparejar(codigo);
      setCodigoPair('');
      Alert.alert('Conectado', `Integración vinculada con logiq360 (tenant ${r.logiq360_tenant_id}).`);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo emparejar.');
    }
  }

  async function handleToggleActivo(value: boolean) {
    setActivo(value);
    try {
      await guardar({ activo: value });
    } catch (err) {
      setActivo(!value);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo actualizar.');
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={theme.primary} />
        }
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <View className="px-4 pt-4 pb-6 gap-1" style={{ backgroundColor: '#6366F1' }}>
          <Text className="text-white text-lg font-bold">Integración logiq360</Text>
          <Text className="text-white/70 text-sm">
            Conecta tu empresa con el sistema de alquiler de equipos
          </Text>
        </View>

        {/* ── Conexión rápida (emparejamiento) ───────────────────── */}
        <SectionHeader title="Conexión rápida" />
        <Row>
          <Label text="Código de emparejamiento de logiq360" />
          <Text className="text-xs text-muted-foreground mb-2">
            En logiq360 → Integración → «Generar código de emparejamiento» y pégalo aquí.
            Las claves se intercambian automáticamente.
          </Text>
          <TextInput
            value={codigoPair}
            onChangeText={setCodigoPair}
            placeholder="Pega el código aquí"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            className="text-xs font-mono bg-background border border-border rounded-xl px-3 py-2.5 text-foreground"
          />
          <Pressable
            onPress={handleEmparejar}
            disabled={emparejando || !codigoPair.trim()}
            className="mt-3 h-11 rounded-2xl items-center justify-center"
            style={{ backgroundColor: emparejando || !codigoPair.trim() ? theme.primary + '80' : theme.primary }}
          >
            {emparejando ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-sm">Conectar con logiq360</Text>
            )}
          </Pressable>
        </Row>

        {/* ── Toggle activo ──────────────────────────────────────── */}
        <Row>
          <View className="flex-row items-center justify-between">
            <View className="flex-1 gap-0.5">
              <Text className="text-sm font-semibold text-foreground">Activar integración</Text>
              <Text className="text-xs text-muted-foreground">
                {activo ? 'AppTurnos recibe y envía eventos a logiq360' : 'La integración está desactivada'}
              </Text>
            </View>
            <Switch
              value={activo}
              onValueChange={handleToggleActivo}
              disabled={isPending}
              trackColor={{ true: theme.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </Row>

        {/* ── Enlace a conciliación de personal ──────────────────── */}
        <Pressable
          onPress={() => router.push('/integracion/conciliacion')}
          className="mx-4 mt-4 flex-row items-center justify-between bg-card border border-border rounded-2xl px-4 py-3 active:opacity-70"
        >
          <View className="flex-row items-center gap-3">
            <View
              className="w-8 h-8 rounded-xl items-center justify-center"
              style={{ backgroundColor: '#6366F11A' }}
            >
              <Ionicons name="people-outline" size={18} color="#6366F1" />
            </View>
            <Text className="text-sm font-semibold text-foreground">Conciliación de personal</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
        </Pressable>

        {/* ── Enlace a estado ────────────────────────────────────── */}
        <Pressable
          onPress={() => router.push('/integracion/estado')}
          className="mx-4 mt-4 flex-row items-center justify-between bg-card border border-border rounded-2xl px-4 py-3 active:opacity-70"
        >
          <View className="flex-row items-center gap-3">
            <View
              className="w-8 h-8 rounded-xl items-center justify-center"
              style={{ backgroundColor: '#6366F11A' }}
            >
              <Ionicons name="pulse-outline" size={18} color="#6366F1" />
            </View>
            <Text className="text-sm font-semibold text-foreground">Estado de la cola de eventos</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}
