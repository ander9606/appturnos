/**
 * Pantalla de inbox de notificaciones.
 * Accesible desde la campana del header en cualquier tab.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  useNotificaciones,
  useMarcarLeida,
  useMarcarTodasLeidas,
} from '@/features/notificaciones/useNotificaciones';
import { useTheme } from '@/lib/theme';
import type { Notificacion } from '@api-client';

// ── Helpers ───────────────────────────────────────────────────────────────

const TIPO_ICON: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  'postulacion.confirmada':      'checkmark-circle-outline',
  'asignacion.cancelada':        'close-circle-outline',
  'postulacion.rechazada':       'close-circle-outline',
  'turno.ingreso':               'log-in-outline',
  'turno.cerrado_gestor':        'checkmark-done-outline',
  'turno.no_presentado_gestor':  'alert-circle-outline',
  'calificacion.recibida':       'star-outline',
  'asignacion.no_presentado':    'alert-circle-outline',
  'nomina.periodo_abierto':      'folder-open-outline',
  'nomina.periodo_liquidado':    'cash-outline',
  'oferta.nueva':                'megaphone-outline',
  'oferta.modificada':           'create-outline',
  'oferta.cancelada':            'close-circle-outline',
  'oferta.personal_incompleto':  'people-outline',
  'novedad_turno':               'chatbubble-outline',
  'reingreso.solicitado':        'refresh-circle-outline',
  'reingreso.aprobado':          'checkmark-circle-outline',
  'reingreso.rechazado':         'close-circle-outline',
  'suscripcion.pago_rechazado':  'card-outline',
  'ausencia.nueva':              'calendar-clear-outline',
  'ausencia.resuelta':           'calendar-outline',
  'nomina.compensatorio_asignado': 'sunny-outline',
  'integracion.activada':        'link-outline',
  'integracion.desactivada':     'unlink-outline',
  'admin.empresa_nueva':         'business-outline',
  'admin.suscripcion_vencimiento': 'alert-circle-outline',
  'trabajador_empresa.solicitud': 'person-add-outline',
  'trabajador_empresa.aprobado':  'checkmark-circle-outline',
  'trabajador_empresa.aceptada':  'checkmark-circle-outline',
  'trabajador_empresa.archivado_por_conversion': 'close-circle-outline',
  'trabajador_empresa.bienvenida_nomina': 'briefcase-outline',
  'invitacion_empresa':          'mail-outline',
  'invitacion_empresa_nomina':   'briefcase-outline',
  'nomina.ciclo_cambiado':        'sync-outline',
  'nomina.recordatorio_salida':   'time-outline',
};

function iconForTipo(tipo: string): React.ComponentProps<typeof Ionicons>['name'] {
  return TIPO_ICON[tipo] ?? 'notifications-outline';
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = diffMs / 3_600_000;
  if (diffH < 1)  return `${Math.max(1, Math.floor(diffMs / 60_000))}m`;
  if (diffH < 24) return `${Math.floor(diffH)}h`;
  if (diffH < 48) return 'ayer';
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

// Notificaciones dirigidas al gestor que igual traen asignacion_id — deben
// abrir la vista de gestión de la oferta (postulantes/asignaciones), no la
// vista del trabajador (marcar ingreso/egreso) que es a donde manda asignacion_id.
const TIPOS_GESTOR = new Set(['turno.ingreso', 'turno.egreso', 'postulacion.nueva']);

/**
 * Resuelve a dónde navegar al tocar una notificación. Se usa tanto para el
 * inbox in-app como para el tap de una push notification (ver app/_layout.tsx),
 * así que acepta cualquier objeto con `tipo` + `data` (el payload de Expo push
 * no trae los demás campos de `Notificacion`).
 */
export function destino(n: { tipo: string; data: unknown }): string | null {
  if (!n.data) return null;
  const d = n.data as Record<string, unknown>;
  if (TIPOS_GESTOR.has(n.tipo) && d.oferta_id) return `/oferta/${d.oferta_id}`;
  if (d.asignacion_id)   return `/turno/${d.asignacion_id}`;
  if (d.oferta_id)       return `/oferta/${d.oferta_id}`;
  // Invitación/conversión de empresa (trabajador-empresa.service.js: invitar,
  // aceptar) — solo traen empresa_id, no relacion_id, así que deben resolverse
  // antes del fallback de empresa_id de más abajo (ese es para super_admin).
  if (n.tipo === 'invitacion_empresa_nomina' || n.tipo === 'invitacion_empresa') return '/mis-empresas';
  if (n.tipo === 'trabajador_empresa.bienvenida_nomina') return '/(tabs)/nomina';
  // Solo presente en notificaciones dirigidas a super_admin (empresa_nueva,
  // pago_rechazado/integracion.desactivada duplicadas a super_admin, vencimiento).
  if (d.empresa_id)      return `/empresa/${d.empresa_id}`;
  if (d.ausencia_id)     return '/ausencias';
  if (d.periodo_id)      return '/(tabs)/nomina';
  if (d.registro_id)     return '/nomina-ingreso';
  if (d.compensatorio_id) return '/(tabs)/nomina';
  // 'reingreso.solicitado' va al gestor (que aprueba/rechaza en /reingresos-pendientes);
  // 'reingreso.aprobado'/'reingreso.rechazado' van al trabajador (que marca en /nomina-ingreso).
  if (d.solicitud_id && n.tipo === 'reingreso.solicitado') return '/reingresos-pendientes';
  if (d.solicitud_id && n.tipo.startsWith('reingreso.')) return '/nomina-ingreso';
  // Solicitud de vinculación trabajador↔empresa. 'trabajador_empresa.aprobado' va
  // al trabajador (ve su nueva empresa); 'solicitud'/'aceptada' van al gestor que
  // debe revisar/aprobar en /solicitudes.
  if (d.relacion_id && n.tipo === 'trabajador_empresa.aprobado') return '/mis-empresas';
  if (d.relacion_id) return '/solicitudes';
  return null;
}

