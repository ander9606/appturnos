/**
 * Pantalla de inbox de notificaciones.
 * Accesible desde la campana del header en cualquier tab.
 */

import React, { useCallback, useMemo, useState } from 'react';
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
import { destino } from '@/features/notificaciones/destino';
import { useTheme } from '@/lib/theme';
import { THEME_COLORS, COLORS } from '@/lib/designTokens';
import type { Notificacion } from '@api-client';

// ── Helpers ───────────────────────────────────────────────────────────────

const TIPO_ICON: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  'postulacion.confirmada':      'checkmark-circle-outline',
  'asignacion.cancelada':        'close-circle-outline',
  'postulacion.rechazada':       'close-circle-outline',
  'turno.ingreso':               'log-in-outline',
  'turno.egreso':                'log-out-outline',
  'turno.cerrado_gestor':        'checkmark-done-outline',
  'turno.no_presentado_gestor':  'alert-circle-outline',
  'calificacion.recibida':       'star-outline',
  'asignacion.no_presentado':    'alert-circle-outline',
  'nomina.entrada':              'log-in-outline',
  'nomina.salida':               'log-out-outline',
  'nomina.periodo_abierto':      'folder-open-outline',
  'nomina.periodo_liquidado':    'cash-outline',
  'cuenta_cobro.pendiente_firma': 'document-text-outline',
  'nomina.sospechoso':           'alert-circle-outline',
  'oferta.creada':               'add-circle-outline',
  'oferta.nueva':                'megaphone-outline',
  'oferta.modificada':           'create-outline',
  'asignacion.reconfirmacion_rechazada': 'alert-circle-outline',
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
  'nomina.recordatorio_ingreso':  'time-outline',
  'nomina.horas_extra_iniciadas': 'time-outline',
  'nomina.compensatorios_hoy':    'sunny-outline',
  'nomina.descuento_pendiente':   'card-outline',
  'nomina.descuento_respondido':  'card-outline',
  'nomina.correccion':            'create-outline',
  'asignacion.correccion':        'create-outline',
  'contrato.pendiente_firma':     'document-text-outline',
  'postulacion.nueva':            'person-add-outline',
  'turno.sospechoso':             'alert-circle-outline',
  'turno.bono':                   'gift-outline',
};

function iconForTipo(tipo: string): React.ComponentProps<typeof Ionicons>['name'] {
  return TIPO_ICON[tipo] ?? 'notifications-outline';
}

// Clasifica por módulo usando el prefijo de `tipo` — así un gestor con
// trabajadores tanto de turnos como de nómina puede separar el feed en vez
// de tener que leer todo mezclado para encontrar lo que le interesa.
type Categoria = 'todas' | 'turnos' | 'nomina' | 'general';

function categoriaDeTipo(tipo: string): Exclude<Categoria, 'todas'> {
  if (tipo.startsWith('nomina.') || tipo.startsWith('reingreso.') || tipo === 'trabajador_empresa.bienvenida_nomina') {
    return 'nomina';
  }
  if (
    tipo.startsWith('turno.') || tipo.startsWith('asignacion.') || tipo.startsWith('postulacion.') ||
    tipo.startsWith('oferta.') || tipo === 'novedad_turno' || tipo === 'contrato.pendiente_firma' ||
    tipo === 'calificacion.recibida' || tipo === 'cuenta_cobro.pendiente_firma'
  ) {
    return 'turnos';
  }
  // Empresa/suscripción/integración/ausencias — cruzan ambos módulos o son
  // de nivel empresa, no de un trabajador de turnos o nómina en particular.
  return 'general';
}

const CATEGORIA_LABEL: Record<Categoria, string> = {
  todas: 'Todas', turnos: 'Turnos', nomina: 'Nómina', general: 'General',
};

// Mismos colores que el resto de la app usa para turnos/nómina (ver
// TrabajadorCard/THEME_COLORS) — 'general' no tiene un rol propio, así que
// usa el azul info ya reservado para gestores/neutro.
function colorDeCategoria(categoria: Exclude<Categoria, 'todas'>): string {
  if (categoria === 'turnos') return THEME_COLORS.turnos.primary;
  if (categoria === 'nomina') return THEME_COLORS.nomina.primary;
  return COLORS.info;
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

// ── Componente ────────────────────────────────────────────────────────────

export default function NotificacionesScreen() {
  const router = useRouter();
  const theme  = useTheme();

  const { data, isLoading, isRefetching, refetch } = useNotificaciones();
  const { mutate: marcarLeida } = useMarcarLeida();
  const { mutate: marcarTodas, isPending: marcandoTodas } = useMarcarTodasLeidas();
  const [soloNoLeidas, setSoloNoLeidas] = useState(false);
  const [categoria, setCategoria] = useState<Categoria>('todas');

  const todas = data?.data ?? [];
  const noLeidas = data?.no_leidas ?? 0;

  // Solo se muestra el filtro de categoría si hay más de una presente —
  // evita chips vacíos para un trabajador que solo recibe notificaciones
  // de un módulo (turnos o nómina, nunca ambos).
  const categoriasPresentes = useMemo(() => {
    const set = new Set<Categoria>();
    todas.forEach((n) => set.add(categoriaDeTipo(n.tipo)));
    return set;
  }, [todas]);
  const mostrarFiltroCategoria = categoriasPresentes.size > 1;

  const notificaciones = todas
    .filter((n) => !soloNoLeidas || !n.leida)
    .filter((n) => categoria === 'todas' || categoriaDeTipo(n.tipo) === categoria);

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
      {/* Icono del tipo — coloreado por módulo (turnos/nómina/general) */}
      <View
        className="w-9 h-9 rounded-full items-center justify-center shrink-0 mt-0.5"
        style={{ backgroundColor: item.leida ? '#E2E8F022' : colorDeCategoria(categoriaDeTipo(item.tipo)) + '18' }}
      >
        <Ionicons
          name={iconForTipo(item.tipo)}
          size={18}
          color={item.leida ? '#94A3B8' : colorDeCategoria(categoriaDeTipo(item.tipo))}
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

      {/* Filtro por módulo — solo si el feed mezcla más de uno */}
      {mostrarFiltroCategoria && (
        <View className="flex-row gap-2 px-5 py-3 border-b border-border">
          {(['todas', 'turnos', 'nomina', 'general'] as const)
            .filter((c) => c === 'todas' || categoriasPresentes.has(c))
            .map((c) => {
              const active = categoria === c;
              const color = c === 'todas' ? theme.primary : colorDeCategoria(c);
              return (
                <TouchableOpacity
                  key={c}
                  onPress={() => setCategoria(c)}
                  className="px-3 py-1.5 rounded-full"
                  style={{ backgroundColor: active ? color : color + '18' }}
                >
                  <Text className="text-xs font-semibold" style={{ color: active ? '#FFFFFF' : color }}>
                    {CATEGORIA_LABEL[c]}
                  </Text>
                </TouchableOpacity>
              );
            })}
        </View>
      )}

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
