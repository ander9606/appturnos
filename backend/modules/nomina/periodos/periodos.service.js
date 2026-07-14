'use strict';

const { pool } = require('../../../config/database');
const PeriodosModel = require('./periodos.model');
const EmpresasModel = require('../../empresas/empresas.model');
const NotificacionesService = require('../../notificaciones/notificaciones.service');
const AppError = require('../../../utils/AppError');
const { toISODate, calcularPeriodoActual, calcularSiguientePeriodo } = require('../../../utils/periodoCiclo');

/** Obtiene usuario_id de todos los trabajador_nomina activos de la empresa. */
async function listarUsuariosNomina(empresaId) {
  const [filas] = await pool.query(
    `SELECT u.id AS usuario_id
     FROM trabajadores t
     JOIN usuarios u ON u.id = t.usuario_id
     WHERE t.empresa_id = ? AND t.activo = 1 AND u.rol = 'trabajador_nomina' AND u.activo = 1`,
    [empresaId]
  );
  return filas.map((f) => f.usuario_id);
}

/**
 * Lógica de períodos de nómina. Máquina de estados:
 *   abierto → cerrado → liquidado
 */
const PeriodosService = {
  async listar(empresaId, { estado, page, limit }) {
    const offset = (page - 1) * limit;
    const { data, total } = await PeriodosModel.listar(empresaId, { estado, limit, offset });
    return { data, pagination: { page, limit, total } };
  },

  async obtener(empresaId, id) {
    const periodo = await PeriodosModel.obtenerPorId(empresaId, id);
    if (!periodo) throw new AppError('Período no encontrado', 404);
    return periodo;
  },

  async crear(empresaId, datos) {
    if (datos.fecha_fin < datos.fecha_inicio) {
      throw new AppError('fecha_fin no puede ser anterior a fecha_inicio', 422);
    }
    const id = await PeriodosModel.crear(empresaId, datos);
    const periodo = await PeriodosModel.obtenerPorId(empresaId, id);

    // Notificar a todos los trabajadores de nómina de la empresa (best-effort).
    const destinatarios = await listarUsuariosNomina(empresaId);
    if (destinatarios.length > 0) {
      const inicio = new Date(periodo.fecha_inicio + 'T00:00:00')
        .toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
      const fin = new Date(periodo.fecha_fin + 'T00:00:00')
        .toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
      await NotificacionesService.notificarVarios(destinatarios, {
        empresaId,
        tipo: 'nomina.periodo_abierto',
        titulo: 'Nuevo período de nómina abierto',
        mensaje: `Período ${inicio} – ${fin} disponible. Ya puedes registrar tu jornada.`,
        data: { periodo_id: id },
      });
    }

    return periodo;
  },

  /**
   * Auto-crea el período que corresponde a hoy según tipo_liquidacion de la empresa.
   * Si ya existe un período abierto o que cubre hoy, no crea uno nuevo.
   */
  async autoCrear(empresaId) {
    const empresa = await EmpresasModel.obtenerParaAdmin(empresaId);
    if (!empresa) return null;
    const tipo = empresa.tipo_liquidacion || 'mensual';
    const hoy  = toISODate(new Date());

    // Cerrar automáticamente cualquier período abierto que ya venció.
    const vencidos = await PeriodosModel.listarAbiertosVencidos(empresaId, hoy);
    for (const v of vencidos) {
      await PeriodosModel.cerrarConSnapshot(empresaId, v.id, null).catch(() => {});
    }

    // Ya hay uno abierto que cubre hoy → no crear.
    const existente = await PeriodosModel.obtenerAbiertoPorFecha(empresaId, hoy);
    if (existente) return existente;
    const datos = calcularPeriodoActual(tipo);
    return this.crear(empresaId, datos);
  },

  async cerrar(empresaId, id, usuarioId) {
    const periodo = await this.obtener(empresaId, id);
    if (periodo.estado !== 'abierto') {
      throw new AppError('Solo se puede cerrar un período abierto', 409);
    }
    // cerrarConSnapshot es atómico: cambia estado + congela valor_hora
    // en un solo commit, evitando que modificaciones de sueldo posteriores
    // afecten la liquidación de este período.
    await PeriodosModel.cerrarConSnapshot(empresaId, id, usuarioId);
    // Auto-crear el período siguiente para que los trabajadores no queden
    // sin período abierto al día siguiente.
    const empresa = await EmpresasModel.obtenerParaAdmin(empresaId);
    if (empresa?.tipo_liquidacion) {
      const tipo = empresa.tipo_liquidacion;
      const siguiente = calcularSiguientePeriodo(tipo, periodo.fecha_fin);
      // Solo crear si no existe ya uno abierto en ese rango.
      const hoyStr = toISODate(new Date());
      const existente = await PeriodosModel.obtenerAbiertoPorFecha(empresaId, siguiente.fecha_inicio);
      if (!existente) {
        await this.crear(empresaId, siguiente).catch(() => {}); // best-effort
      }
    }
    return PeriodosModel.obtenerPorId(empresaId, id);
  },

  async liquidar(empresaId, id) {
    const periodo = await this.obtener(empresaId, id);
    if (periodo.estado !== 'cerrado') {
      throw new AppError('Solo se puede liquidar un período cerrado', 409);
    }
    await PeriodosModel.liquidar(empresaId, id);

    const destinatarios = await listarUsuariosNomina(empresaId);
    if (destinatarios.length > 0) {
      const inicio = new Date(periodo.fecha_inicio + 'T00:00:00')
        .toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
      const fin = new Date(periodo.fecha_fin + 'T00:00:00')
        .toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
      await NotificacionesService.notificarVarios(destinatarios, {
        empresaId,
        tipo: 'nomina.periodo_liquidado',
        titulo: '¡Tu nómina fue pagada!',
        mensaje: `El período ${inicio} – ${fin} fue liquidado. Revisa tu resumen en la app.`,
        data: { periodo_id: id },
      });
    }

    return PeriodosModel.obtenerPorId(empresaId, id);
  },
};

module.exports = PeriodosService;
