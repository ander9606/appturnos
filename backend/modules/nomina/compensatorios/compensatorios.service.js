'use strict';

const CompensatoriosModel = require('./compensatorios.model');
const RegistrosModel      = require('../registros/registros.model');
const TrabajadoresModel   = require('../../trabajadores/trabajadores.model');
const AppError            = require('../../../utils/AppError');
const { ROLES }           = require('../../../config/constants');

/** Día de semana: 0=Dom. Devuelve true si es domingo. */
function esDomingo(fechaISO) {
  return new Date(`${fechaISO}T12:00:00`).getDay() === 0;
}

const CompensatoriosService = {
  /**
   * Llamado internamente después de marcar-salida.
   * Si el día es festivo o domingo, crea el descanso compensatorio automáticamente.
   */
  async crearSiCorresponde(empresaId, { trabajadorId, periodoId, fecha, esFestivo, registroId }) {
    if (!esFestivo && !esDomingo(fecha)) return null;
    return CompensatoriosModel.crear(empresaId, {
      trabajadorId,
      periodoId,
      origenFecha: fecha,
      origenRegistroId: registroId,
    });
  },

  /** Lista compensatorios. El trabajador solo ve los suyos. */
  async listar(empresaId, usuario, { estado } = {}) {
    let trabajadorId;
    if (usuario.rol === ROLES.TRABAJADOR_NOMINA) {
      const trab = await TrabajadoresModel.obtenerPorUsuarioId(empresaId, usuario.sub);
      if (!trab) throw new AppError('Trabajador no encontrado', 403);
      trabajadorId = trab.id;
    }
    return CompensatoriosModel.listar(empresaId, { trabajadorId, estado });
  },

  /**
   * Asigna una fecha de descanso (jefe_nomina / admin_empresa).
   * Crea automáticamente un registros_diarios con tipo_dia='compensatorio' en esa fecha.
   */
  async asignar(empresaId, usuarioId, compensatorioId, { fechaAsignada }) {
    const comp = await CompensatoriosModel.obtenerPorId(empresaId, compensatorioId);
    if (!comp) throw new AppError('Descanso compensatorio no encontrado', 404);
    if (comp.estado !== 'pendiente') {
      throw new AppError('Este descanso ya fue asignado', 409);
    }

    // Asignar fecha en la tabla
    const rows = await CompensatoriosModel.asignar(empresaId, compensatorioId, {
      fechaAsignada,
      asignadoPor: usuarioId,
    });
    if (rows === 0) throw new AppError('No se pudo asignar el descanso', 409);

    // Crear (o actualizar) el registro del día como compensatorio
    const existing = await RegistrosModel.obtenerPorFecha(
      empresaId, comp.trabajador_id, fechaAsignada
    );

    if (existing) {
      await RegistrosModel.actualizar(empresaId, existing.id, {
        hora_entrada: existing.hora_entrada,
        hora_salida:  existing.hora_salida,
        horas_ordinarias:     0,
        horas_extra_diurnas:  0,
        horas_extra_nocturnas:0,
        horas_nocturnas:      0,
        horas_festivo:        0,
        es_festivo:           existing.es_festivo,
        novedad:              existing.novedad,
        tipo_dia:             'compensatorio',
        aprobado_por:         usuarioId,
      });
    } else {
      await RegistrosModel.crear(empresaId, {
        trabajador_id:         comp.trabajador_id,
        periodo_id:            comp.periodo_id,
        fecha:                 fechaAsignada,
        hora_entrada:          null,
        hora_salida:           null,
        horas_ordinarias:      0,
        horas_extra_diurnas:   0,
        horas_extra_nocturnas: 0,
        horas_nocturnas:       0,
        horas_festivo:         0,
        es_festivo:            0,
        novedad:               `Descanso compensatorio por trabajo el ${comp.origen_fecha}`,
        tipo_dia:              'compensatorio',
      });
    }

    await CompensatoriosModel.marcarTomado(empresaId, compensatorioId);

    return CompensatoriosModel.obtenerPorId(empresaId, compensatorioId);
  },
};

module.exports = CompensatoriosService;