// ── Componente ────────────────────────────────────────────────────────────

export default function NotificacionesScreen() {
  const router = useRouter();
  const theme  = useTheme();

  const { data, isLoading, isRefetching, refetch } = useNotificaciones();
  const { mutate: marcarLeida } = useMarcarLeida();
  const { mutate: marcarTodas, isPending: marcandoTodas } = useMarcarTodasLeidas();
  const [soloNoLeidas, setSoloNoLeidas] = useState(false);

  const todas = data?.data ?? [];
  const noLeidas = data?.no_leidas ?? 0;
  const notificaciones = soloNoLeidas ? todas.filter((n) => !n.leida) : todas;

  const handleTap = useCallback((n: Notificacion) => {
    if (!n.leida) marcarLeida(n.id);
    const ruta = destino(n);
    if (ruta) router.push(ruta as Parameters<typeof router.push>[0]);
  }, [marcarLeida, router]);

  const renderItem = ({ item }: { item: Notificacion }) => (
    <Pressable
      onPress={() => handleTap(item)}
      className={[
        'flex-row gap-3 px-5 py-3.5 border-b border-border active:opacity-70',
        item.leida ? 'bg-background' : 'bg-card',
      ].join(' ')}
      accessibilityRole="button"
    >
      {/* Icono del tipo */}
      <View
        className="w-9 h-9 rounded-full items-center justify-center shrink-0 mt-0.5"
        style={{ backgroundColor: item.leida ? '#E2E8F022' : theme.primary + '18' }}
      >
        <Ionicons
          name={iconForTipo(item.tipo)}
          size={18}
          color={item.leida ? '#94A3B8' : theme.primary}
        />
      </View>

      {/* Contenido */}
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-start justify-between gap-2">
          <Text
            className={`text-sm flex-1 leading-tight ${item.leida ? 'font-normal text-muted-foreground' : 'font-semibold text-foreground'}`}
            numberOfLines={2}
          >
            {item.titulo}
          </Text>
          <Text className="text-[10px] text-muted-foreground shrink-0">
            {fmtDate(item.created_at)}
          </Text>
        </View>
        <Text className="text-xs text-muted-foreground" numberOfLines={2}>
          {item.mensaje}
        </Text>
      </View>

      {/* Punto azul si no leída */}
      {!item.leida && (
        <View
          className="w-2 h-2 rounded-full self-center shrink-0"
          style={{ backgroundColor: theme.primary }}
        />
      )}
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="px-5 pt-4 pb-3 flex-row items-center justify-between border-b border-border">
        <View className="flex-row items-center gap-2">
          <Text className="text-xl font-bold text-foreground">Notificaciones</Text>
          {noLeidas > 0 && (
            <View className="bg-danger rounded-full px-1.5 py-0.5 min-w-[20px] items-center">
              <Text className="text-white text-[10px] font-bold">{noLeidas}</Text>
            </View>
          )}
        </View>
        {noLeidas > 0 && (
          <TouchableOpacity
            onPress={() => marcarTodas()}
            disabled={marcandoTodas}
            className="px-3 py-1.5 rounded-full border border-border active:opacity-70"
          >
            <Text className="text-xs font-semibold text-muted-foreground">
              {marcandoTodas ? 'Marcando…' : 'Marcar leídas'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filtro Todas / No leídas */}
      <View className="flex-row gap-2 px-5 py-3 border-b border-border">
        {([
          { key: false, label: 'Todas' },
          { key: true, label: 'No leídas' },
        ] as const).map((f) => {
          const active = soloNoLeidas === f.key;
          return (
            <TouchableOpacity
              key={String(f.key)}
              onPress={() => setSoloNoLeidas(f.key)}
              className={`px-3 py-1.5 rounded-full border ${active ? 'border-transparent' : 'border-border'}`}
              style={active ? { backgroundColor: theme.primary } : undefined}
            >
              <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-muted-foreground'}`}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={notificaciones}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center gap-3 py-20 px-8">
              <Ionicons name="notifications-off-outline" size={48} color="#94A3B8" />
              <Text className="text-base font-semibold text-foreground text-center">
                Sin notificaciones
              </Text>
              <Text className="text-sm text-muted-foreground text-center">
                Aquí aparecerán confirmaciones de turnos, cambios de período y más.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
