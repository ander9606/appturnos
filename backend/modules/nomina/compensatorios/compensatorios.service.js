'use strict';

const CompensatoriosModel = require('./compensatorios.model');
const RegistrosModel      = require('../registros/registros.model');
const TrabajadoresModel   = require('../../trabajadores/trabajadores.model');
const NotificacionesService = require('../../notificaciones/notificaciones.service');
const AppError            = require('../../../utils/AppError');
const { ROLES, COMPENSATORIO_PLAZO_DIAS } = require('../../../config/constants');
const { esDiaFestivo }    = require('../../../utils/laboralUtils');
const logger              = require('../../../utils/logger');

/** Día de semana: 0=Dom. Devuelve true si es domingo. */
function esDomingo(fechaISO) {
  return new Date(`${fechaISO}T12:00:00`).getDay() === 0;
}

function sumarDiasISO(fechaISO, dias) {
  const d = new Date(`${fechaISO}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Busca el primer día hábil (no domingo/festivo, sin registro ni descanso ya
 * asignado) disponible para el trabajador dentro del plazo legal, empezando
 * al día siguiente del domingo/festivo trabajado.
 */
async function determinarFechaAutomatica(empresaId, trabajadorId, origenFecha) {
  for (let i = 1; i <= COMPENSATORIO_PLAZO_DIAS; i++) {
    const candidata = sumarDiasISO(origenFecha, i);
    if (esDiaFestivo(candidata)) continue; // esDiaFestivo() ya cubre domingo

    const [registroExistente, yaAsignado] = await Promise.all([
      RegistrosModel.obtenerPorFecha(empresaId, trabajadorId, candidata),
      CompensatoriosModel.existeFechaAsignada(empresaId, trabajadorId, candidata),
    ]);
    if (registroExistente || yaAsignado) continue;

    return candidata;
  }
  return null;
}

const CompensatoriosService = {
  /**
   * Llamado internamente después de marcar-salida.
   * Si el día es festivo o domingo, crea el descanso compensatorio y el
   * sistema mismo ubica la fecha en la que el trabajador lo tomará. Si no
   * encuentra un día libre dentro del plazo legal, lo deja 'pendiente' para
   * que el jefe_nomina/admin lo asigne manualmente.
   */
  async crearSiCorresponde(empresaId, { trabajadorId, periodoId, fecha, esFestivo, registroId }) {
    if (!esFestivo && !esDomingo(fecha)) return null;

    const compensatorioId = await CompensatoriosModel.crear(empresaId, {
      trabajadorId,
      periodoId,
      origenFecha: fecha,
      origenRegistroId: registroId,
    });
    if (!compensatorioId) return null; // ya existía (INSERT IGNORE)

    // La asignación automática es un "mejor esfuerzo": si falla, el compensatorio
    // queda 'pendiente' (ya creado arriba) para asignación manual, y no debe
    // tumbar la respuesta de marcar-salida — el registro del día ya se guardó.
    try {
      const fechaAutomatica = await determinarFechaAutomatica(empresaId, trabajadorId, fecha);
      if (fechaAutomatica) {
        await this._ejecutarAsignacion(empresaId, compensatorioId, {
          fechaAsignada: fechaAutomatica,
          asignadoPor: null, // asignado por el sistema, no por un usuario
        });
      }
    } catch (err) {
      logger.error('[compensatorios] fallo la asignación automática', err.message);
    }

    return compensatorioId;
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
   * Asigna manualmente una fecha de descanso (jefe_nomina / admin_empresa),
   * para los casos en que el sistema no pudo ubicar una automáticamente.
   */
  async asignar(empresaId, usuarioId, compensatorioId, { fechaAsignada }) {
    const comp = await CompensatoriosModel.obtenerPorId(empresaId, compensatorioId);
    if (!comp) throw new AppError('Descanso compensatorio no encontrado', 404);
    if (comp.estado !== 'pendiente') {
      throw new AppError('Este descanso ya fue asignado', 409);
    }
    return this._ejecutarAsignacion(empresaId, compensatorioId, {
      fechaAsignada,
      asignadoPor: usuarioId,
    });
  },

  /**
   * Fija fecha_asignada, crea/actualiza el registro del día como
   * 'compensatorio' y marca el descanso 'tomado'. Compartido entre la
   * asignación automática (crearSiCorresponde) y la manual (asignar).
   */
  async _ejecutarAsignacion(empresaId, compensatorioId, { fechaAsignada, asignadoPor }) {
    const comp = await CompensatoriosModel.obtenerPorId(empresaId, compensatorioId);
    if (!comp) throw new AppError('Descanso compensatorio no encontrado', 404);

    const rows = await CompensatoriosModel.asignar(empresaId, compensatorioId, {
      fechaAsignada,
      asignadoPor,
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
        aprobado_por:         asignadoPor,
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

    const trabajador = await TrabajadoresModel.obtenerPorId(empresaId, comp.trabajador_id);
    if (trabajador?.usuario_id) {
      await NotificacionesService.notificar({
        empresaId,
        usuarioId: trabajador.usuario_id,
        tipo: 'nomina.compensatorio_asignado',
        titulo: 'Descanso compensatorio asignado',
        mensaje: `El ${fechaAsignada} no tienes que asistir a laborar — es tu compensatorio por el ${comp.origen_fecha}.`,
        data: { compensatorio_id: compensatorioId },
      });
    }

    return CompensatoriosModel.obtenerPorId(empresaId, compensatorioId);
  },
};

module.exports = CompensatoriosService;
