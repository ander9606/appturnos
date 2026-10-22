import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { showAlert } from '@/lib/alertDialog';
import { confirm } from '@/lib/confirmDialog';
import { actionSheet } from '@/lib/actionSheet';
import { showToast } from '@/lib/toast';
import { showAnuncioTurno } from '@/lib/anuncioTurno';
import { useCancelarOferta, useMarcarOfertaFallida, useCompletarOferta } from '@/features/turnos/useTurnos';
import { ApiError } from '@api-client';
import type { OfertaDetalle } from '@api-client';
import { TurnoFallidoModal } from './TurnoFallidoModal';

/**
 * Barra de acciones fija del gestor (completar, cancelar, turno fallido) — siempre en la zona inferior,
 * separada del contenido scrolleable para que no se pierda entre el resto de cards.
 */
export function BarraAccionesGestor({ oferta, puedeGestionar, puedeCancelarOferta, turnoIniciado }: {
  oferta: OfertaDetalle;
  puedeGestionar: boolean;
  puedeCancelarOferta: boolean;
  turnoIniciado: boolean;
}) {
  const router = useRouter();
  const cancelarOfertaM  = useCancelarOferta();
  const marcarFallidaM   = useMarcarOfertaFallida();
  const completarOfertaM = useCompletarOferta();
  const [showFallidoModal, setShowFallidoModal] = useState(false);

  // Condiciones de la barra de acciones fija (gestor) — mismas reglas de antes,
  // solo que ahora deciden si esa barra se muestra en vez de un botón inline.
  const mostrarCompletar = puedeGestionar && turnoIniciado
    && oferta.estado !== 'completada' && oferta.estado !== 'cancelada' && oferta.estado !== 'borrador';
  const mostrarCancelarOferta = puedeCancelarOferta
    && oferta.estado !== 'cancelada' && oferta.estado !== 'completada';
  const hayEnProgreso = oferta.asignaciones.some((a) => a.estado === 'en_progreso');
  // Turno fallido solo tiene sentido si hay alguien ya marcó ingreso para
  // compensar — sin eso es exactamente "Cancelar oferta".
  const mostrarTurnoFallido = mostrarCancelarOferta && hayEnProgreso;

  async function ejecutarCompletar(capearHoras: boolean) {
    try {
      const data = await completarOfertaM.mutateAsync({ ofertaId: oferta.id, capearHoras });
      const n = data.no_presentados_al_completar ?? 0;
      const f = data.forzados_al_completar ?? 0;
      const avisos: string[] = [];
      if (f > 0) {
        const horario = data.forzados_con_hora_actual ? 'con la hora actual' : 'con el horario estipulado';
        avisos.push(`${f} trabajador${f > 1 ? 'es' : ''} que no había${f > 1 ? 'n' : ''} marcado salida se cerró${f > 1 ? 'aron' : ''} ${horario}`);
      }
      if (n > 0) avisos.push(`${n} trabajador${n > 1 ? 'es' : ''} sin ingreso quedó${n > 1 ? 'aron' : ''} como no presentado${n > 1 ? 's' : ''}`);
      showToast(
        avisos.length > 0
          ? `"${oferta.titulo}" completado. ${avisos.join('; ')}.`
          : `"${oferta.titulo}" marcado como completado.`
      );
    } catch (err) {
      showAlert('Error', err instanceof ApiError ? err.message : 'No se pudo completar la oferta.');
    }
  }

  return (
    <>
      {(mostrarCompletar || mostrarCancelarOferta || mostrarTurnoFallido) && (
        <View className="px-5 pt-3 pb-3 gap-2 border-t border-border bg-background">
          {mostrarCompletar && (
            <Button
              label={completarOfertaM.isPending ? 'Marcando…' : 'Marcar completada'}
              variant="successOutline"
              fullWidth
              loading={completarOfertaM.isPending}
              onPress={async () => {
                const hayEnProgreso = oferta.asignaciones.some((a) => a.estado === 'en_progreso');

                if (hayEnProgreso) {
                  const eleccion = await actionSheet({
                    title: 'Hay trabajadores sin marcar salida',
                    message: 'Si el turno ya lleva más de 2 días sin resolver, esto los cerrará automáticamente. ¿Cómo calculamos sus horas?',
                    items: [
                      { key: 'estipulado', label: 'Horario estipulado' },
                      { key: 'ahora', label: 'Cerrar ahora' },
                    ],
                  });
                  if (eleccion) ejecutarCompletar(eleccion === 'estipulado');
                  return;
                }

                const ok = await confirm({
                  title: 'Marcar como completada',
                  message: 'Úsalo cuando el turno ya terminó en la realidad.',
                  cancelLabel: 'Volver',
                  confirmLabel: 'Marcar completada',
                });
                if (ok) ejecutarCompletar(true);
              }}
            />
          )}

          {mostrarCancelarOferta && (
            <Button
              label={cancelarOfertaM.isPending ? 'Cancelando…' : 'Cancelar oferta'}
              variant="danger"
              fullWidth
              loading={cancelarOfertaM.isPending}
              onPress={async () => {
                const ok = await confirm({
                  title: 'Cancelar oferta',
                  message: `Se cancelará "${oferta.titulo}" y se notificará a los trabajadores postulados o asignados. Esta acción no se puede deshacer.`,
                  cancelLabel: 'Volver',
                  confirmLabel: 'Cancelar oferta',
                  destructive: true,
                });
                if (!ok) return;
                try {
                  await cancelarOfertaM.mutateAsync(oferta.id);
                  showAnuncioTurno(`"${oferta.titulo}" cancelado.`, 'cancelado');
                  router.back();
                } catch (err) {
                  showAlert('Error', err instanceof ApiError ? err.message : 'No se pudo cancelar la oferta.');
                }
              }}
            />
          )}

          {mostrarTurnoFallido && (
            <Button
              label="Turno fallido (fuerza mayor)"
              variant="secondary"
              fullWidth
              onPress={() => setShowFallidoModal(true)}
            />
          )}
        </View>
      )}

      <TurnoFallidoModal
        visible={showFallidoModal}
        oferta={oferta}
        marcarFallidaM={marcarFallidaM}
        onClose={() => setShowFallidoModal(false)}
        onDone={() => {
          setShowFallidoModal(false);
          showAnuncioTurno(`"${oferta.titulo}" marcado como fallido.`, 'cancelado');
          router.back();
        }}
      />
    </>
  );
}
