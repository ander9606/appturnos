'use strict';

const DescuentosTurnoModel = require('./descuentos-turno.model');
const AsignacionesModel = require('../asignaciones/asignaciones.consultas.model');
const ContratosModel = require('../../contratos/contratos.model');
const CuentasCobroModel = require('../../cuentas-cobro/cuentas-cobro.model');
const CuentasCobroService = require('../../cuentas-cobro/cuentas-cobro.service');
const NotificacionesService = require('../../notificaciones/notificaciones.service');
const AppError = require('../../../utils/AppError');
const { ROLES, DESCUENTO_TURNO_TOPE_DIARIO_DIVISOR } = require('../../../config/constants');

const GESTORES = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_TURNOS, ROLES.JEFE_NOMINA];

const money = (n) => `$${Number(n).toLocaleString('es-CO')}`;

/** Tope en pesos enteros: quinta parte de la tarifa del día (CST art. 113). */
function topeDescuentoTurno(tarifaDia) {
  return Math.floor(Number(tarifaDia) / DESCUENTO_TURNO_TOPE_DIARIO_DIVISOR);
}

/** Mensaje para el gestor: explica la ley y cuánto le queda disponible en el turno. */
function errorTope({ tarifaDia, tope, comprometido, monto }) {
  const disponible = Math.max(0, tope - comprometido);
  return new AppError(
    `No se puede descontar ${money(monto)} de este turno. La ley (art. 113 del Código Sustantivo ` +
    `del Trabajo) solo permite descontar hasta la quinta parte del salario de un día. Con la tarifa ` +
    `de este turno (${money(tarifaDia)}), el máximo es ${money(tope)} y ya hay ${money(comprometido)} ` +
    `descontado o pendiente de aceptación. Disponible: ${money(disponible)}.`,
    409
  );
}

async function cargarAsignacion(empresaId, asignacionId) {
  const asignacion = await AsignacionesModel.obtenerConDetalles(empresaId, asignacionId);
  if (!asignacion) throw new AppError('Asignación no encontrada', 404);
  return asignacion;
}

/** Un gestor ve las asignaciones de su empresa; un trabajador solo las suyas. */
function verificarAcceso(asignacion, usuario) {
  if (GESTORES.includes(usuario.rol)) return;
  if (asignacion.usuario_id !== usuario.sub) throw new AppError('No autorizado', 403);
}

/**
 * Cuenta de cobro que cubre el turno. Si ya está firmada, el pago quedó fijado
 * con lo que el trabajador firmó: los descuentos no se mueven después.
 */
async function exigirCuentaSinFirmar(asignacion) {
  const cuenta = await CuentasCobroModel.obtenerPorOfertaYTrabajador(
    asignacion.empresa_id, asignacion.oferta_id, asignacion.trabajador_id
  );
  if (cuenta?.firmado_trabajador) {
    throw new AppError('La cuenta de cobro de este turno ya fue firmada, sus descuentos no se pueden cambiar', 409);
  }
  return cuenta;
}

/** Si hay cuenta sin firmar, la regenera solo para este trabajador (sin volver a avisarle). */
async function refrescarCuenta(asignacion, cuenta) {
  if (!cuenta) return;
  await CuentasCobroService.generarParaPeriodo(asignacion.empresa_id, cuenta.periodo_id, {
    trabajadorId: asignacion.trabajador_id,
    notificar: false,
  });
}

/**
 * Un descuento aceptado cambia lo que el contrato dice que se paga: si el contrato
 * ya estaba firmado, se reinicia la firma y el trabajador firma otra vez (mismo
 * criterio que el bono). Devuelve true si hubo que reiniciarla.
 */
async function reiniciarFirmaContrato(asignacion) {
  if (!asignacion.contrato_firmado) return false;
  const contrato = await ContratosModel.obtenerPorAsignacion(asignacion.empresa_id, asignacion.id);
  if (!contrato) return false;
  await ContratosModel.resetearFirma(asignacion.empresa_id, contrato.id);
  return true;
}

