/**
 * Mi plan — uso del plan (trabajadores activos vs. tope) y ampliación.
 * Solo admin_empresa. El admin elige plan + meses y paga con un link de
 * Wompi; al aprobarse el pago el webhook cambia el plan y extiende la
 * vigencia (wompi.service.js → activarSuscripcion).
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { empresasApi, ApiError } from '@api-client';
import type { PlanEmpresa, PlanOpcion } from '@api-client';
import { Button } from '@/components/ui/Button';
import { useRoleGuard } from '@/components/RoleGuard';
import { formatCOP, formatDate } from '@/lib/formatters';
import { useTheme } from '@/lib/theme';

const OPCIONES_MESES = [1, 3, 6, 12];

/** "Hasta 10 trabajadores" / "80 incluidos + $3.500 por adicional" / "Sin tope de trabajadores". */
function describirPlan(p: PlanOpcion): string {
  if (p.incluidos != null) return `${p.incluidos} incluidos + ${formatCOP(p.precio_adicional_cop ?? 0)} por adicional`;
  return p.max_trabajadores != null ? `Hasta ${p.max_trabajadores} trabajadores` : 'Sin tope de trabajadores';
}

export default function MiPlanScreen() {
  const theme = useTheme();
  const [planElegido, setPlanElegido] = useState<PlanEmpresa | null>(null);
  const [meses, setMeses] = useState(1);

  const { data: s, isLoading, isError, refetch } = useQuery({
    queryKey: ['empresa', 'suscripcion'],
    queryFn: () => empresasApi.obtenerSuscripcion(),
    staleTime: 60_000,
  });

  const pagar = useMutation({
    mutationFn: (plan: PlanEmpresa) => empresasApi.generarLinkPago({ meses, plan }),
    // Link hospedado por Wompi, se abre en el navegador del sistema — no un webview embebido.
    onSuccess: (link) => Linking.openURL(link.url),
    onError: (error: ApiError) =>
      Alert.alert('No se pudo generar el link de pago', error.message || 'Intenta de nuevo o contacta a soporte.'),
  });

  const denied = useRoleGuard(['admin_empresa']);
  if (denied) return denied;

  if (isLoading || !s) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center" edges={['bottom']}>
        <Stack.Screen options={{ title: 'Mi plan', headerShown: true }} />
        {isError ? (
          <Pressable onPress={() => refetch()} accessibilityRole="button" className="px-4 py-2">
            <Text className="text-sm text-primary">No se pudo cargar. Toca para reintentar.</Text>
          </Pressable>
        ) : (
          <ActivityIndicator size="large" color={theme.primary} />
        )}
      </SafeAreaView>
    );
  }

  const elegido = planElegido ?? s.plan;
  const opcion = s.planes.find((p) => p.codigo === elegido);
  const esCambio = elegido !== s.plan;
  const enTope = s.max_trabajadores != null && s.trabajadores_activos >= s.max_trabajadores;
  const uso = s.max_trabajadores ? Math.min(100, Math.round((s.trabajadores_activos / s.max_trabajadores) * 100)) : null;
  const colorUso = enTope ? 'bg-danger' : (uso ?? 0) >= 80 ? 'bg-warning' : 'bg-primary';

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Mi plan', headerShown: true }} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 20 }} showsVerticalScrollIndicator={false}>

        {/* ── Plan actual y uso ─────────────────────────────────────── */}
        <View className="bg-card border border-border rounded-2xl p-5 gap-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-xs text-muted-foreground uppercase">Plan actual</Text>
              <Text className="text-lg font-bold text-foreground">
                {s.planes.find((p) => p.codigo === s.plan)?.nombre ?? s.plan}
              </Text>
            </View>
            <View className={`px-2 py-0.5 rounded-full ${s.activa ? 'bg-success-light' : 'bg-danger-light'}`}>
              <Text className={`text-xs font-medium ${s.activa ? 'text-success' : 'text-danger'}`}>
                {s.activa ? 'Activa' : 'Vencida'}
              </Text>
            </View>
          </View>

          {s.vigente_hasta && s.origen !== 'logiq360' && (
            <Text className="text-xs text-muted-foreground">Vence el {formatDate(s.vigente_hasta)}</Text>
          )}

          <View className="gap-1.5">
            <View className="flex-row justify-between">
              <Text className="text-xs text-muted-foreground uppercase">Trabajadores activos</Text>
              <Text className={`text-xs font-semibold ${enTope ? 'text-danger' : 'text-foreground'}`}>
                {s.trabajadores_activos}{s.max_trabajadores != null ? ` de ${s.max_trabajadores}` : ' · sin tope'}
              </Text>
            </View>
            {uso !== null && (
              <View
                className="h-2 bg-muted rounded-full overflow-hidden"
                accessibilityRole="progressbar"
                accessibilityLabel="Trabajadores activos frente al tope del plan"
                accessibilityValue={{ min: 0, max: s.max_trabajadores ?? undefined, now: s.trabajadores_activos }}
              >
                <View className={`h-full rounded-full ${colorUso}`} style={{ width: `${uso}%` }} />
              </View>
            )}
            {enTope && s.origen !== 'logiq360' && (
              <Text className="text-xs text-danger">
                Llegaste al tope de tu plan. Para agregar más trabajadores, amplíalo abajo.
              </Text>
            )}
          </View>
        </View>

        {s.origen === 'logiq360' ? (
          <View className="bg-success-light border border-success/30 rounded-2xl px-4 py-3 flex-row gap-3 items-center">
            <Ionicons name="link" size={18} color="#16a34a" />
            <Text className="text-success text-sm flex-1">
              Tu suscripción se gestiona con tu integración logiq360 — no necesitas pagarla aquí.
            </Text>
          </View>
        ) : (
          <>
            {/* ── Elegir plan ───────────────────────────────────────── */}
            <View className="gap-2">
              <Text className="text-sm font-semibold text-foreground">Renovar o ampliar plan</Text>
              <Text className="text-xs text-muted-foreground">
                Al pagar, el plan elegido se activa de inmediato y tu suscripción se extiende por los meses que pagues.
              </Text>
              <View accessibilityRole="radiogroup" className="gap-2 mt-1">
                {s.planes.map((p) => {
                  const activo = elegido === p.codigo;
                  return (
                    <Pressable
                      key={p.codigo}
                      onPress={() => setPlanElegido(p.codigo)}
                      disabled={!p.disponible}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: activo, disabled: !p.disponible }}
                      className={`flex-row items-center gap-3 rounded-2xl border px-4 py-3 ${
                        !p.disponible ? 'opacity-50 border-border bg-card'
                        : activo ? 'border-primary-500 bg-primary/10' : 'border-border bg-card'}`}
                    >
                      <Ionicons
                        name={activo ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={activo ? theme.primary : '#94A3B8'}
                      />
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-foreground">
                          {p.nombre}
                          {p.codigo === s.plan && <Text className="text-xs font-normal text-muted-foreground"> · actual</Text>}
                        </Text>
                        <Text className="text-xs text-muted-foreground">
                          {p.disponible ? describirPlan(p) : `No admite tus ${s.trabajadores_activos} trabajadores activos`}
                        </Text>
                      </View>
                      <Text className="text-sm font-bold text-foreground">
                        {formatCOP(p.precio_mensual_cop)}
                        <Text className="text-xs font-normal text-muted-foreground">/mes</Text>
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* ── Meses ─────────────────────────────────────────────── */}
            <View className="gap-2">
              <Text className="text-xs text-muted-foreground uppercase">Meses a pagar</Text>
              <View className="flex-row gap-2" accessibilityRole="radiogroup">
                {OPCIONES_MESES.map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => setMeses(m)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: meses === m }}
                    accessibilityLabel={`${m} ${m === 1 ? 'mes' : 'meses'}`}
                    className={`flex-1 rounded-xl border py-2 items-center ${
                      meses === m ? 'border-primary-500 bg-primary/10' : 'border-border bg-card'}`}
                  >
                    <Text className={`text-sm font-semibold ${meses === m ? 'text-primary' : 'text-muted-foreground'}`}>{m}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View className="flex-row justify-between items-center">
              <Text className="text-sm text-muted-foreground">Total</Text>
              <Text className="text-lg font-bold text-foreground">
                {opcion ? formatCOP(opcion.precio_mensual_cop * meses) : '—'}
              </Text>
            </View>

            <Button
              label={esCambio ? `Pagar y cambiar a ${opcion?.nombre ?? ''}` : 'Pagar y renovar'}
              onPress={() => pagar.mutate(elegido)}
              loading={pagar.isPending}
              disabled={!opcion?.disponible}
              fullWidth
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
