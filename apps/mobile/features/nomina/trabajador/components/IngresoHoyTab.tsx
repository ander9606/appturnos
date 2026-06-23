import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Linking, Platform, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { PuntoMarcaje, DescansoCompensatorio } from '@api-client';
import type { RegistroDiario } from '@api-client';
import { CompensatorioBanner } from '../../compensatorios/CompensatorioBanner';
import { fmtHora, calcularElapsedLabel, type EstadoHoy } from '../nominaTrabajadorUtils';

interface Props {
  cargo:          string | null;
  puntoMarcaje:   PuntoMarcaje | null;
  tipoMarcacion:  'libre' | 'fijo';
  estadoHoy:      EstadoHoy;
  periodoAbierto: boolean;
  registroHoy:    RegistroDiario | null;
  compensatorios: DescansoCompensatorio[];
  isRefetching:   boolean;
  onRefresh:      () => void;
  primaryColor:   string;
}

function abrirMaps(lat: number, lng: number, nombre: string) {
  const url = Platform.OS === 'ios'
    ? `maps://maps.apple.com/?q=${lat},${lng}`
    : `geo:${lat},${lng}?q=${encodeURIComponent(nombre)}`;
  Linking.openURL(url);
}

export function IngresoHoyTab({
  cargo,
  puntoMarcaje,
  tipoMarcacion,
  estadoHoy,
  periodoAbierto,
  registroHoy,
  compensatorios,
  isRefetching,
  onRefresh,
  primaryColor,
}: Props) {
  const router = useRouter();

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="gap-4 px-5 pb-8 pt-3"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={primaryColor} colors={[primaryColor]} />
      }
    >
      {/* ── Dónde ir ─────────────────────────────────────── */}
      {tipoMarcacion === 'fijo' && puntoMarcaje && (
        <View className="bg-card rounded-2xl p-4 gap-3 border border-border">
          <View className="flex-row items-center gap-2">
            <Ionicons name="location-outline" size={16} color="#64748B" />
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Dónde ir
            </Text>
          </View>
          <Text className="text-base font-bold text-foreground">{puntoMarcaje.nombre}</Text>
          {puntoMarcaje.descripcion ? (
            <Text className="text-sm text-muted-foreground">{puntoMarcaje.descripcion}</Text>
          ) : null}
          <TouchableOpacity
            onPress={() => abrirMaps(puntoMarcaje.latitud, puntoMarcaje.longitud, puntoMarcaje.nombre)}
            className="flex-row items-center gap-1.5 self-start bg-info/10 px-3 py-1.5 rounded-full"
            accessibilityRole="button"
            accessibilityLabel="Abrir en mapas"
          >
            <Ionicons name="navigate-outline" size={13} color="#3B82F6" />
            <Text className="text-xs font-semibold text-info">Cómo llegar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Tu cargo ─────────────────────────────────────── */}
      {cargo ? (
        <View className="bg-card rounded-2xl p-4 gap-2 border border-border">
          <View className="flex-row items-center gap-2">
            <Ionicons name="briefcase-outline" size={16} color="#64748B" />
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Tu cargo
            </Text>
          </View>
          <Text className="text-sm text-foreground">{cargo}</Text>
        </View>
      ) : null}

      {/* ── Estado de hoy ────────────────────────────────── */}
      {registroHoy ? (
        <View className="bg-card rounded-2xl p-4 gap-3 border border-border">
          <View className="flex-row items-center gap-2">
            <Ionicons name="time-outline" size={16} color="#64748B" />
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Hoy
            </Text>
          </View>
          <View className="flex-row gap-6">
            <View className="gap-0.5">
              <Text className="text-xs text-muted-foreground">Entrada</Text>
              <Text className="text-base font-bold text-foreground">
                {fmtHora(registroHoy.hora_entrada)}
              </Text>
            </View>
            {registroHoy.hora_salida ? (
              <View className="gap-0.5">
                <Text className="text-xs text-muted-foreground">Salida</Text>
                <Text className="text-base font-bold text-foreground">
                  {fmtHora(registroHoy.hora_salida)}
                </Text>
              </View>
            ) : estadoHoy === 'en_jornada' ? (
              <View className="gap-0.5">
                <Text className="text-xs text-muted-foreground">Transcurrido</Text>
                <Text className="text-base font-bold text-foreground">
                  {registroHoy.hora_entrada ? calcularElapsedLabel(registroHoy.hora_entrada) : '—'}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* ── Alertas compensatorios ───────────────────────── */}
      {compensatorios.length > 0 && <CompensatorioBanner compensatorios={compensatorios} />}

      {/* ── Acceso a la pantalla de marcaje ──────────────── */}
      {estadoHoy === 'sin_periodo' ? (
        <View className="bg-muted rounded-2xl py-4 items-center px-4 gap-1">
          <Text className="text-sm font-semibold text-muted-foreground text-center">Sin período de nómina activo</Text>
          <Text className="text-xs text-muted-foreground text-center">
            Tu responsable debe abrir un período para que puedas registrar horas.
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => router.push('/nomina-ingreso')}
          className="rounded-2xl py-4 items-center gap-1 active:opacity-80"
          style={{ backgroundColor: primaryColor }}
          accessibilityRole="button"
          accessibilityLabel="Ir a pantalla de marcaje"
        >
          <View className="flex-row items-center gap-2">
            <Ionicons
              name={estadoHoy === 'en_jornada' ? 'timer-outline' : estadoHoy === 'jornada_completa' ? 'checkmark-circle-outline' : 'log-in-outline'}
              size={22}
              color="white"
            />
            <Text className="text-base font-bold text-white">
              {estadoHoy === 'en_jornada'
                ? `En jornada · ${registroHoy?.hora_entrada ? calcularElapsedLabel(registroHoy.hora_entrada) : '—'}`
                : estadoHoy === 'jornada_completa'
                ? 'Jornada completada'
                : 'Marcar entrada'}
            </Text>
          </View>
          <Text className="text-white/70 text-xs">
            {estadoHoy === 'en_jornada' ? 'Toca para ver el contador y marcar salida →' : 'Toca para abrir el marcaje →'}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}
