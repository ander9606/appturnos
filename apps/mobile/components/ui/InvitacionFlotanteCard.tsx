import { useState } from 'react';
import { Modal, View, Text, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useInvitacionFlotanteStore } from '@/lib/invitacionFlotante';
import { useAceptar, useRechazarVinculo } from '@/features/empresas/useTrabajadorEmpresa';
import { CambiosNominaList } from '@/features/empresas/CambiosNomina';
import { showToast } from '@/lib/toast';
import { Button } from './Button';

/**
 * Tarjeta flotante e invasiva para una invitación de empresa — a diferencia
 * del inbox de notificaciones o "Mis empresas" (que el trabajador puede
 * ignorar), esta interrumpe con la decisión completa (qué cambia + aceptar/
 * rechazar) ahí mismo. Se cierra solo cuando el trabajador decide: no hay
 * tap-fuera-para-cerrar ni botón "más tarde" — así no se pierde entre la
 * campana de notificaciones. Montada una vez en el root layout; ver
 * lib/invitacionFlotante.ts para dispararla.
 */
export function InvitacionFlotanteCard() {
  const vinculo = useInvitacionFlotanteStore((s) => s.vinculo);
  const hide = useInvitacionFlotanteStore((s) => s.hide);
  const aceptar = useAceptar();
  const rechazar = useRechazarVinculo();
  const [accion, setAccion] = useState<'aceptar' | 'rechazar' | null>(null);

  if (!vinculo) return null;
  const esNomina = vinculo.tipo_ofrecido === 'nomina';

  async function handleAceptar() {
    if (!vinculo) return;
    setAccion('aceptar');
    try {
      await aceptar.mutateAsync(vinculo.id);
      hide();
      showToast(
        esNomina
          ? `Ya eres parte de la nómina de ${vinculo.empresa_nombre}.`
          : `Te uniste al equipo de ${vinculo.empresa_nombre}.`
      );
    } catch {
      Alert.alert('Error', 'No se pudo aceptar la invitación. Intenta de nuevo.');
    } finally {
      setAccion(null);
    }
  }

  async function handleRechazar() {
    if (!vinculo) return;
    setAccion('rechazar');
    try {
      await rechazar.mutateAsync({ id: vinculo.id });
      hide();
    } catch {
      Alert.alert('Error', 'No se pudo rechazar la invitación. Intenta de nuevo.');
    } finally {
      setAccion(null);
    }
  }

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => {}}>
      <View className="flex-1 bg-black/50 items-center justify-center px-6">
        <View
          className={`bg-card w-full max-w-sm rounded-2xl overflow-hidden border ${
            esNomina ? 'border-warning/50' : 'border-primary-200'
          }`}
        >
          <View className="flex-row items-center gap-3 px-5 pt-5 pb-3">
            <View className={`w-11 h-11 rounded-xl items-center justify-center ${esNomina ? 'bg-warning/10' : 'bg-primary-50'}`}>
              <Ionicons name={esNomina ? 'briefcase' : 'mail'} size={20} color={esNomina ? '#D97706' : '#FF5A3C'} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-foreground">{vinculo.empresa_nombre}</Text>
              <Text className="text-xs text-muted-foreground">
                {esNomina ? 'Te invita a su nómina' : 'Te invita a su equipo de turnos'}
              </Text>
            </View>
          </View>

          {esNomina ? (
            <View className="mx-5 mb-4 bg-warning/10 rounded-xl p-3 gap-2">
              <Text className="text-[11px] font-semibold text-warning uppercase tracking-wide">Qué cambia si aceptas</Text>
              <CambiosNominaList />
            </View>
          ) : (
            <Text className="mx-5 mb-4 text-sm text-muted-foreground">
              Si aceptas, podrás recibir y tomar sus ofertas de turnos.
            </Text>
          )}

          <View className="flex-row gap-2 px-5 pb-5">
            <View className="flex-1">
              <Button
                label="Rechazar"
                variant="secondary"
                fullWidth
                loading={accion === 'rechazar'}
                disabled={accion !== null}
                onPress={handleRechazar}
              />
            </View>
            <View className="flex-1">
              <Button
                label="Aceptar"
                variant="primary"
                fullWidth
                loading={accion === 'aceptar'}
                disabled={accion !== null}
                onPress={handleAceptar}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
