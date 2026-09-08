'use strict';

const CuentasCobroModel = require('./cuentas-cobro.model');
const PeriodosModel = require('../nomina/periodos/periodos.model');
const AsignacionesModel = require('../turnos/asignaciones/asignaciones.model');
const TrabajadoresModel = require('../trabajadores/trabajadores.model');
const NotificacionesService = require('../notificaciones/notificaciones.service');
const AppError = require('../../utils/AppError');
const { ROLES } = require('../../config/constants');

function verificarAcceso(cuenta, usuario) {
  if (
    usuario.rol === ROLES.TRABAJADOR_TURNOS &&
    cuenta.trabajador_usuario_id !== usuario.sub
  ) {
    throw new AppError('No tienes acceso a esta cuenta de cobro', 403);
  }
}

const CuentasCobroService = {
  /**
   * Genera (o refresca, mientras no estén firmadas) las cuentas de cobro de
   * todos los trabajadores con turnos completados y firmados en el rango del
   * período. El sistema de turnos ya es inherentemente prestación de
   * servicios por diseño (mismo criterio que contratoPdf.js, que siempre
   * documenta cada turno como tal) — no depende de empresas.tipo_contrato,
   * que gobierna algo distinto (descuentos de nómina laboral tradicional,
   * ver liquidacion.service.js) y es independiente de si la empresa además
   * tiene trabajadores de turnos. Idempotente: se puede volver a llamar (ver
   * regenerarParaPeriodo) para recoger firmas de contrato diario que lleguen
   * después del cierre del período.
   */
  async generarParaPeriodo(empresaId, periodoId) {
    const periodo = await PeriodosModel.obtenerPorId(empresaId, periodoId);
    if (!periodo) throw new AppError('Período no encontrado', 404);

    const trabajadores = await AsignacionesModel.liquidacion(empresaId, {
      fechaInicio: periodo.fecha_inicio,
      fechaFin: periodo.fecha_fin,
    });

    let generadas = 0;
    for (const w of trabajadores) {
      const items = w.turnos.filter((t) => t.firmado_trabajador);
      if (items.length === 0) continue;

      const totalHoras = items.reduce((s, t) => s + t.horas_trabajadas, 0);
      const valorTotal = items.reduce((s, t) => s + t.pago_total, 0);

      const id = await CuentasCobroModel.crear(empresaId, {
        periodoId,
        trabajadorId: w.trabajador_id,
        numeroCuenta: `CC-${periodoId}-${w.trabajador_id}`,
        fechaInicio: periodo.fecha_inicio,
        fechaFin: periodo.fecha_fin,
        totalTurnos: items.length,
        totalHoras,
        valorTotal,
        items: items.map((t) => ({
          asignacion_id: t.asignacion_id,
          fecha: t.oferta_fecha,
          descripcion: t.oferta_titulo,
          hora_inicio: t.hora_inicio,
          hora_fin: t.hora_fin_estimada,
          horas: t.horas_trabajadas,
          valor: t.pago_total,
        })),
      });
      generadas++;

      if (w.usuario_id) {
        const inicio = new Date(periodo.fecha_inicio + 'T00:00:00')
          .toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
        const fin = new Date(periodo.fecha_fin + 'T00:00:00')
          .toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
        await NotificacionesService.notificar({
          empresaId,
          usuarioId: w.usuario_id,
          tipo: 'cuenta_cobro.pendiente_firma',
          titulo: 'Tu cuenta de cobro está lista',
          mensaje: `Firma tu cuenta de cobro del período ${inicio} – ${fin} para completar tu pago.`,
          data: { cuenta_cobro_id: id, periodo_id: periodoId },
        }).catch(() => {});
      }
    }
    return { generadas };
  },

  async listarMisCuentas(usuario) {
    return CuentasCobroModel.listarPorUsuario(usuario.sub);
  },

  async listarSinFirmar(usuario) {
    return CuentasCobroModel.listarSinFirmarPorUsuario(usuario.sub);
  },

  async obtener(empresaId, id, usuario) {
    const cuenta = await CuentasCobroModel.obtenerPorId(empresaId, id);
    if (!cuenta) throw new AppError('Cuenta de cobro no encontrada', 404);
    verificarAcceso(cuenta, usuario);
    return cuenta;
  },

  async firmar(empresaId, id, usuario, firmaB64) {
    const cuenta = await CuentasCobroModel.obtenerPorId(empresaId, id);
    if (!cuenta) throw new AppError('Cuenta de cobro no encontrada', 404);
    if (cuenta.trabajador_usuario_id !== usuario.sub) {
      throw new AppError('Solo el trabajador puede firmar esta cuenta de cobro', 403);
    }
    if (cuenta.firmado_trabajador) {
      throw new AppError('La cuenta de cobro ya está firmada', 409);
    }
    const realEmpresaId = cuenta.empresa_id;
    await CuentasCobroModel.firmar(realEmpresaId, id, firmaB64);
    await TrabajadoresModel.guardarFirma(cuenta.trabajador_id, firmaB64).catch(() => null);
    return CuentasCobroModel.obtenerPorId(realEmpresaId, id);
  },
};

module.exports = CuentasCobroService;
