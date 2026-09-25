'use strict';

const DescuentosModel = require('./descuentos.model');
const PeriodosModel = require('../periodos/periodos.model');
const TrabajadoresModel = require('../../trabajadores/trabajadores.model');
const NotificacionesService = require('../../notificaciones/notificaciones.service');
const AppError = require('../../../utils/AppError');
const { ROLES } = require('../../../config/constants');

const DescuentosService = {
  /** Gestor registra un descuento — queda pendiente hasta que el trabajador lo acepte. */
  async crear(empresaId, usuarioGestorId, { trabajadorId, periodoId, tipo, motivo, monto }) {
    const periodo = await PeriodosModel.obtenerPorId(empresaId, periodoId);
    if (!periodo) throw new AppError('Período no encontrado', 404);
    if (periodo.estado === 'liquidado') {
      throw new AppError('El período ya fue liquidado, no se pueden agregar descuentos', 409);
    }

    const trabajador = await TrabajadoresModel.obtenerPorId(empresaId, trabajadorId);
    if (!trabajador) throw new AppError('Trabajador no encontrado', 404);

    const id = await DescuentosModel.crear(empresaId, {
      trabajadorId, periodoId, tipo, motivo, monto, creadoPor: usuarioGestorId,
    });

    if (trabajador.usuario_id) {
      await NotificacionesService.notificar({
        empresaId,
        usuarioId: trabajador.usuario_id,
        tipo: 'nomina.descuento_pendiente',
        titulo: 'Tienes un descuento por aceptar',
        mensaje: `Tu empresa registró un descuento de ${motivo} por revisar en tu próxima liquidación.`,
        data: { descuento_id: id },
      });
    }

    return DescuentosModel.obtenerPorId(empresaId, id);
  },

  /** Lista descuentos. El trabajador_nomina solo ve los suyos. */
  async listar(empresaId, usuario, { periodoId, estado } = {}) {
    let trabajadorId;
    if (usuario.rol === ROLES.TRABAJADOR_NOMINA) {
      const trab = await TrabajadoresModel.obtenerPorUsuarioId(empresaId, usuario.sub);
      if (!trab) throw new AppError('Trabajador no encontrado', 403);
      trabajadorId = trab.id;
    }
    return DescuentosModel.listar(empresaId, { trabajadorId, periodoId, estado });
  },

  /** El trabajador acepta o rechaza su propio descuento pendiente. */
  async responder(empresaId, usuario, descuentoId, estado) {
    const descuento = await DescuentosModel.obtenerPorId(empresaId, descuentoId);
    if (!descuento) throw new AppError('Descuento no encontrado', 404);

    // Resuelve el trabajador DESDE el descuento (descuento.trabajador_id) y
    // compara usuario_id — no busca "cuál es mi trabajador en esta empresa"
    // por separado, porque esa búsqueda puede devolver una fila distinta si
    // el usuario tiene más de una fila en `trabajadores` para la misma
    // empresa (la tabla no lo impide).
    const trab = await TrabajadoresModel.obtenerPorId(empresaId, descuento.trabajador_id);
    if (!trab || trab.usuario_id !== usuario.sub) {
      throw new AppError('No autorizado', 403);
    }

    const rows = await DescuentosModel.responder(empresaId, descuentoId, estado);
    if (rows === 0) throw new AppError('Este descuento ya fue respondido', 409);

    await NotificacionesService.notificar({
      empresaId,
      usuarioId: descuento.creado_por,
      tipo: 'nomina.descuento_respondido',
      titulo: estado === 'aceptado' ? 'Descuento aceptado' : 'Descuento rechazado',
      mensaje: `El trabajador ${estado === 'aceptado' ? 'aceptó' : 'rechazó'} el descuento por ${descuento.motivo}.`,
      data: { descuento_id: descuentoId },
    });

    return DescuentosModel.obtenerPorId(empresaId, descuentoId);
  },

  /** Gestor elimina un descuento que registró por error. */
  async eliminar(empresaId, descuentoId) {
    const descuento = await DescuentosModel.obtenerPorId(empresaId, descuentoId);
    if (!descuento) throw new AppError('Descuento no encontrado', 404);

    const periodo = await PeriodosModel.obtenerPorId(empresaId, descuento.periodo_id);
    if (periodo?.estado === 'liquidado') {
      throw new AppError('El período ya fue liquidado, no se puede eliminar', 409);
    }

    await DescuentosModel.eliminar(empresaId, descuentoId);
  },
};

module.exports = DescuentosService;
