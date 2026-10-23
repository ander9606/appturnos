import { showAlert } from '@/lib/alertDialog';
import { confirm } from '@/lib/confirmDialog';
import { showToast } from '@/lib/toast';
import { useActualizarTrabajador } from '@/features/equipo/useEquipo';
import { useInvitar } from '@/features/empresas/useTrabajadorEmpresa';
import type { TrabajadorFormValues } from '@/features/equipo/schemas';
import { ApiError } from '@api-client';
import type { Trabajador } from '@api-client';
import { CAMPOS_JEFE, CAMPOS_JEFE_TURNOS, filtrarCampos } from './fichaTrabajador';

/** Guarda la ficha editada; si pasa de turnos/ambos a nómina, además invita al trabajador. */
export function useGuardarFicha(numId: number, t: Trabajador | undefined, isAdmin: boolean, onGuardado: () => void) {
  const actualizar = useActualizarTrabajador(numId);
  const invitar    = useInvitar();

  return async function handleUpdate(rawData: TrabajadorFormValues) {
    // `handleUpdate` solo se invoca desde el form de edición, que ya requiere
    // `t` cargado (ver el `if (isError || !t) return ...` de la pantalla) — este
    // guard es solo para que TS lo sepa acá también.
    if (!t) return;

    // turnos/ambos → nómina no se guarda directo desde acá: nómina ata la
    // cuenta a esta empresa en exclusiva, así que el trabajador debe aceptar
    // o rechazar (igual que "Invitar trabajador"). Enviamos la invitación con
    // la cédula que ya está en la ficha en vez de mandar al gestor a buscarla
    // de nuevo en otra pantalla.
    const pasaANomina = t.tipo !== 'nomina' && rawData.tipo === 'nomina';
    let data = rawData;
    let invitacionEnviada = false;

    if (pasaANomina) {
      if (!rawData.cedula) {
        showAlert(
          'Falta la cédula',
          'Este trabajador no tiene cédula registrada. Agrégala y guarda antes de invitarlo a nómina.'
        , 'warning');
        return;
      }
      const ok = await confirm({
        title: 'Enviar solicitud de nómina',
        message:
          `Nómina implica exclusividad: si ${rawData.nombre} acepta, dejará de estar disponible para turnos en ` +
          'otras empresas (sus demás vínculos se archivan automáticamente). No se convierte de inmediato — se le ' +
          'envía la solicitud y debe aceptarla o rechazarla desde su cuenta.',
        confirmLabel: 'Enviar solicitud',
      });
      if (!ok) return;

      // tipo se manda sin cambios porque la conversión la resuelve la invitación
      // cuando el trabajador la acepte, no este formulario.
      data = { ...rawData, tipo: t.tipo };
    }

    try {
      const payload = {
        nombre:       data.nombre,
        apellido:     data.apellido,
        tipo:         data.tipo,
        cedula:       data.cedula   || undefined,
        tipo_documento: (data.tipo_documento as 'CC' | 'CE' | 'PAS') || undefined,
        fecha_nacimiento: data.fecha_nacimiento || undefined,
        sexo:         (data.sexo as 'M' | 'F' | 'otro') || undefined,
        email:        data.email    || undefined,
        telefono:     data.telefono || undefined,
        direccion:    data.direccion || undefined,
        contacto_emergencia_nombre: data.contacto_emergencia_nombre || undefined,
        contacto_emergencia_tel:    data.contacto_emergencia_tel    || undefined,
        cargo:        data.cargo    || undefined,
        tarifa_hora:  data.tarifa_hora,
        salario_base: data.salario_base,
        hora_entrada_esperada: data.hora_entrada_esperada || undefined,
        eps:          data.eps          || undefined,
        afp:          data.afp          || undefined,
        banco:        data.banco        || undefined,
        tipo_cuenta:  (data.tipo_cuenta as 'ahorros' | 'corriente') || undefined,
        numero_cuenta: data.numero_cuenta || undefined,
        ant_judiciales_fecha:     data.ant_judiciales_fecha     || undefined,
        ant_disciplinarios_fecha: data.ant_disciplinarios_fecha || undefined,
      };
      await actualizar.mutateAsync(isAdmin ? payload : filtrarCampos(payload, t.tipo === 'turnos' ? CAMPOS_JEFE_TURNOS : CAMPOS_JEFE));
      if (pasaANomina && rawData.cedula) {
        // Invitar DESPUÉS de guardar: invitar() busca la ficha por cédula en la
        // BD, y si la cédula nueva aún no está persistida crea una ficha fantasma.
        try {
          await invitar.mutateAsync({ cedula: rawData.cedula, tipo: 'nomina' });
          invitacionEnviada = true;
        } catch (err: unknown) {
          const msg = err instanceof ApiError ? err.message : 'No se pudo enviar la invitación.';
          showAlert('Error', msg);
        }
      }
      onGuardado();
      showToast(
        invitacionEnviada
          ? 'Solicitud de nómina enviada. El trabajador debe aceptarla desde su cuenta.'
          : 'Los datos del trabajador fueron actualizados.'
      );
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : 'Ocurrió un error al guardar.';
      showAlert('Error', msg);
    }
  };
}
