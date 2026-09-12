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
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { useTheme } from '@/lib/theme';
import { useRegistroDetalle, useCorregirRegistro, useDescartarSospechoso } from '@/features/nomina/useRegistroDetalle';
import { minutosAlmuerzoDescontados, esJornadaLarga, fmtDuracionMin, explicarHorasExtra } from '@/features/nomina/trabajador/nominaTrabajadorUtils';
import { Button } from '@/components/ui/Button';
import { UbicacionLink } from '@/components/ui/UbicacionLink';
import { showToast } from '@/lib/toast';
import { useRoleGuard } from '@/components/RoleGuard';

function fmtHora(time: string | null): string {
  if (!time) return '—';
  return time.substring(0, 5);
}

/** Parsea "HH:MM:SS" o "HH:MM" a un Date de hoy con esa hora, para el picker. */
function horaAFecha(hora: string | null | undefined): Date | null {
  if (!hora) return null;
  const [h, m] = hora.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function fmtTime(d: Date | null): string {
  if (!d) return '—';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Todas las sesiones del día en orden: las cerradas (sesiones_detalle) + la vigente. */
function sesionesDelDia(registro: {
  sesiones_detalle: { hora_entrada: string; hora_salida: string }[] | null;
  hora_entrada: string | null;
  hora_salida: string | null;
}) {
  return [...(registro.sesiones_detalle ?? []), { hora_entrada: registro.hora_entrada, hora_salida: registro.hora_salida }];
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

  const { data: registro, isLoading } = useRegistroDetalle(registroId);
  const { mutateAsync: corregir, isPending: isCorrigiendo } = useCorregirRegistro();
  const { mutateAsync: descartarSospechoso, isPending: isDescartando } = useDescartarSospechoso();

  const [showModal, setShowModal] = useState(false);
  const [horaEntrada, setHoraEntrada] = useState<Date | null>(horaAFecha(registro?.hora_entrada));
  const [horaSalida, setHoraSalida] = useState<Date | null>(horaAFecha(registro?.hora_salida));
  const [showEntrada, setShowEntrada] = useState(false);
  const [showSalida, setShowSalida] = useState(false);
  const [verDetalle, setVerDetalle] = useState(false);

  function onChangeEntrada(_: DateTimePickerEvent, d?: Date) {
    if (Platform.OS === 'android') setShowEntrada(false);
    if (d) setHoraEntrada(d);
  }
  function onChangeSalida(_: DateTimePickerEvent, d?: Date) {
    if (Platform.OS === 'android') setShowSalida(false);
    if (d) setHoraSalida(d);
  }

  const handleCorregir = async () => {
    if (!registro) return;
    try {
      await corregir({
        registroId: registro.id,
        horaEntrada: horaEntrada ? fmtTime(horaEntrada) : null,
        horaSalida: horaSalida ? fmtTime(horaSalida) : null,
      });
      showToast('Registro corregido exitosamente');
      setShowModal(false);
      router.back();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo corregir el registro');
    }
  };

  const handleDescartarSospechoso = async () => {
    if (!registro) return;
    try {
      await descartarSospechoso(registro.id);
      showToast('Marcaje ya no está marcado como sospechoso');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo descartar el marcaje');
    }
  };

  if (denied) return denied;

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

  const minutosAlmuerzo = minutosAlmuerzoDescontados(registro);
  const explicacionExtra = explicarHorasExtra(registro);
  const jornadaContinuaSinDescuento = minutosAlmuerzo === 0 && registro.jornada_continua === 1 && esJornadaLarga(registro);
  const tieneDetalleTiempos = minutosAlmuerzo > 0 || jornadaContinuaSinDescuento || explicacionExtra !== null;

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
          {/* Sospechoso — mismo dispositivo y ubicación que otro trabajador (posible buddy punching) */}
          {registro.sospechoso === 1 && (
            <View className="flex-row items-center gap-3 bg-warning-light border border-warning/30 rounded-2xl px-4 py-3">
              <Ionicons name="warning-outline" size={20} color="#d97706" />
              <Text className="flex-1 text-warning text-xs">
                Marcaje sospechoso: mismo dispositivo y ubicación que otro trabajador.
              </Text>
              <TouchableOpacity
                onPress={handleDescartarSospechoso}
                disabled={isDescartando}
                className="px-3 py-1.5 rounded-xl border border-warning/40"
                accessibilityRole="button"
              >
                {isDescartando ? (
                  <ActivityIndicator size="small" color="#d97706" />
                ) : (
                  <Text className="text-warning text-xs font-semibold">Descartar</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

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

            {sesionesDelDia(registro).map((sesion, i, arr) => (
              <View key={i} className="gap-2">
                {arr.length > 1 && (
                  <Text className="text-xs font-semibold text-foreground">
                    Sesión {i + 1}{i === arr.length - 1 && !sesion.hora_salida ? ' (en curso)' : ''}
                  </Text>
                )}
                <View className="flex-row gap-4">
                  <View className="flex-1 bg-muted rounded-xl px-4 py-3">
                    <Text className="text-xs text-muted-foreground mb-1">Entrada</Text>
                    <Text className="text-2xl font-bold text-foreground">
                      {fmtHora(sesion.hora_entrada)}
                    </Text>
                  </View>

                  <View className="items-center justify-center">
                    <Ionicons name="arrow-forward" size={18} color="#94A3B8" />
                  </View>

                  <View className="flex-1 bg-muted rounded-xl px-4 py-3">
                    <Text className="text-xs text-muted-foreground mb-1">Salida</Text>
                    <Text className="text-2xl font-bold text-foreground">
                      {fmtHora(sesion.hora_salida)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
            {tieneDetalleTiempos && (
              <TouchableOpacity
                onPress={() => setVerDetalle((v) => !v)}
                className="flex-row items-center gap-1 self-start"
                accessibilityRole="button"
              >
                <Text className="text-xs font-semibold text-primary">
                  {verDetalle ? 'Ocultar detalle' : 'Ver detalle'}
                </Text>
                <Ionicons name={verDetalle ? 'chevron-up' : 'chevron-down'} size={12} color={theme.primary} />
              </TouchableOpacity>
            )}
            {verDetalle && minutosAlmuerzo > 0 && (
              <Text className="text-xs text-muted-foreground">
                🍽️ Se descontó {fmtDuracionMin(minutosAlmuerzo)} de almuerzo automáticamente (jornada mayor a 6h).
              </Text>
            )}
            {verDetalle && jornadaContinuaSinDescuento && (
              <Text className="text-xs text-success">
                ✓ El trabajador marcó jornada continua — sin descuento de almuerzo.
              </Text>
            )}
            {verDetalle && explicacionExtra && (
              <Text className="text-xs text-muted-foreground">
                Llevaba {explicacionExtra.acumuladoSemana.toFixed(1)}h esta semana → {explicacionExtra.cupoUsado.toFixed(1)}h
                de su cupo ({explicacionExtra.topeSemanal}h) + {explicacionExtra.horasExtra.toFixed(1)}h extra.
              </Text>
            )}
          </View>

          {/* Ubicación — solo si el dispositivo dio GPS al marcar */}
          {(registro.latitud_entrada != null || registro.latitud_salida != null) && (
            <View className="bg-card rounded-2xl border border-border px-5 py-4 gap-2">
              <Text className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">
                Ubicación
              </Text>
              {registro.latitud_entrada != null && (
                <UbicacionLink lat={registro.latitud_entrada} lng={registro.longitud_entrada!} label="Entrada" />
              )}
              {registro.latitud_salida != null && (
                <UbicacionLink lat={registro.latitud_salida} lng={registro.longitud_salida!} label="Salida" />
              )}
            </View>
          )}

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

          {/* Botón de corrección — bloqueado en el backend para registros con reingreso */}
          {registro.sesiones > 1 ? (
            <View className="bg-muted rounded-2xl px-4 py-3">
              <Text className="text-xs text-muted-foreground text-center">
                Este registro tiene reingresos y no se puede corregir aquí. Contacta al administrador del sistema.
              </Text>
            </View>
          ) : (
            <Button
              label="Corregir Tiempos"
              variant="primary"
              size="lg"
              fullWidth
              onPress={() => {
                setHoraEntrada(horaAFecha(registro.hora_entrada));
                setHoraSalida(horaAFecha(registro.hora_salida));
                setShowEntrada(false);
                setShowSalida(false);
                setShowModal(true);
              }}
            />
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Modal de corrección */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View className="bg-black/40 flex-1 justify-end">
          <View className="bg-background rounded-t-3xl p-5 gap-4">
            <Text className="text-lg font-bold text-foreground">Corregir Tiempos</Text>

            <View className="flex-row gap-4">
              <View className="flex-1 gap-1.5">
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
                  Entrada
                </Text>
                <TouchableOpacity
                  onPress={() => setShowEntrada(true)}
                  className="bg-card border border-border rounded-2xl px-4 py-3 items-center"
                >
                  <Text className={`text-base ${!horaEntrada ? 'text-muted-foreground' : 'text-foreground font-semibold'}`}>
                    {fmtTime(horaEntrada)}
                  </Text>
                </TouchableOpacity>
                {showEntrada && (
                  <DateTimePicker
                    value={horaEntrada ?? new Date()}
                    mode="time"
                    display="spinner"
                    onChange={onChangeEntrada}
                  />
                )}
                {showEntrada && Platform.OS === 'ios' && (
                  <TouchableOpacity onPress={() => setShowEntrada(false)} className="bg-primary/10 rounded-xl py-1.5 items-center">
                    <Text className="text-xs font-semibold text-primary">Listo</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View className="flex-1 gap-1.5">
                <Text className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">
                  Salida
                </Text>
                <TouchableOpacity
                  onPress={() => setShowSalida(true)}
                  className="bg-card border border-border rounded-2xl px-4 py-3 items-center"
                >
                  <Text className={`text-base ${!horaSalida ? 'text-muted-foreground' : 'text-foreground font-semibold'}`}>
                    {fmtTime(horaSalida)}
                  </Text>
                </TouchableOpacity>
                {showSalida && (
                  <DateTimePicker
                    value={horaSalida ?? new Date()}
                    mode="time"
                    display="spinner"
                    onChange={onChangeSalida}
                  />
                )}
                {showSalida && Platform.OS === 'ios' && (
                  <TouchableOpacity onPress={() => setShowSalida(false)} className="bg-primary/10 rounded-xl py-1.5 items-center">
                    <Text className="text-xs font-semibold text-primary">Listo</Text>
                  </TouchableOpacity>
                )}
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
      </Modal>
    </>
  );
}
