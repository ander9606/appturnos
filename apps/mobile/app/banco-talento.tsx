import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useBancoTalento } from '@/features/equipo/useEquipo';
import { useInvitar } from '@/features/empresas/useTrabajadorEmpresa';
import { Avatar } from '@/components/ui/Avatar';
import { COLORS } from '@/lib/designTokens';
import { useRoleGuard } from '@/components/RoleGuard';
import { showToast } from '@/lib/toast';
import { apiErrorMessage } from '@/lib/apiErrorMessage';
import type { BancoTalentoWorker } from '@api-client';

// ── Row ────────────────────────────────────────────────────────────────────

/** Igual formato que solicitudes.tsx (perfil_previo.experiencias). */
function fmtFechaCorta(iso: string | null) {
  if (!iso) return 'actualidad';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' });
}

function TrabajadorRow({ trabajador, invitado, onInvitar, invitando }: {
  trabajador: BancoTalentoWorker;
  invitado: boolean;
  invitando: boolean;
  onInvitar: () => void;
}) {
  const experienciasVisibles = trabajador.experiencias.slice(0, 2);
  const experienciasRestantes = trabajador.experiencias.length - experienciasVisibles.length;

  return (
    <View className="bg-card rounded-xl p-4 mb-3 flex-row items-center border border-border">
      <Avatar id={trabajador.id} nombre={trabajador.nombre} apellido={trabajador.apellido} fotoB64={trabajador.foto_perfil} size={44} expandable />
      <View className="flex-1 min-w-0 mx-3">
        <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
          {trabajador.nombre} {trabajador.apellido}
        </Text>
        {trabajador.cargo != null && (
          <Text className="text-sm text-muted-foreground" numberOfLines={1}>{trabajador.cargo}</Text>
        )}
        {trabajador.descripcion != null && (
          <Text className="text-xs text-muted-foreground mt-0.5" numberOfLines={2}>{trabajador.descripcion}</Text>
        )}
        {trabajador.ranking != null && (
          <View className="flex-row items-center gap-1 mt-1">
            <Ionicons name="star" size={12} color="#F59E0B" />
            <Text className="text-xs font-medium text-foreground">
              {trabajador.ranking.toFixed(1)} ({trabajador.total_calificaciones})
            </Text>
          </View>
        )}
        {experienciasVisibles.map((exp) => (
          <Text key={exp.id} className="text-xs text-muted-foreground mt-0.5" numberOfLines={1}>
            {exp.cargo} · {exp.empresa_nombre} ({fmtFechaCorta(exp.fecha_inicio)} – {fmtFechaCorta(exp.fecha_fin)})
          </Text>
        ))}
        {experienciasRestantes > 0 && (
          <Text className="text-xs text-muted-foreground italic">+{experienciasRestantes} más</Text>
        )}
      </View>
      <Pressable
        onPress={onInvitar}
        disabled={invitado || invitando}
        className={`h-9 px-3 rounded-xl items-center justify-center flex-row gap-1 ${invitado ? 'bg-success/10' : 'bg-info'}`}
      >
        {invitando ? (
          <ActivityIndicator size="small" color={invitado ? COLORS.success : '#fff'} />
        ) : invitado ? (
          <>
            <Ionicons name="checkmark" size={14} color={COLORS.success} />
            <Text className="text-xs font-semibold text-success">Invitado</Text>
          </>
        ) : (
          <Text className="text-xs font-semibold text-white">Invitar</Text>
        )}
      </Pressable>
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────

export default function BancoTalentoScreen() {
  const [busqueda, setBusqueda] = useState('');
  const [q, setQ] = useState('');
  const [invitados, setInvitados] = useState<Set<number>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setQ(busqueda), 400);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [busqueda]);

  const { data, isLoading, isFetching } = useBancoTalento(q);
  const invitar = useInvitar();
  const denied = useRoleGuard(['admin_empresa', 'jefe_turnos']);
  if (denied) return denied;

  const trabajadores = data?.data ?? [];

  function handleInvitar(t: BancoTalentoWorker) {
    invitar.mutate({ cedula: t.cedula, tipo: 'turnos' }, {
      onSuccess: () => {
        setInvitados((prev) => new Set(prev).add(t.id));
        showToast(`${t.nombre} ${t.apellido} recibirá una notificación para unirse a tu empresa.`);
      },
      onError: (err: unknown) => Alert.alert('Error', apiErrorMessage(err, 'No se pudo enviar la invitación.')),
    });
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Banco de talento', headerTintColor: COLORS.info }} />
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <View className="px-4 pt-4 pb-2">
          <Text className="text-sm text-muted-foreground mb-3">
            Trabajadores registrados en la plataforma que aún no pertenecen a ninguna empresa. Invítalos si te faltan
            manos para cubrir turnos.
          </Text>
          <View className="flex-row items-center bg-card border border-border rounded-xl px-3 h-11">
            <Ionicons name="search-outline" size={16} color="#64748B" style={{ marginRight: 8 }} />
            <TextInput
              className="flex-1 text-sm text-foreground"
              placeholder="Nombre o cargo…"
              placeholderTextColor={COLORS.placeholder}
              value={busqueda}
              onChangeText={setBusqueda}
              autoCorrect={false}
            />
            {isFetching && <ActivityIndicator size="small" color={COLORS.info} />}
          </View>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={COLORS.info} />
          </View>
        ) : (
          <FlatList
            data={trabajadores}
            keyExtractor={(t) => String(t.id)}
            contentContainerStyle={{ padding: 16, paddingTop: 4 }}
            renderItem={({ item }) => (
              <TrabajadorRow
                trabajador={item}
                invitado={invitados.has(item.id)}
                invitando={invitar.isPending && invitar.variables?.cedula === item.cedula}
                onInvitar={() => handleInvitar(item)}
              />
            )}
            ListEmptyComponent={
              <View className="items-center justify-center py-16">
                <Ionicons name="people-outline" size={48} color="#94A3B8" style={{ marginBottom: 12 }} />
                <Text className="text-base font-semibold text-foreground">Sin resultados</Text>
                <Text className="text-sm text-muted-foreground mt-1 text-center">
                  {q ? `No hay trabajadores libres que coincidan con "${q}".` : 'No hay trabajadores libres registrados todavía.'}
                </Text>
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </SafeAreaView>
    </>
  );
}
