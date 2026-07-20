'use strict';

const RegistrosModel            = require('./registros.model');
const SolicitudesReingresoModel = require('./solicitudes-reingreso.model');
const PeriodosModel             = require('../periodos/periodos.model');
const PeriodosService           = require('../periodos/periodos.service');
const TrabajadoresModel         = require('../../trabajadores/trabajadores.model');
const PuntosMarcajeModel        = require('../../puntos-marcaje/puntos-marcaje.model');
const EmpresasModel             = require('../../empresas/empresas.model');
const CompensatoriosService     = require('../compensatorios/compensatorios.service');
const NotificacionesService     = require('../../notificaciones/notificaciones.service');
const { pool }                  = require('../../../config/database');
const { calcularHoras }         = require('../../../utils/laboralUtils');
const { ahoraColombiaSQL }      = require('../../../utils/fechaColombia');
const { haversineMetros }       = require('../../../utils/geoUtils');
const AppError                  = require('../../../utils/AppError');
const { ROLES, HORAS_EXTRA_MAX_SEMANA } = require('../../../config/constants');

/**
 * El trabajador_nomina solo opera sobre sus propios registros: se resuelve
 * su trabajador y se ignora cualquier trabajador_id que venga en la petición.
 */
async function resolverTrabajadorPropio(empresaId, usuarioId) {
  const trabajador = await TrabajadoresModel.obtenerPorUsuarioId(empresaId, usuarioId);
  if (!trabajador) {
    throw new AppError('Tu usuario no está vinculado a un trabajador activo', 403);
  }
  return trabajador.id;
}

/** Validate geofence if the worker has tipo_marcacion = 'fijo' or 'zonal'. */
async function validarGeofence(empresaId, trabajador, latitud, longitud) {
  if (trabajador.tipo_marcacion === 'fijo') {
    if (!trabajador.punto_marcaje_id) {
      throw new AppError('El trabajador no tiene punto de marcaje asignado', 422);
    }
    if (latitud == null || longitud == null) {
      throw new AppError('Debes enviar tu ubicación para marcar en un punto fijo', 422);
    }
    const punto = await PuntosMarcajeModel.obtenerPorId(empresaId, trabajador.punto_marcaje_id);
    if (!punto) throw new AppError('Punto de marcaje no encontrado', 404);
    const distancia = haversineMetros(latitud, longitud, punto.latitud, punto.longitud);
    if (distancia > punto.radio_metros) {
      throw new AppError(
        `Estás a ${Math.round(distancia)} m del punto de marcaje (máximo ${punto.radio_metros} m)`,
        422
      );
    }
    return;
  }

  if (trabajador.tipo_marcacion === 'zonal') {
    const puntos = await PuntosMarcajeModel.listarZonales(empresaId);
    if (puntos.length === 0) return; // sin puntos zonales configurados aún — no bloquea
    if (latitud == null || longitud == null) {
      throw new AppError('Debes enviar tu ubicación para marcar en una zona autorizada', 422);
    }
    const dentro = puntos.some(
      (p) => haversineMetros(latitud, longitud, p.latitud, p.longitud) <= p.radio_metros
    );
    if (!dentro) {
      throw new AppError('Debes estar en uno de los puntos zonales autorizados para marcar', 422);
    }
  }
}

/** ISO date of the Monday of the week containing isoDate. */
function getLunesDeSemana(isoDate) {
  const d = new Date(isoDate + 'T12:00:00Z');
  const dow = d.getUTCDay(); // 0=dom…6=sab
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return d.toISOString().slice(0, 10);
}

/** Returns today's date as 'YYYY-MM-DD' in Colombia time (UTC-5, no DST). */
function hoyISO() {
  return ahoraColombiaSQL().slice(0, 10);
}

/** Returns current time as 'HH:MM:SS' in Colombia time (UTC-5), independiente del TZ del proceso. */
function ahoraHHMMSS() {
  return ahoraColombiaSQL().slice(11, 19);
}

async function _notificarDecisionReingreso(empresaId, solicitudId, tipo, titulo, mensaje) {
  const [[sol]] = await pool.query(
    'SELECT sr.*, t.usuario_id FROM solicitudes_reingreso sr JOIN trabajadores t ON t.id = sr.trabajador_id WHERE sr.id = ?',
    [solicitudId]
  );
  if (sol?.usuario_id) {
    await NotificacionesService.notificar({
      empresaId, usuarioId: sol.usuario_id, tipo, titulo, mensaje,
      data: { solicitud_id: solicitudId },
    });
  }
}

