/**
 * Planes y precios — panel super_admin.
 * Edita precio, tope y cobro por trabajador adicional de cada plan (tabla
 * `planes`). Espejo de la página web /admin/planes. Un cambio solo afecta
 * los links de pago que se generen después; lo ya pagado no cambia.
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { precioPlanCop, type PlanConfig, type ApiError } from '@api-client';
import { usePlanes, useActualizarPlan } from '@/features/admin/useAdmin';
import { useAuthStore } from '@/features/auth/useAuthStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { formatCOP } from '@/lib/formatters';
import { showToast } from '@/lib/toast';

// Tamaños de empresa para la vista previa de "cuánto pagaría".
const EJEMPLOS_TRABAJADORES = [5, 25, 100];

/** '' → null (campo opcional vacío); cualquier otro valor → entero. */
function aEnteroONull(v: string): number | null {
  return v.trim() === '' ? null : Math.round(Number(v));
}

const aTexto = (n: number | null) => (n == null ? '' : String(n));

function PlanCard({ plan }: { plan: PlanConfig }) {
  const actualizar = useActualizarPlan();
  const [precio, setPrecio] = useState(String(plan.precio_cop));
  const [max, setMax] = useState(aTexto(plan.max_trabajadores));
  const [incluidos, setIncluidos] = useState(aTexto(plan.incluidos));
  const [adicional, setAdicional] = useState(aTexto(plan.precio_adicional_cop));

  const borrador: PlanConfig = {
    ...plan,
    precio_cop: aEnteroONull(precio) ?? 0,
    max_trabajadores: aEnteroONull(max),
    incluidos: aEnteroONull(incluidos),
    precio_adicional_cop: aEnteroONull(adicional),
  };
  const numerosInvalidos = [precio, max, incluidos, adicional].some((v) => v.trim() !== '' && !/^\d+$/.test(v.trim()));
  const adicionalesIncompletos = (borrador.incluidos == null) !== (borrador.precio_adicional_cop == null);
  const cambio =
    borrador.precio_cop !== plan.precio_cop ||
    borrador.max_trabajadores !== plan.max_trabajadores ||
    borrador.incluidos !== plan.incluidos ||
    borrador.precio_adicional_cop !== plan.precio_adicional_cop;

  const guardar = () =>
    actualizar.mutate(
      {
        codigo: plan.codigo,
        datos: {
          precio_cop: borrador.precio_cop,
          max_trabajadores: borrador.max_trabajadores,
          incluidos: borrador.incluidos,
          precio_adicional_cop: borrador.precio_adicional_cop,
        },
      },
      {
        onSuccess: () => showToast(`${plan.nombre} actualizado`),
        onError: (err) => Alert.alert('No se pudo guardar', (err as ApiError).message || 'Intenta de nuevo.'),
      },
    );

  return (
    <View className="mx-4 mb-4 bg-card border border-border rounded-2xl p-4 gap-3">
      <View className="flex-row items-baseline justify-between">
        <Text className="text-base font-bold text-foreground">{plan.nombre}</Text>
        <Text className="text-lg font-bold text-foreground">
          {formatCOP(borrador.precio_cop)}
          <Text className="text-xs font-normal text-muted-foreground">/mes</Text>
        </Text>
      </View>

      <Input label="Precio base (COP/mes)" value={precio} onChangeText={setPrecio} keyboardType="number-pad" />
      <Input label="Máx. trabajadores" hint="Vacío = sin tope" value={max} onChangeText={setMax} keyboardType="number-pad" />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Input label="Incluidos" hint="Vacío = sin adicional" value={incluidos} onChangeText={setIncluidos} keyboardType="number-pad" />
        </View>
        <View className="flex-1">
          <Input label="Precio por adicional" value={adicional} onChangeText={setAdicional} keyboardType="number-pad" />
        </View>
      </View>

      {numerosInvalidos && (
        <Text className="text-xs text-danger" accessibilityRole="alert">Usa solo números enteros, sin puntos ni signos.</Text>
      )}
      {adicionalesIncompletos && (
        <Text className="text-xs text-danger" accessibilityRole="alert">
          "Incluidos" y "Precio por adicional" van juntos: llena ambos o deja ambos vacíos.
        </Text>
      )}

      <View className="bg-muted rounded-xl px-3 py-2 gap-0.5">
        <Text className="text-[11px] font-semibold text-muted-foreground uppercase mb-1">Una empresa pagaría</Text>
        {EJEMPLOS_TRABAJADORES.map((n) => {
          const excede = borrador.max_trabajadores != null && n > borrador.max_trabajadores;
          return (
            <View key={n} className="flex-row justify-between">
              <Text className="text-xs text-foreground">{n} trabajadores</Text>
              <Text className={`text-xs ${excede ? 'text-muted-foreground' : 'font-semibold text-foreground'}`}>
                {excede ? 'excede el tope' : formatCOP(precioPlanCop(borrador, n))}
              </Text>
            </View>
          );
        })}
      </View>

      <Button
        label="Guardar"
        onPress={guardar}
        loading={actualizar.isPending}
        disabled={!cambio || numerosInvalidos || adicionalesIncompletos || precio.trim() === ''}
        fullWidth
      />
    </View>
  );
}

export default function PlanesScreen() {
  const router = useRouter();
  const isSuperAdmin = useAuthStore((s) => s.usuario?.rol === 'super_admin');
  const { data: planes, isLoading, isError, refetch, isRefetching } = usePlanes(isSuperAdmin);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <View className="px-4 pt-3 pb-5 flex-row items-center gap-3" style={{ backgroundColor: '#6366F1' }}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Volver" hitSlop={12}>
          <Text className="text-white text-base">←</Text>
        </Pressable>
        <View className="flex-1">
          <Text className="text-white text-lg font-bold">🏷️ Planes y precios</Text>
          <Text className="text-white/70 text-xs">Aplica a los próximos cobros; lo pagado no cambia</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6366F1" colors={['#6366F1']} />}
      >
        {isLoading && (
          <View className="items-center py-16">
            <ActivityIndicator size="large" color="#6366F1" />
          </View>
        )}
        {isError && (
          <View className="mx-4 bg-danger/10 border border-danger/30 rounded-2xl p-4 items-center gap-2">
            <Text className="text-danger font-semibold">Error al cargar planes</Text>
            <Pressable onPress={() => refetch()} accessibilityRole="button">
              <Text className="text-primary text-sm font-semibold">Reintentar</Text>
            </Pressable>
          </View>
        )}
        {/* key incluye updated_at: tras guardar, la tarjeta se reinicia con los valores del servidor. */}
        {planes?.map((p) => <PlanCard key={`${p.codigo}-${p.updated_at}`} plan={p} />)}
      </ScrollView>
    </SafeAreaView>
  );
}
