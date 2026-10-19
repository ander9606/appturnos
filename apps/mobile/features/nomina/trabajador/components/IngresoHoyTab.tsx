import { Text } from '@/components/ui/Text';
import { COLORS, ACCENT, alpha } from '@/lib/designTokens';
import React from 'react';
import { View, TouchableOpacity, ScrollView, Linking, Platform, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { PuntoMarcaje, DescansoCompensatorio } from '@api-client';
import type { RegistroDiario } from '@api-client';
import { MarcaPeriodoAnterior } from './MarcaPeriodoAnterior';
import { CompensatorioBanner } from '../../compensatorios/CompensatorioBanner';
import { fmtHora, calcularElapsedLabel, horaEntradaMostrada, getJornadaLegalSemanal, type EstadoHoy, type ResumenPeriodoNomina } from '../nominaTrabajadorUtils';

interface Props {
  cargo:          string | null;
  puntoMarcaje:   PuntoMarcaje | null;
  puntosZonales:  PuntoMarcaje[];
  tipoMarcacion:  'libre' | 'fijo' | 'zonal';
  estadoHoy:      EstadoHoy;
  periodoAbierto: boolean;
  resumenSemana:  ResumenPeriodoNomina;
  horasPeriodoAnterior: number;
  registroHoy:    RegistroDiario | null;
  compensatorios: DescansoCompensatorio[];
  isRefetching:   boolean;
  onRefresh:      () => void;
  primaryColor:   string;
  onVerDetalles:  () => void;
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
  puntosZonales,
  tipoMarcacion,
  estadoHoy,
  periodoAbierto,
  resumenSemana,
  horasPeriodoAnterior,
  registroHoy,
  compensatorios,
  isRefetching,
  onRefresh,
  primaryColor,
  onVerDetalles,
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
            <Ionicons name="location-outline" size={16} color={COLORS.mutedForeground} />
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
            <Ionicons name="navigate-outline" size={13} color={COLORS.info} />
            <Text className="text-xs font-semibold text-info">Cómo llegar</Text>
          </TouchableOpacity>
        </View>
      )}

      {tipoMarcacion === 'zonal' && puntosZonales.length > 0 && (
        <View className="bg-card rounded-2xl p-4 gap-3 border border-border">
          <View className="flex-row items-center gap-2">
            <Ionicons name="location-outline" size={16} color={COLORS.mutedForeground} />
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Puedes marcar en cualquiera de estas zonas
            </Text>
          </View>
          {puntosZonales.map((p) => (
            <View key={p.id} className="flex-row items-center justify-between gap-2">
              <Text className="text-sm text-foreground flex-1" numberOfLines={1}>{p.nombre}</Text>
              <TouchableOpacity
                onPress={() => abrirMaps(p.latitud, p.longitud, p.nombre)}
                className="flex-row items-center gap-1.5 bg-info/10 px-3 py-1.5 rounded-full"
                accessibilityRole="button"
                accessibilityLabel={`Abrir ${p.nombre} en mapas`}
              >
                <Ionicons name="navigate-outline" size={13} color={COLORS.info} />
                <Text className="text-xs font-semibold text-info">Cómo llegar</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* ── Tu cargo ─────────────────────────────────────── */}
      {cargo ? (
        <View className="bg-card rounded-2xl p-4 gap-2 border border-border">
          <View className="flex-row items-center gap-2">
            <Ionicons name="briefcase-outline" size={16} color={COLORS.mutedForeground} />
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
            <Ionicons name="time-outline" size={16} color={COLORS.mutedForeground} />
            <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Hoy
            </Text>
          </View>
          <View className="flex-row gap-6">
            <View className="gap-0.5">
              <Text className="text-xs text-muted-foreground">Entrada</Text>
              <Text className="text-base font-bold text-foreground">
                {fmtHora(horaEntradaMostrada(registroHoy))}
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

          {/* Desglose en vivo — mismas reglas que un día cerrado, pero sigue cambiando hasta marcar salida. */}
          {estadoHoy === 'en_jornada' && registroHoy.en_vivo && (
            Number(registroHoy.horas_nocturnas) > 0 ||
            Number(registroHoy.horas_extra_diurnas) > 0 ||
            Number(registroHoy.horas_extra_nocturnas) > 0 ||
            Number(registroHoy.horas_festivo) > 0
          ) ? (
            <View className="gap-1 pt-1 border-t border-border">
              <View className="flex-row gap-1.5 flex-wrap">
                {Number(registroHoy.horas_nocturnas) > 0 && (
                  <View className="bg-blue-50 px-2 py-0.5 rounded-full">
                    <Text className="text-[10px] font-semibold text-info">
                      {Number(registroHoy.horas_nocturnas).toFixed(1)}h noct.
                    </Text>
                  </View>
                )}
                {Number(registroHoy.horas_extra_diurnas) > 0 && (
                  <View className="bg-primary-50 px-2 py-0.5 rounded-full">
                    <Text className="text-[10px] font-semibold text-primary-600">
                      +{Number(registroHoy.horas_extra_diurnas).toFixed(1)}h ext. diurna
                    </Text>
                  </View>
                )}
                {Number(registroHoy.horas_extra_nocturnas) > 0 && (
                  <View className="bg-primary-50 px-2 py-0.5 rounded-full">
                    <Text className="text-[10px] font-semibold text-primary-600">
                      +{Number(registroHoy.horas_extra_nocturnas).toFixed(1)}h ext. noct.
                    </Text>
                  </View>
                )}
                {Number(registroHoy.horas_festivo) > 0 && (
                  <View className="bg-danger-light px-2 py-0.5 rounded-full">
                    <Text className="text-[10px] font-semibold text-danger">Festivo</Text>
                  </View>
                )}
              </View>
              <Text className="text-[10px] text-muted-foreground">
                Estimado — sigue cambiando hasta que marques salida.
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* ── Alertas compensatorios ───────────────────────── */}
      {compensatorios.length > 0 && <CompensatorioBanner compensatorios={compensatorios} />}

      {/* ── Barra de horas semanales ─────────────────────── */}
      {(() => {
        const semana   = resumenSemana.semanas[0];
        const limite   = semana?.limiteHoras ?? getJornadaLegalSemanal(new Date().getFullYear());
        const festivoH = resumenSemana.horasFestivo;
        const totalH   = resumenSemana.totalHoras - festivoH; // el festivo habitual no cuenta para las 42 h
        const extraH   = resumenSemana.horasExtraDiurnas + resumenSemana.horasExtraNocturnas;
        const ordinH   = Math.max(0, totalH - extraH);
        const pctOrdin = Math.min(100, (ordinH / limite) * 100);
        const pctExtra = Math.min(100 - pctOrdin, (extraH / limite) * 100);
        const hayExtra = extraH > 0;

        return (
          <View className="bg-card border border-border rounded-2xl p-4 gap-3">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Horas esta semana
                </Text>
                <View className="flex-row items-baseline gap-1.5 mt-0.5">
                  <Text className="text-xl font-extrabold text-foreground">
                    {totalH.toFixed(1)}h
                  </Text>
                  <Text className="text-xs text-muted-foreground">/ {limite}h límite</Text>
                  {hayExtra && (
                    <View className="bg-amber-100 rounded-full px-1.5 py-0.5">
                      <Text className="text-amber-700 text-[9px] font-bold">+{extraH.toFixed(1)}h extra</Text>
                    </View>
                  )}
                </View>
              </View>
              <TouchableOpacity
                onPress={onVerDetalles}
                className="flex-row items-center gap-1 px-3 py-1.5 rounded-full border border-border active:opacity-70"
                hitSlop={6}
              >
                <Text className="text-xs font-semibold text-muted-foreground">Ver detalles</Text>
                <Ionicons name="chevron-forward" size={11} color={COLORS.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Barra dos colores */}
            <View className="relative h-3 bg-muted rounded-full overflow-hidden flex-row">
              {pctOrdin > 0 && (
                <View
                  className="h-full rounded-full"
                  style={{ width: `${pctOrdin}%`, backgroundColor: primaryColor }}
                />
              )}
              {pctExtra > 0 && (
                <View
                  className="h-full"
                  style={{ width: `${pctExtra}%`, backgroundColor: COLORS.warning }}
                />
              )}
              <MarcaPeriodoAnterior horas={horasPeriodoAnterior} limite={limite} color={COLORS.slate700} />
            </View>
            {horasPeriodoAnterior > 0 && (
              <Text className="text-[10px] text-muted-foreground">
                La raya marca dónde termina el período anterior ({horasPeriodoAnterior.toFixed(1)}h antes de la raya).
              </Text>
            )}

            {festivoH > 0 && (
              <Text className="text-xs text-danger font-medium">
                +{festivoH.toFixed(1)}h festivo (recargo, no cuenta para las {limite}h)
              </Text>
            )}

            {hayExtra ? (
              <Text className="text-xs text-amber-600 font-medium">
                Superaste el límite legal — las horas extra se pagan con recargo.
              </Text>
            ) : (
              <Text className="text-xs text-muted-foreground">
                La barra cambia a naranja al acumular horas extra.
              </Text>
            )}
          </View>
        );
      })()}

      {/* ── Acceso a la pantalla de marcaje ──────────────── */}
      {estadoHoy === 'sin_periodo' ? (
        <View className="bg-muted rounded-2xl py-4 items-center px-4 gap-1">
          <Text className="text-sm font-semibold text-muted-foreground text-center">Sin período de nómina activo</Text>
          <Text className="text-xs text-muted-foreground text-center">
            Tu responsable debe abrir un período para que puedas registrar horas.
          </Text>
        </View>
      ) : estadoHoy === 'compensatorio' ? (
        <View className="rounded-2xl py-4 items-center px-4 gap-1" style={{ backgroundColor: alpha(ACCENT.violeta, 0.09) }}>
          <View className="flex-row items-center gap-2">
            <Ionicons name="bed-outline" size={20} color={ACCENT.violeta} />
            <Text className="text-sm font-semibold text-center" style={{ color: ACCENT.violeta }}>
              Hoy es tu descanso compensatorio
            </Text>
          </View>
          <Text className="text-xs text-muted-foreground text-center">
            No tienes que marcar entrada.
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
              name={
                estadoHoy === 'en_jornada'         ? 'timer-outline'            :
                estadoHoy === 'jornada_completa'   ? 'checkmark-circle-outline' :
                estadoHoy === 'reingreso_pendiente'? 'hourglass-outline'         :
                estadoHoy === 'reingreso_aprobado' ? 'enter-outline'             :
                'log-in-outline'
              }
              size={22}
              color="white"
            />
            <Text className="text-base font-bold text-white">
              {estadoHoy === 'en_jornada'
                ? `En jornada · ${registroHoy?.hora_entrada ? calcularElapsedLabel(registroHoy.hora_entrada) : '—'}`
                : estadoHoy === 'jornada_completa'
                ? 'Jornada completada'
                : estadoHoy === 'reingreso_pendiente'
                ? 'Reingreso en espera'
                : estadoHoy === 'reingreso_aprobado'
                ? 'Reingreso aprobado'
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
