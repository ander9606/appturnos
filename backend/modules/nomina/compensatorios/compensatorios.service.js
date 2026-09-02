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
   * Cambia la fecha de un descanso que ya tiene fecha (automática o manual)
   * a otra fecha dentro del plazo legal. Libera el día anterior (borra el
   * registro placeholder que se creó para ese día) y crea el nuevo.
   */
  async reasignar(empresaId, usuarioId, compensatorioId, { fechaAsignada }) {
    const comp = await CompensatoriosModel.obtenerPorId(empresaId, compensatorioId);
    if (!comp) throw new AppError('Descanso compensatorio no encontrado', 404);
    if (comp.estado === 'pendiente') {
      throw new AppError('Este descanso aún no tiene fecha asignada — usa asignar()', 409);
    }
    if (fechaAsignada === comp.fecha_asignada) {
      throw new AppError('Esa ya es la fecha asignada actual', 422);
    }

    const limite = sumarDiasISO(comp.origen_fecha, COMPENSATORIO_PLAZO_DIAS);
    if (fechaAsignada <= comp.origen_fecha || fechaAsignada > limite) {
      throw new AppError(
        `La fecha debe estar entre el ${sumarDiasISO(comp.origen_fecha, 1)} y el ${limite} (28 días desde el ${comp.origen_fecha})`,
        422
      );
    }
    if (esDiaFestivo(fechaAsignada)) {
      throw new AppError('No puedes asignar el descanso a un domingo o festivo', 422);
    }

    const [registroExistente, yaAsignado] = await Promise.all([
      RegistrosModel.obtenerPorFecha(empresaId, comp.trabajador_id, fechaAsignada),
      CompensatoriosModel.existeFechaAsignada(empresaId, comp.trabajador_id, fechaAsignada),
    ]);
    if (registroExistente) throw new AppError('El trabajador ya tiene un registro ese día', 409);
    if (yaAsignado) throw new AppError('El trabajador ya tiene otro descanso asignado ese día', 409);

    // Liberar el día anterior — ya no es el descanso, no debe seguir apareciendo
    // como 'compensatorio'. Si es el placeholder que creamos nosotros mismos (sin
    // marcaje) se borra entero. Si el jefe lo había asignado sobre un día que ya
    // tenía un registro real, esas horas se sobreescribieron a cero en su momento
    // (no hay forma de recuperarlas aquí) — se libera el tipo_dia igual y se deja
    // una novedad para que el jefe confirme/corrija las horas desde Registros.
    if (comp.fecha_asignada) {
      const registroAnterior = await RegistrosModel.obtenerPorFecha(
        empresaId, comp.trabajador_id, comp.fecha_asignada
      );
      if (registroAnterior?.tipo_dia === 'compensatorio') {
        if (!registroAnterior.hora_entrada) {
          await RegistrosModel.eliminar(empresaId, registroAnterior.id);
        } else {
          await RegistrosModel.actualizar(empresaId, registroAnterior.id, {
            hora_entrada: registroAnterior.hora_entrada,
            hora_salida: registroAnterior.hora_salida,
            horas_ordinarias: registroAnterior.horas_ordinarias,
            horas_extra_diurnas: registroAnterior.horas_extra_diurnas,
            horas_extra_nocturnas: registroAnterior.horas_extra_nocturnas,
            horas_nocturnas: registroAnterior.horas_nocturnas,
            horas_festivo: registroAnterior.horas_festivo,
            es_festivo: registroAnterior.es_festivo,
            novedad: 'Ya no es descanso compensatorio (se reasignó a otra fecha) — verifica las horas de este día',
            tipo_dia: 'ordinario',
            aprobado_por: usuarioId,
          });
        }
      }
    }

    const rows = await CompensatoriosModel.reasignar(empresaId, compensatorioId, {
      fechaAsignada,
      asignadoPor: usuarioId,
    });
    if (rows === 0) throw new AppError('No se pudo reasignar el descanso', 409);

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

    const trabajador = await TrabajadoresModel.obtenerPorId(empresaId, comp.trabajador_id);
    if (trabajador?.usuario_id) {
      await NotificacionesService.notificar({
        empresaId,
        usuarioId: trabajador.usuario_id,
        tipo: 'nomina.compensatorio_asignado',
        titulo: 'Descanso compensatorio reprogramado',
        mensaje: `Tu descanso compensatorio por el ${comp.origen_fecha} ahora es el ${fechaAsignada} (antes era el ${comp.fecha_asignada}).`,
        data: { compensatorio_id: compensatorioId },
      });
    }

    return CompensatoriosModel.obtenerPorId(empresaId, compensatorioId);
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
