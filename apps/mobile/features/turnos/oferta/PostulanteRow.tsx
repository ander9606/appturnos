import { Text } from '@/components/ui/Text';
import { COLORS } from '@/lib/designTokens';
import { View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { confirm } from '@/lib/confirmDialog';
import { showAnuncioTurno } from '@/lib/anuncioTurno';
import { useConfirmar, useRechazar, useCancelar, useNoPresentado } from '@/features/turnos/useTurnos';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { AsignacionResumen, EstadoAsignacion } from '@api-client';

type BadgeVariant = 'warning' | 'success' | 'info' | 'default' | 'danger';

const ESTADO_CFG: Record<EstadoAsignacion, { label: string; variant: BadgeVariant }> = {
  pendiente:     { label: 'Pendiente',      variant: 'warning' },
  confirmado:    { label: 'Confirmado',     variant: 'success' },
  en_progreso:   { label: 'En progreso',    variant: 'info'    },
  completado:    { label: 'Completado',     variant: 'default' },
  no_presentado: { label: 'No se presentó', variant: 'danger'  },
  cancelado:     { label: 'Cancelado',      variant: 'danger'  },
  por_reconfirmar: { label: 'Por reconfirmar', variant: 'warning' },
  fallido:       { label: 'Turno fallido',  variant: 'warning' },
};

// ── PostulanteRow (gestores) ──────────────────────────────────────────────

export function PostulanteRow({
  asignacion, ofertaId, esPasado, turnoIniciado, puedeGestionar,
  confirmarM, rechazarM, cancelarM, noPresentadoM,
}: {
  asignacion:    AsignacionResumen;
  ofertaId:      number;
  esPasado:      boolean;
  turnoIniciado: boolean;
  puedeGestionar: boolean;
  confirmarM:    ReturnType<typeof useConfirmar>;
  rechazarM:     ReturnType<typeof useRechazar>;
  cancelarM:     ReturnType<typeof useCancelar>;
  noPresentadoM: ReturnType<typeof useNoPresentado>;
}) {
  const router    = useRouter();
  // Fallback a 'pendiente' — un bundle viejo durante un rollout OTA gradual
  // puede ver un estado que todavía no conoce (ej. 'fallido' recién agregado).
  const cfg       = ESTADO_CFG[asignacion.estado] ?? ESTADO_CFG.pendiente;
  const isPending = asignacion.estado === 'pendiente';
  const isConf    = asignacion.estado === 'confirmado';
  const isEnProg  = asignacion.estado === 'en_progreso';
  const isCompletado = asignacion.estado === 'completado';
  const isPorReconfirmar = asignacion.estado === 'por_reconfirmar';
  const isBusy    = confirmarM.isPending || rechazarM.isPending || cancelarM.isPending || noPresentadoM.isPending;
  const nombre    = `${asignacion.trabajador_nombre} ${asignacion.trabajador_apellido}`;

  return (
    <View className="py-2.5 border-b border-border gap-2">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 mr-3">
          <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
            {nombre}
          </Text>
          {asignacion.cargo_nombre && (
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {asignacion.cargo_nombre}
            </Text>
          )}
        </View>
        <Badge label={cfg.label} variant={cfg.variant} size="sm" />
      </View>

      {puedeGestionar && (esPasado ? (
        (isConf || isEnProg) ? (
          <Button label={noPresentadoM.isPending ? '…' : 'No vino'} variant="danger" size="sm"
            loading={noPresentadoM.isPending} disabled={isBusy}
            onPress={async () => {
              if (await confirm({ title: 'No se presentó', message: `¿Marcar a ${nombre} como no presentado?`, confirmLabel: 'Marcar ausente', destructive: true })) {
                noPresentadoM.mutate({ asignacionId: asignacion.id, ofertaId });
              }
            }} />
        ) : isPending ? (
          <Button label={rechazarM.isPending ? '…' : 'Rechazar'} variant="danger" size="sm"
            loading={rechazarM.isPending} disabled={isBusy}
            onPress={async () => {
              if (await confirm({ title: 'Rechazar', message: `¿Rechazar a ${nombre}?`, confirmLabel: 'Rechazar', destructive: true })) {
                rechazarM.mutate({ asignacionId: asignacion.id, ofertaId });
              }
            }} />
        ) : null
      ) : (
        <>
          {isPending && (
            <View className="flex-row gap-2">
              <Button label={rechazarM.isPending ? '…' : 'Rechazar'} variant="danger" size="sm"
                loading={rechazarM.isPending} disabled={isBusy}
                onPress={async () => {
                  if (await confirm({ title: 'Rechazar', message: `¿Rechazar a ${nombre}?`, confirmLabel: 'Rechazar', destructive: true })) {
                    rechazarM.mutate({ asignacionId: asignacion.id, ofertaId });
                  }
                }} />
              <Button label={confirmarM.isPending ? '…' : 'Confirmar'} variant="success" size="sm"
                loading={confirmarM.isPending} disabled={isBusy}
                onPress={() => confirmarM.mutate({ asignacionId: asignacion.id, ofertaId })} />
            </View>
          )}
          {isConf && (
            <View className="flex-row items-center gap-2 flex-wrap">
              <View className="flex-row items-center gap-1 bg-success-light px-3 py-1.5 rounded-xl">
                <Ionicons name="checkmark-circle" size={14} color={COLORS.success} />
                <Text className="text-xs font-semibold text-success">Aceptado</Text>
              </View>
              <Button label={cancelarM.isPending ? '…' : 'Cancelar'} variant="danger" size="sm"
                loading={cancelarM.isPending} disabled={isBusy}
                onPress={async () => {
                  if (await confirm({ title: 'Cancelar turno', message: `¿Cancelar el turno de ${nombre}?`, cancelLabel: 'Volver', confirmLabel: 'Cancelar turno', destructive: true })) {
                    cancelarM.mutate(
                      { asignacionId: asignacion.id, ofertaId },
                      { onSuccess: () => showAnuncioTurno(`Turno de ${nombre} cancelado.`, 'cancelado') }
                    );
                  }
                }} />
              {turnoIniciado && (
                <Button label={noPresentadoM.isPending ? '…' : 'No vino'} variant="danger" size="sm"
                  loading={noPresentadoM.isPending} disabled={isBusy}
                  onPress={async () => {
                    if (await confirm({ title: 'No se presentó', message: `¿Marcar a ${nombre} como no presentado?`, confirmLabel: 'Marcar ausente', destructive: true })) {
                      noPresentadoM.mutate({ asignacionId: asignacion.id, ofertaId });
                    }
                  }} />
              )}
            </View>
          )}
          {isEnProg && (
            <View className="flex-row items-center gap-1 bg-info/10 px-3 py-1.5 rounded-xl self-start">
              <Ionicons name="time-outline" size={14} color={COLORS.info} />
              <Text className="text-xs font-semibold text-info">En turno</Text>
            </View>
          )}
          {isPorReconfirmar && (
            <View className="flex-row items-center gap-1 bg-warning-light px-3 py-1.5 rounded-xl self-start">
              <Ionicons name="alert-circle-outline" size={14} color={COLORS.warningText} />
              <Text className="text-xs font-semibold text-warning">Esperando que reconfirme</Text>
            </View>
          )}
        </>
      ))}

      {/* Ver detalle del turno — ahí se corrige ingreso/egreso y se agrega el
          bono, disponible incluso con esPasado (arreglar una salida que el
          trabajador olvidó marcar). */}
      {(isConf || isEnProg || isCompletado || isPorReconfirmar) && (
        <TouchableOpacity
          onPress={() => router.push(`/turno/${asignacion.id}`)}
          className="flex-row items-center gap-1 self-start"
          hitSlop={6}
        >
          <Ionicons name="chevron-forward-circle-outline" size={13} color={COLORS.mutedForeground} />
          <Text className="text-xs font-semibold text-muted-foreground">Ver detalle</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
