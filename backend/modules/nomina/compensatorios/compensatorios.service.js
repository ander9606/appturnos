'use strict';

const CompensatoriosModel = require('./compensatorios.model');
const RegistrosModel      = require('../registros/registros.model');
const TrabajadoresModel   = require('../../trabajadores/trabajadores.model');
const NotificacionesService = require('../../notificaciones/notificaciones.service');
const AppError            = require('../../../utils/AppError');
const { pool }             = require('../../../config/database');
const { ROLES, COMPENSATORIO_PLAZO_DIAS } = require('../../../config/constants');
const { esDiaFestivo, esDomingo } = require('../../../utils/laboralUtils');
const logger              = require('../../../utils/logger');

function sumarDiasISO(fechaISO, dias) {
  const d = new Date(`${fechaISO}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function fechaLarga(fechaISO) {
  return new Date(`${fechaISO}T00:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
}

/**
 * Valida que `fechaAsignada` sea una fecha legal para el descanso de `comp`:
 * dentro del plazo de 28 días desde el día trabajado, no domingo/festivo, y
 * sin choque con otro registro o compensatorio del trabajador ese día.
 * Compartida entre asignar() (primera vez) y reasignar() (mover una ya
 * puesta) — antes solo reasignar() la tenía, dejando asignar() sin ningún
 * control server-side más allá del formato de fecha en la ruta.
 */
async function validarFechaDescanso(empresaId, comp, fechaAsignada) {
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
}

const CompensatoriosService = {
  /**
   * Llamado internamente después de marcar-salida (o crear/corregir un
   * registro). Si el día es festivo o domingo, crea el descanso compensatorio
   * — siempre 'pendiente', sin fecha: la asigna el jefe_nomina/admin
   * manualmente desde la sección de compensatorios (ver rango()). También
   * avisa a trabajador y, cuando aplica recargo, a los gestores.
   */
  async crearSiCorresponde(empresaId, { trabajadorId, periodoId, fecha, esFestivo, registroId, clasificacion = 'habitual', numeroDomingo }) {
    const domingo = esDomingo(fecha);
    if (!esFestivo && !domingo) return null;

    const compensatorioId = await CompensatoriosModel.crear(empresaId, {
      trabajadorId,
      periodoId,
      origenFecha: fecha,
      origenRegistroId: registroId,
      clasificacion,
    });
    if (!compensatorioId) return null; // ya existía (INSERT IGNORE)

    // Best-effort: un fallo notificando no debe tumbar la respuesta de
    // marcar-salida — el registro del día ya se guardó.
    try {
      await this._avisar(empresaId, { trabajadorId, fecha, domingo, clasificacion, numeroDomingo });
    } catch (err) {
      logger.error('[compensatorios] fallo notificando festivo/domingo', err.message);
    }

    return compensatorioId;
  },

  /**
   * Avisa al trabajador y, cuando el día lleva recargo (domingo habitual o
   * festivo entre semana), también a los gestores de nómina.
   * - Ocasional (1º/2º domingo del mes, Art. 180 CST): solo al trabajador —
   *   no requiere ninguna acción de los gestores más allá de la asignación
   *   normal de fecha, que ya ven listada en su sección de compensatorios.
   * - Habitual (3º+ domingo, Art. 181) o festivo entre semana: a ambos —
   *   implica recargo en la liquidación, los gestores deben saberlo.
   */
  async _avisar(empresaId, { trabajadorId, fecha, domingo, clasificacion, numeroDomingo }) {
    const trabajador = await TrabajadoresModel.obtenerPorId(empresaId, trabajadorId);
    const nombreCompleto = trabajador ? `${trabajador.nombre} ${trabajador.apellido}` : 'Un trabajador';

    if (domingo && clasificacion === 'ocasional') {
      if (trabajador?.usuario_id) {
        await NotificacionesService.notificar({
          empresaId,
          usuarioId: trabajador.usuario_id,
          tipo: 'nomina.domingo_ocasional',
          titulo: 'Domingo sin recargo',
          mensaje: `Trabajaste el domingo ${fechaLarga(fecha)} — es tu domingo Nº${numeroDomingo} del mes, así que no lleva recargo dominical, pero se te asignará un día de descanso compensatorio.`,
          data: { fecha },
        });
      }
      return;
    }

    const mensajeTrabajador = domingo
      ? `Trabajaste tu domingo Nº${numeroDomingo} del mes (${fechaLarga(fecha)}) — tendrás recargo dominical y se te asignará un día de descanso compensatorio.`
      : `Trabajaste el día festivo ${fechaLarga(fecha)} — tendrás un recargo en tus horas.`;

    if (trabajador?.usuario_id) {
      await NotificacionesService.notificar({
        empresaId,
        usuarioId: trabajador.usuario_id,
        tipo: domingo ? 'nomina.domingo_habitual' : 'nomina.festivo_trabajado',
        titulo: domingo ? 'Domingo habitual trabajado' : 'Festivo trabajado',
        mensaje: mensajeTrabajador,
        data: { fecha },
      });
    }

    const [gestores] = await pool.query(
      `SELECT id FROM usuarios WHERE empresa_id = ? AND rol IN ('jefe_nomina','admin_empresa','nomina') AND activo = 1`,
      [empresaId]
    );
    if (gestores.length > 0) {
      await NotificacionesService.notificarVarios(gestores.map((g) => g.id), {
        empresaId,
        tipo: domingo ? 'nomina.domingo_habitual_gestor' : 'nomina.festivo_trabajado_gestor',
        titulo: 'Aplica recargo festivo',
        mensaje: domingo
          ? `${nombreCompleto} trabajó su domingo Nº${numeroDomingo} del mes (${fechaLarga(fecha)}) — recargo dominical + compensatorio.`
          : `${nombreCompleto} trabajó el festivo ${fechaLarga(fecha)} — aplica recargo.`,
        data: { fecha, trabajador_id: trabajadorId },
      });
    }
  },

  /** Rango de 28 días disponibles para asignar el descanso, con zona de color. */
  async rango(empresaId, compensatorioId) {
    const comp = await CompensatoriosModel.obtenerPorId(empresaId, compensatorioId);
    if (!comp) throw new AppError('Descanso compensatorio no encontrado', 404);
    return CompensatoriosModel.rangoDisponible(empresaId, comp.trabajador_id, comp.origen_fecha);
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
    await validarFechaDescanso(empresaId, comp, fechaAsignada);
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
    await validarFechaDescanso(empresaId, comp, fechaAsignada);

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
            jornada_continua: registroAnterior.jornada_continua,
            horas_acumuladas_semana: registroAnterior.horas_acumuladas_semana,
          });
        }
      }
    }

    let rows;
    try {
      rows = await CompensatoriosModel.reasignar(empresaId, compensatorioId, {
        fechaAsignada,
        asignadoPor: usuarioId,
      });
    } catch (err) {
      // Respaldo del check de arriba (validarFechaDescanso) contra la carrera:
      // dos asignaciones casi simultáneas pueden pasar el check antes de que
      // cualquiera de las dos escriba — el índice único de la BD es quien de
      // verdad lo impide, esto solo traduce su error a uno legible.
      if (err.code === 'ER_DUP_ENTRY') {
        throw new AppError('El trabajador ya tiene otro descanso asignado ese día', 409);
      }
      throw err;
    }
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

    let rows;
    try {
      rows = await CompensatoriosModel.asignar(empresaId, compensatorioId, {
        fechaAsignada,
        asignadoPor,
      });
    } catch (err) {
      // Mismo respaldo de carrera que reasignar() — ver el comentario ahí.
      if (err.code === 'ER_DUP_ENTRY') {
        throw new AppError('El trabajador ya tiene otro descanso asignado ese día', 409);
      }
      throw err;
    }
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
        jornada_continua:     existing.jornada_continua,
        horas_acumuladas_semana: existing.horas_acumuladas_semana,
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
