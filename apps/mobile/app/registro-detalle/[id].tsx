/**
 * Detalle de Registro de Nómina — app/registro-detalle/[id].tsx
 *
 * Pantalla para que gestores vean y corrijan los tiempos de entrada/salida
 * de los registros de nómina de los trabajadores.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/lib/theme';
import { useRegistroDetalle, useCorregirRegistro } from '@/features/nomina/useRegistroDetalle';
import { Button } from '@/components/ui/Button';
import { showToast } from '@/lib/toast';
import { useRoleGuard } from '@/components/RoleGuard';

function fmtHora(time: string | null): string {
  if (!time) return '—';
  return time.substring(0, 5);
}

function fmtFecha(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-CO', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function RegistroDetalleScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const registroId = idParam ? parseInt(idParam, 10) : null;
  const router = useRouter();
  const theme = useTheme();

  // Solo gestores pueden acceder
  const denied = useRoleGuard(['admin_empresa', 'jefe_nomina', 'nomina'] as const);
  if (denied) return denied;

  const { data: registro, isLoading } = useRegistroDetalle(registroId);
  const { mutateAsync: corregir, isPending: isCorrigiendo } = useCorregirRegistro();

  const [showModal, setShowModal] = useState(false);
  const [horaEntrada, setHoraEntrada] = useState(registro?.hora_entrada || '');
  const [horaSalida, setHoraSalida] = useState(registro?.hora_salida || '');

  const handleCorregir = async () => {
    if (!registro) return;
    try {
      await corregir({
        registroId: registro.id,
        horaEntrada: horaEntrada || null,
        horaSalida: horaSalida || null,
      });
      showToast('Registro corregido exitosamente');
      setShowModal(false);
      router.back();
    } catch (err) {
      Alert.alert('Error', 'No se pudo corregir el registro');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (!registro) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center gap-4 px-6">
        <Ionicons name="search-outline" size={48} color="#94A3B8" />
        <Text className="text-base font-semibold text-foreground text-center">
          Registro no encontrado
        </Text>
        <Button label="Volver" onPress={() => router.back()} variant="secondary" />
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Detalle de Registro',
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
          headerBackTitle: 'Atrás',
          headerTintColor: theme.primary,
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerShadowVisible: true,
        }}
      />

      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Trabajador */}
          <View className="bg-card rounded-2xl border border-border px-5 py-4 gap-3">
            <Text className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
              Trabajador
            </Text>
            <Text className="text-lg font-bold text-foreground">
              {registro.trabajador_nombre} {registro.trabajador_apellido}
            </Text>
          </View>

          {/* Fecha */}
          <View className="bg-card rounded-2xl border border-border px-5 py-4 gap-3">
            <Text className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
              Fecha
            </Text>
            <Text className="text-lg font-bold text-foreground">
              {fmtFecha(registro.fecha)}
            </Text>
          </View>

          {/* Tiempos */}
          <View className="bg-card rounded-2xl border border-border px-5 py-5 gap-4">
            <Text className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
              Tiempos Registrados
            </Text>

            <View className="flex-row gap-4">
              <View className="flex-1 bg-muted rounded-xl px-4 py-3">
                <Text className="text-xs text-muted-foreground mb-1">Entrada</Text>
                <Text className="text-2xl font-bold text-foreground">
                  {fmtHora(registro.hora_entrada)}
                </Text>
              </View>

              <View className="items-center justify-center">
                <Ionicons name="arrow-forward" size={18} color="#94A3B8" />
              </View>

              <View className="flex-1 bg-muted rounded-xl px-4 py-3">
                <Text className="text-xs text-muted-foreground mb-1">Salida</Text>
                <Text className="text-2xl font-bold text-foreground">
                  {fmtHora(registro.hora_salida)}
                </Text>
              </View>
            </View>
          </View>

          {/* Horas calculadas */}
          {registro.horas_ordinarias > 0 && (
            <View className="bg-card rounded-2xl border border-border px-5 py-4 gap-2">
              <Text className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-2">
                Clasificación de Horas
              </Text>
              {registro.horas_ordinarias > 0 && (
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted-foreground">Ordinarias</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {Number(registro.horas_ordinarias).toFixed(2)}h
                  </Text>
                </View>
              )}
              {registro.horas_nocturnas > 0 && (
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted-foreground">Nocturnas</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {Number(registro.horas_nocturnas).toFixed(2)}h
                  </Text>
                </View>
              )}
              {registro.horas_extra_diurnas > 0 && (
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted-foreground">Extra Diurna</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {Number(registro.horas_extra_diurnas).toFixed(2)}h
                  </Text>
                </View>
              )}
              {registro.horas_extra_nocturnas > 0 && (
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted-foreground">Extra Nocturna</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {Number(registro.horas_extra_nocturnas).toFixed(2)}h
                  </Text>
                </View>
              )}
              {registro.horas_festivo > 0 && (
                <View className="flex-row justify-between">
                  <Text className="text-sm text-muted-foreground">Festivo</Text>
                  <Text className="text-sm font-semibold text-foreground">
                    {Number(registro.horas_festivo).toFixed(2)}h
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Botón de corrección */}
          <Button
            label="Corregir Tiempos"
            variant="primary"
            size="lg"
            fullWidth
            onPress={() => {
              setHoraEntrada(registro.hora_entrada || '');
              setHoraSalida(registro.hora_salida || '');
              setShowModal(true);
            }}
          />
        </ScrollView>
      </SafeAreaView>

      {/* Modal de corrección */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 justify-end"
        >
          <View className="bg-black/40 flex-1 justify-end">
            <View className="bg-background rounded-t-3xl p-5 gap-4">
              <Text className="text-lg font-bold text-foreground">Corregir Tiempos</Text>

              <View className="gap-4">
                <View>
                  <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                    Hora Entrada (HH:MM)
                  </Text>
                  <TextInput
                    value={horaEntrada}
                    onChangeText={setHoraEntrada}
                    placeholder="08:00"
                    placeholderTextColor="#94A3B8"
                    className="bg-card border border-border rounded-2xl px-4 py-3 text-base text-foreground"
                  />
                </View>

                <View>
                  <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                    Hora Salida (HH:MM)
                  </Text>
                  <TextInput
                    value={horaSalida}
                    onChangeText={setHoraSalida}
                    placeholder="17:00"
                    placeholderTextColor="#94A3B8"
                    className="bg-card border border-border rounded-2xl px-4 py-3 text-base text-foreground"
                  />
                </View>
              </View>

              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => setShowModal(false)}
                  className="flex-1 h-12 rounded-2xl items-center justify-center border border-border active:opacity-70"
                >
                  <Text className="text-sm font-semibold text-muted-foreground">Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleCorregir}
                  disabled={isCorrigiendo}
                  className="flex-1 h-12 rounded-2xl items-center justify-center active:opacity-80"
                  style={{ backgroundColor: theme.primary, opacity: isCorrigiendo ? 0.6 : 1 }}
                >
                  {isCorrigiendo ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-sm font-semibold text-white">Guardar</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