const DescuentosTurnoService = {
  /** Descuentos del turno, con el tope y lo ya comprometido para mostrarlos al gestor. */
  async listarPorAsignacion(empresaId, asignacionId, usuario) {
    const asignacion = await cargarAsignacion(empresaId, asignacionId);
    verificarAcceso(asignacion, usuario);
    return {
      descuentos: await DescuentosTurnoModel.listarPorAsignacion(asignacion.empresa_id, asignacionId),
      tarifa_dia: Number(asignacion.tarifa_dia),
      tope_cop: topeDescuentoTurno(asignacion.tarifa_dia),
      comprometido_cop: await DescuentosTurnoModel.sumaComprometida(asignacion.empresa_id, asignacionId),
    };
  },

  /** El gestor registra el descuento: queda pendiente hasta que el trabajador lo acepte. */
  async crear(empresaId, usuarioGestorId, asignacionId, { monto, motivo }) {
    const asignacion = await cargarAsignacion(empresaId, asignacionId);
    if (asignacion.estado !== 'completado') {
      throw new AppError('Solo se pueden descontar turnos completados', 409);
    }
    // El turno eventual de un trabajador de nómina se paga en el segmento de nómina, no acá.
    if (asignacion.trabajador_tipo === 'nomina') {
      throw new AppError('Los turnos eventuales de trabajadores de nómina se descuentan en nómina', 409);
    }

    await exigirCuentaSinFirmar(asignacion);

    const tope = topeDescuentoTurno(asignacion.tarifa_dia);
    const comprometido = await DescuentosTurnoModel.sumaComprometida(asignacion.empresa_id, asignacionId);
    if (Math.round((comprometido + monto) * 100) > tope * 100) {
      throw errorTope({ tarifaDia: asignacion.tarifa_dia, tope, comprometido, monto });
    }

    const id = await DescuentosTurnoModel.crear(asignacion.empresa_id, {
      asignacionId,
      trabajadorId: asignacion.trabajador_id,
      monto,
      motivo,
      creadoPor: usuarioGestorId,
    });

    if (asignacion.usuario_id) {
      await NotificacionesService.notificar({
        empresaId: asignacion.empresa_id,
        usuarioId: asignacion.usuario_id,
        tipo: 'turno.descuento_pendiente',
        titulo: 'Tienes un descuento por aceptar',
        mensaje: `Tu empresa registró un descuento de ${money(monto)} por: ${motivo}. Revísalo y acéptalo o recházalo.`,
        data: { descuento_id: id, asignacion_id: asignacionId },
      }).catch(() => {});
    }

    return DescuentosTurnoModel.obtenerPorId(asignacion.empresa_id, id);
  },

  /**
   * El trabajador dueño del turno acepta o rechaza. Solo los aceptados descuentan.
   * Al aceptar, si el contrato ya estaba firmado, hay que firmarlo otra vez:
   * la respuesta trae `requiere_nueva_firma` para avisarle en la app.
   */
  async responder(usuario, descuentoId, aceptar) {
    const descuento = await DescuentosTurnoModel.obtenerPorId(null, descuentoId);
    if (!descuento) throw new AppError('Descuento no encontrado', 404);
    if (descuento.trabajador_usuario_id !== usuario.sub) throw new AppError('No autorizado', 403);
    if (descuento.estado !== 'pendiente') throw new AppError('Este descuento ya fue respondido', 409);

    const asignacion = await cargarAsignacion(descuento.empresa_id, descuento.asignacion_id);
    const cuenta = await exigirCuentaSinFirmar(asignacion);

    const filas = await DescuentosTurnoModel.responder(
      descuento.empresa_id, descuentoId, aceptar ? 'aceptado' : 'rechazado'
    );
    if (filas === 0) throw new AppError('Este descuento ya fue respondido', 409);

    // Solo un aceptado cambia el pago y el contrato. Un rechazado no mueve nada.
    let requiereNuevaFirma = false;
    if (aceptar) {
      requiereNuevaFirma = await reiniciarFirmaContrato(asignacion);
      await refrescarCuenta(asignacion, cuenta);
    }

    await NotificacionesService.notificar({
      empresaId: descuento.empresa_id,
      usuarioId: descuento.creado_por,
      tipo: 'turno.descuento_respondido',
      titulo: aceptar ? 'Descuento aceptado' : 'Descuento rechazado',
      mensaje: `El trabajador ${aceptar ? 'aceptó' : 'rechazó'} el descuento de ${money(descuento.monto)} por: ${descuento.motivo}.`,
      data: { descuento_id: descuentoId, asignacion_id: descuento.asignacion_id },
    }).catch(() => {});

    const actualizado = await DescuentosTurnoModel.obtenerPorId(descuento.empresa_id, descuentoId);
    return { ...actualizado, requiere_nueva_firma: requiereNuevaFirma };
  },

  /** El gestor retira un descuento registrado por error. */
  async eliminar(empresaId, descuentoId) {
    const descuento = await DescuentosTurnoModel.obtenerPorId(empresaId, descuentoId);
    if (!descuento) throw new AppError('Descuento no encontrado', 404);

    const asignacion = await cargarAsignacion(descuento.empresa_id, descuento.asignacion_id);
    const cuenta = await exigirCuentaSinFirmar(asignacion);

    await DescuentosTurnoModel.eliminar(descuento.empresa_id, descuentoId);

    let requiereNuevaFirma = false;
    if (descuento.estado === 'aceptado') {
      requiereNuevaFirma = await reiniciarFirmaContrato(asignacion);
      await refrescarCuenta(asignacion, cuenta);
    }

    if (descuento.trabajador_usuario_id) {
      await NotificacionesService.notificar({
        empresaId: descuento.empresa_id,
        usuarioId: descuento.trabajador_usuario_id,
        tipo: 'turno.descuento_retirado',
        titulo: 'Se retiró un descuento',
        mensaje: `Se retiró el descuento de ${money(descuento.monto)} por: ${descuento.motivo}.` +
          (requiereNuevaFirma ? ' Debes volver a firmar el contrato del turno.' : ''),
        data: { asignacion_id: descuento.asignacion_id },
      }).catch(() => {});
    }
  },
};

module.exports = DescuentosTurnoService;