const RegistrosService = {
  async listar(empresaId, usuario, { periodo_id, trabajador_id, fecha, fecha_desde, fecha_hasta, page, limit }) {
    let trabajadorId = trabajador_id;
    if (usuario.rol === ROLES.TRABAJADOR_NOMINA) {
      trabajadorId = await resolverTrabajadorPropio(empresaId, usuario.sub);
    }
    const offset = (page - 1) * limit;
    const { data, total } = await RegistrosModel.listar(empresaId, {
      periodoId: periodo_id,
      trabajadorId,
      fecha,
      fechaDesde: fecha_desde,
      fechaHasta: fecha_hasta,
      limit,
      offset,
    });
    return { data, pagination: { page, limit, total } };
  },

  async crear(empresaId, usuario, datos) {
    let trabajadorId = datos.trabajador_id;
    if (usuario.rol === ROLES.TRABAJADOR_NOMINA) {
      trabajadorId = await resolverTrabajadorPropio(empresaId, usuario.sub);
    }
    if (!trabajadorId) {
      throw new AppError('trabajador_id es obligatorio', 422);
    }

    const periodo = await PeriodosModel.obtenerPorId(empresaId, datos.periodo_id);
    if (!periodo) throw new AppError('Período no encontrado', 404);
    if (periodo.estado !== 'abierto') {
      throw new AppError('No se puede registrar en un período que no está abierto', 409);
    }
    if (datos.fecha < periodo.fecha_inicio || datos.fecha > periodo.fecha_fin) {
      throw new AppError('La fecha está fuera del rango del período', 422);
    }

    // Mismo criterio que marcarSalida(): el tope de ordinarias es semanal, no por día.
    const lunesCrear = getLunesDeSemana(datos.fecha);
    const { ordinarias: ordinariasAcumCrear } =
      await RegistrosModel.sumarOrdinariasEnSemana(empresaId, trabajadorId, lunesCrear, datos.fecha);

    const horas = calcularHoras({
      horaEntrada: datos.hora_entrada,
      horaSalida: datos.hora_salida,
      fecha: datos.fecha,
      horasOrdinariasAcumuladas: ordinariasAcumCrear,
    });

    const id = await RegistrosModel.crear(empresaId, {
      trabajador_id: trabajadorId,
      periodo_id: datos.periodo_id,
      fecha: datos.fecha,
      hora_entrada: datos.hora_entrada || null,
      hora_salida: datos.hora_salida || null,
      horas_ordinarias: horas.horas_ordinarias,
      horas_extra_diurnas: horas.horas_extra_diurnas,
      horas_extra_nocturnas: horas.horas_extra_nocturnas,
      horas_nocturnas: horas.horas_nocturnas,
      horas_festivo: horas.horas_festivo,
      es_festivo: horas.es_festivo,
      novedad: datos.novedad || null,
      tipo_dia: 'ordinario',
    });

    // Compensatorio si es festivo o domingo (Art. 179 CST) — misma regla que marcarSalida.
    // La unique constraint en origen_registro_id previene duplicados.
    await CompensatoriosService.crearSiCorresponde(empresaId, {
      trabajadorId,
      periodoId: datos.periodo_id,
      fecha: datos.fecha,
      esFestivo: Boolean(horas.es_festivo),
      registroId: id,
    });

    return RegistrosModel.obtenerPorId(empresaId, id);
  },

  /** Corrección de un registro. Recalcula las horas y registra el aprobador. */
  async corregir(empresaId, usuario, id, datos) {
    const registro = await RegistrosModel.obtenerPorId(empresaId, id);
    if (!registro) throw new AppError('Registro no encontrado', 404);

    if (registro.sesiones > 1) {
      throw new AppError('No se puede corregir manualmente un registro con múltiples sesiones. Contacta al administrador del sistema.', 422);
    }

    const periodo = await PeriodosModel.obtenerPorId(empresaId, registro.periodo_id);
    if (periodo.estado !== 'abierto') {
      throw new AppError('No se puede corregir un registro de un período cerrado', 409);
    }

    const horaEntrada =
      datos.hora_entrada !== undefined ? datos.hora_entrada : registro.hora_entrada;
    const horaSalida =
      datos.hora_salida !== undefined ? datos.hora_salida : registro.hora_salida;

    // Mismo criterio que marcarSalida(): el tope de ordinarias es semanal, no por día.
    const lunesCorregir = getLunesDeSemana(registro.fecha);
    const { ordinarias: ordinariasAcumCorregir } =
      await RegistrosModel.sumarOrdinariasEnSemana(empresaId, registro.trabajador_id, lunesCorregir, registro.fecha);

    const horas = calcularHoras({
      horaEntrada, horaSalida, fecha: registro.fecha, horasOrdinariasAcumuladas: ordinariasAcumCorregir,
    });

    await RegistrosModel.actualizar(empresaId, id, {
      hora_entrada: horaEntrada || null,
      hora_salida: horaSalida || null,
      horas_ordinarias: horas.horas_ordinarias,
      horas_extra_diurnas: horas.horas_extra_diurnas,
      horas_extra_nocturnas: horas.horas_extra_nocturnas,
      horas_nocturnas: horas.horas_nocturnas,
      horas_festivo: horas.horas_festivo,
      es_festivo: horas.es_festivo,
      novedad: datos.novedad !== undefined ? datos.novedad : registro.novedad,
      tipo_dia: datos.tipo_dia !== undefined ? datos.tipo_dia : registro.tipo_dia,
      aprobado_por: usuario.sub,
    });
    return RegistrosModel.obtenerPorId(empresaId, id);
  },

  // ── Marcaje en tiempo real ───────────────────────────────────────────────

  /** Returns the worker's nomina profile: tipo_marcacion, punto_marcaje, salario_base. */
  async obtenerMiPerfil(empresaId, usuarioId) {
    const trabajador = await TrabajadoresModel.obtenerPorUsuarioId(empresaId, usuarioId);
    if (!trabajador) {
      throw new AppError('Tu usuario no está vinculado a un trabajador activo', 403);
    }

    const [puntoMarcaje, puntosZonales, empresa, cargos] = await Promise.all([
      trabajador.punto_marcaje_id
        ? PuntosMarcajeModel.obtenerPorId(empresaId, trabajador.punto_marcaje_id)
        : Promise.resolve(null),
      trabajador.tipo_marcacion === 'zonal'
        ? PuntosMarcajeModel.listarZonales(empresaId)
        : Promise.resolve([]),
      EmpresasModel.obtenerDetalle(empresaId),
      TrabajadoresModel.listarCargos(trabajador.id),
    ]);

    return {
      id: trabajador.id,
      nombre: trabajador.nombre,
      apellido: trabajador.apellido,
      cargo: trabajador.cargo ?? null,
      empresa_nombre: empresa?.nombre ?? null,
      cargos,
      tipo_marcacion: trabajador.tipo_marcacion ?? 'libre',
      punto_marcaje: puntoMarcaje,
      puntos_zonales: puntosZonales,
      salario_base: trabajador.salario_base,
      acepta_extras: Boolean(trabajador.acepta_extras),
    };
  },

  /** Clock-in: creates or updates today's registro with hora_entrada = NOW(). */
  async marcarEntrada(empresaId, usuario, { latitud, longitud } = {}) {
    const trabajadorId = await resolverTrabajadorPropio(empresaId, usuario.sub);
    const trabajador   = await TrabajadoresModel.obtenerPorId(empresaId, trabajadorId);

    await validarGeofence(empresaId, trabajador, latitud, longitud);

    const hoy = hoyISO();
    let periodo = await PeriodosModel.obtenerAbiertoPorFecha(empresaId, hoy);
    // Si no hay período abierto, auto-crear según tipo_liquidacion de la empresa.
    if (!periodo) periodo = await PeriodosService.autoCrear(empresaId);
    if (!periodo) throw new AppError('No hay un período de nómina abierto para hoy', 409);

    const existing = await RegistrosModel.obtenerPorFecha(empresaId, trabajadorId, hoy);
    if (existing) {
      // Jornada en progreso — ya marcó entrada pero no salida.
      if (existing.hora_entrada && !existing.hora_salida) {
        throw new AppError('Ya marcaste tu entrada hoy', 409);
      }
      // Jornada completa — requiere solicitud de reingreso aprobada.
      if (existing.hora_entrada && existing.hora_salida) {
        const solicitud = await SolicitudesReingresoModel.obtenerActivaPorRegistro(empresaId, existing.id);
        if (!solicitud || solicitud.estado !== 'aprobado') {
          throw new AppError('El reingreso debe ser autorizado por el gestor', 403);
        }
        const reiniciado = await RegistrosModel.iniciarReingreso(empresaId, existing.id, ahoraHHMMSS());
        if (reiniciado === 0) throw new AppError('No se pudo iniciar el reingreso', 409);
        await SolicitudesReingresoModel.marcarUsada(solicitud.id);
        return RegistrosModel.obtenerPorId(empresaId, existing.id);
      }
      // Registro sin hora_entrada (edge case).
      const updated = await RegistrosModel.actualizarEntrada(empresaId, existing.id, ahoraHHMMSS());
      if (updated === 0) throw new AppError('Ya marcaste tu entrada hoy', 409);
      return RegistrosModel.obtenerPorId(empresaId, existing.id);
    }

    const id = await RegistrosModel.crearConEntrada(empresaId, {
      trabajador_id: trabajadorId,
      periodo_id: periodo.id,
      fecha: hoy,
      hora_entrada: ahoraHHMMSS(),
    });
    return RegistrosModel.obtenerPorId(empresaId, id);
  },

  /** Clock-out: sets hora_salida = NOW() and recalculates hours. */
  async marcarSalida(empresaId, usuario, registroId, { latitud, longitud } = {}) {
    const trabajadorId = await resolverTrabajadorPropio(empresaId, usuario.sub);

    const registro = await RegistrosModel.obtenerPorId(empresaId, registroId);
    if (!registro) throw new AppError('Registro no encontrado', 404);
    if (registro.trabajador_id !== trabajadorId) throw new AppError('No autorizado', 403);
    if (!registro.hora_entrada) throw new AppError('No hay entrada registrada para hoy', 409);
    if (registro.hora_salida)   throw new AppError('Ya marcaste tu salida para hoy', 409);

    const trabajador = await TrabajadoresModel.obtenerPorId(empresaId, trabajadorId);
    await validarGeofence(empresaId, trabajador, latitud, longitud);

    const periodo = await PeriodosModel.obtenerPorId(empresaId, registro.periodo_id);
    if (periodo.estado !== 'abierto') {
      throw new AppError('El período ya está cerrado', 409);
    }

    // Contexto semanal: horas ordinarias y extras ya registradas esta semana (lunes–ayer)
    const lunes = getLunesDeSemana(registro.fecha);
    const { ordinarias: ordinariasAcum, extras: extrasAcum } =
      await RegistrosModel.sumarOrdinariasEnSemana(empresaId, trabajadorId, lunes, registro.fecha);

    const horaSalida = ahoraHHMMSS();

    // En sesiones > 1 los horas_* del registro ya contienen los totales de sesiones previas.
    // Se incluyen en el acumulador para que calcularHoras clasifique esta sesión correctamente
    // (si la sesión 1 agotó las ordinarias semanales, la 2 debe contar como extras).
    const ordinariasBase = ordinariasAcum +
      (registro.sesiones > 1
        ? Number(registro.horas_ordinarias) + Number(registro.horas_nocturnas)
        : 0);

    const horasSesion = calcularHoras({
      horaEntrada: registro.hora_entrada,
      horaSalida,
      fecha: registro.fecha,
      horasOrdinariasAcumuladas: ordinariasBase,
    });

    // Totales del día = sesiones previas + esta sesión.
    const horas = registro.sesiones > 1
      ? {
          horas_ordinarias:      Number(registro.horas_ordinarias)      + horasSesion.horas_ordinarias,
          horas_extra_diurnas:   Number(registro.horas_extra_diurnas)   + horasSesion.horas_extra_diurnas,
          horas_extra_nocturnas: Number(registro.horas_extra_nocturnas) + horasSesion.horas_extra_nocturnas,
          horas_nocturnas:       Number(registro.horas_nocturnas)       + horasSesion.horas_nocturnas,
          horas_festivo:         Number(registro.horas_festivo)         + horasSesion.horas_festivo,
          es_festivo:            horasSesion.es_festivo,
        }
      : horasSesion;

    const updated = await RegistrosModel.actualizarSalida(empresaId, registroId, {
      hora_salida: horaSalida,
      ...horas,
    });
    if (updated === 0) throw new AppError('Ya marcaste tu salida para hoy', 409);

    // Descanso compensatorio automático si es festivo o domingo (Art. 179 CST)
    await CompensatoriosService.crearSiCorresponde(empresaId, {
      trabajadorId,
      periodoId: registro.periodo_id,
      fecha: registro.fecha,
      esFestivo: Boolean(horas.es_festivo),
      registroId,
    });

    const registroFinal = await RegistrosModel.obtenerPorId(empresaId, registroId);

    // Advertencia de horas extra semanales
    const totalExtras = extrasAcum + horas.horas_extra_diurnas + horas.horas_extra_nocturnas;
    let advertencia = null;
    if (totalExtras > HORAS_EXTRA_MAX_SEMANA) {
      advertencia = `Superaste el límite de ${HORAS_EXTRA_MAX_SEMANA} h extra esta semana (total: ${totalExtras.toFixed(1)} h).`;
    } else if (totalExtras >= HORAS_EXTRA_MAX_SEMANA - 2) {
      advertencia = `Te quedan ${(HORAS_EXTRA_MAX_SEMANA - totalExtras).toFixed(1)} h extra disponibles esta semana.`;
    }

    return { ...registroFinal, advertencia };
  },
  // ── Reingreso ────────────────────────────────────────────────────────────

  /** Trabajador solicita un segundo ingreso al día; queda pendiente de aprobación. */
  async solicitarReingreso(empresaId, usuario, { motivo } = {}) {
    const trabajadorId = await resolverTrabajadorPropio(empresaId, usuario.sub);

    const registro = await RegistrosModel.obtenerPorFecha(empresaId, trabajadorId, hoyISO());
    if (!registro?.hora_salida) {
      throw new AppError('Solo puedes solicitar reingreso después de marcar la salida', 409);
    }

    const activa = await SolicitudesReingresoModel.obtenerActivaPorRegistro(empresaId, registro.id);
    if (activa) {
      throw new AppError('Ya tienes una solicitud de reingreso pendiente o aprobada', 409);
    }

    const id = await SolicitudesReingresoModel.crear(empresaId, registro.id, trabajadorId, motivo);

    // Notificar a gestores de nómina.
    const trabajador = await TrabajadoresModel.obtenerPorId(empresaId, trabajadorId);
    const [gestores] = await pool.query(
      `SELECT id FROM usuarios WHERE empresa_id = ? AND rol IN ('jefe_nomina','admin_empresa','nomina') AND activo = 1`,
      [empresaId]
    );
    if (gestores.length > 0) {
      await NotificacionesService.notificarVarios(gestores.map((g) => g.id), {
        empresaId,
        tipo: 'reingreso.solicitado',
        titulo: 'Solicitud de reingreso',
        mensaje: `${trabajador.nombre} ${trabajador.apellido} solicita reingreso para hoy.`,
        data: { solicitud_id: id, registro_id: registro.id },
      }).catch(() => {});
    }

    return { id, registro_id: registro.id };
  },

  async listarReingresosPendientes(empresaId) {
    return SolicitudesReingresoModel.listarPendientes(empresaId);
  },

  async aprobarReingreso(empresaId, gestorId, solicitudId) {
    if (!await SolicitudesReingresoModel.aprobar(empresaId, solicitudId, gestorId))
      throw new AppError('Solicitud no encontrada o ya fue procesada', 404);
    await _notificarDecisionReingreso(empresaId, solicitudId,
      'reingreso.aprobado', 'Reingreso aprobado',
      'Tu solicitud de reingreso fue aprobada. Ya puedes marcar tu entrada.');
  },

  async rechazarReingreso(empresaId, gestorId, solicitudId) {
    if (!await SolicitudesReingresoModel.rechazar(empresaId, solicitudId, gestorId))
      throw new AppError('Solicitud no encontrada o ya fue procesada', 404);
    await _notificarDecisionReingreso(empresaId, solicitudId,
      'reingreso.rechazado', 'Reingreso no autorizado',
      'Tu solicitud de reingreso fue rechazada por el gestor.');
  },
};

module.exports = RegistrosService;
