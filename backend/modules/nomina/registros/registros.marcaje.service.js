'use strict';

const RegistrosModel = require('./registros.model');
const SolicitudesReingresoModel = require('./solicitudes-reingreso.model');
const PeriodosModel = require('../periodos/periodos.model');
const PeriodosService = require('../periodos/periodos.service');
const TrabajadoresModel = require('../../trabajadores/trabajadores.model');
const PuntosMarcajeModel = require('../../puntos-marcaje/puntos-marcaje.model');
const EmpresasModel = require('../../empresas/empresas.model');
const CompensatoriosService = require('../compensatorios/compensatorios.service');
const NotificacionesService = require('../../notificaciones/notificaciones.service');
const NotificacionesModel = require('../../notificaciones/notificaciones.model');
const { ahoraColombiaSQL } = require('../../../utils/fechaColombia');
const { haversineMetros } = require('../../../utils/geoUtils');
const { buscarMatch, VENTANA_SEG: SOSPECHA_VENTANA_SEG } = require('../../../utils/marcajeSospechoso');
const AppError = require('../../../utils/AppError');
const { HORAS_EXTRA_MAX_SEMANA } = require('../../../config/constants');
const { contextoFestivo, horasDeSesionAbierta, resolverTrabajadorPropio, getLunesDeSemana, hoyISO, ahoraHHMMSS } = require('./registros.helpers');

/**
 * Marcaje del propio trabajador de nómina: perfil, entrada y salida (con geofence y detección de marcajes sospechosos).
 * Parte de RegistrosService (ver registros.service.js, que reúne los tres sub-services).
 */
const MS_POR_DIA = 24 * 3_600_000;

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

/**
 * Flags this registro (and any match found) as sospechoso — best-effort, never throws.
 * Solo dispara si se cumplen las DOS condiciones a la vez: mismo device_id Y
 * proximidad GPS. Si falta cualquiera de las dos, no hay suficiente señal.
 */
async function revisarMarcajeSospechoso(empresaId, registroId, trabajador, fecha, tipo, hora, latitud, longitud, deviceId) {
  if (latitud == null || longitud == null || deviceId == null) return;
  try {
    const cercanos = await RegistrosModel.listarMarcajesCercanos(
      empresaId, fecha, trabajador.id, tipo, hora, SOSPECHA_VENTANA_SEG
    );
    const match = buscarMatch(cercanos, { latitud, longitud, deviceId });
    if (!match) return;

    await RegistrosModel.marcarSospechoso(empresaId, [registroId, match.registro_id]);

    const otro = await TrabajadoresModel.obtenerPorId(empresaId, match.trabajador_id);
    const gestoresIds = await NotificacionesModel.idsGestoresNomina(empresaId);
    if (gestoresIds.length > 0) {
      await NotificacionesService.notificarVarios(gestoresIds, {
        empresaId,
        tipo: 'nomina.sospechoso',
        titulo: 'Posible marcaje fraudulento',
        mensaje: `${trabajador.nombre} ${trabajador.apellido} y ${otro?.nombre ?? 'otro trabajador'} ${otro?.apellido ?? ''} marcaron desde el mismo dispositivo — revisa sus registros.`,
        data: { registro_id: registroId, otro_registro_id: match.registro_id, trabajador_id: trabajador.id, otro_trabajador_id: match.trabajador_id },
      }).catch(() => {});
    }
  } catch {
    // best-effort: un fallo acá no debe impedir que el trabajador marque su entrada/salida.
  }
}

/** Returns yesterday's date as 'YYYY-MM-DD' in Colombia time. */
function ayerISO() {
  return ahoraColombiaSQL(-MS_POR_DIA).slice(0, 10);
}

const RegistrosMarcajeService = {
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
  async marcarEntrada(empresaId, usuario, { latitud, longitud, device_id: deviceId } = {}) {
    const trabajadorId = await resolverTrabajadorPropio(empresaId, usuario.sub);
    const trabajador   = await TrabajadoresModel.obtenerPorId(empresaId, trabajadorId);

    await validarGeofence(empresaId, trabajador, latitud, longitud);

    const hoy = hoyISO();
    const horaEntrada = ahoraHHMMSS();

    // Turno que cruza la medianoche: si el de ayer sigue abierto (entrada sin salida) y empezó
    // hace menos de 24 h, el trabajador todavía está en ese turno. Crear un registro nuevo para
    // hoy dejaría el de ayer sin salida para siempre — hay que cerrarlo primero. Más de 24 h
    // abierto es una salida olvidada: no se bloquea el nuevo ingreso, el gestor la corrige.
    // Las dos fechas son texto 'YYYY-MM-DD HH:MM:SS', así que se comparan como texto.
    const ayer = ayerISO();
    const abiertoAyer = await RegistrosModel.obtenerPorFecha(empresaId, trabajadorId, ayer);
    if (
      abiertoAyer?.hora_entrada && !abiertoAyer.hora_salida &&
      `${ayer} ${abiertoAyer.hora_entrada}` > ahoraColombiaSQL(-MS_POR_DIA)
    ) {
      throw new AppError(
        `Tienes una jornada abierta desde ayer a las ${abiertoAyer.hora_entrada.slice(0, 5)}. Marca su salida antes de ingresar.`,
        409
      );
    }

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
        const reiniciado = await RegistrosModel.iniciarReingreso(empresaId, existing.id, horaEntrada, latitud, longitud, deviceId);
        if (reiniciado === 0) throw new AppError('No se pudo iniciar el reingreso', 409);
        await SolicitudesReingresoModel.marcarUsada(solicitud.id);
        await revisarMarcajeSospechoso(empresaId, existing.id, trabajador, hoy, 'entrada', horaEntrada, latitud, longitud, deviceId);
        return RegistrosModel.obtenerPorId(empresaId, existing.id);
      }
      // Registro sin hora_entrada (edge case).
      const updated = await RegistrosModel.actualizarEntrada(empresaId, existing.id, horaEntrada, latitud, longitud, deviceId);
      if (updated === 0) throw new AppError('Ya marcaste tu entrada hoy', 409);
      await revisarMarcajeSospechoso(empresaId, existing.id, trabajador, hoy, 'entrada', horaEntrada, latitud, longitud, deviceId);
      return RegistrosModel.obtenerPorId(empresaId, existing.id);
    }

    const id = await RegistrosModel.crearConEntrada(empresaId, {
      trabajador_id: trabajadorId,
      periodo_id: periodo.id,
      fecha: hoy,
      hora_entrada: horaEntrada,
      latitud,
      longitud,
      deviceId,
    });
    await revisarMarcajeSospechoso(empresaId, id, trabajador, hoy, 'entrada', horaEntrada, latitud, longitud, deviceId);

    // Notifica a gestores de nómina que el trabajador marcó entrada (best-effort).
    const gestoresEntradaIds = await NotificacionesModel.idsGestoresNomina(empresaId);
    if (gestoresEntradaIds.length > 0) {
      await NotificacionesService.notificarVarios(gestoresEntradaIds, {
        empresaId,
        tipo: 'nomina.entrada',
        titulo: 'Entrada registrada',
        mensaje: `${trabajador.nombre} ${trabajador.apellido} marcó entrada.`,
        data: { registro_id: id, trabajador_id: trabajadorId },
      }).catch(() => {});
    }

    return RegistrosModel.obtenerPorId(empresaId, id);
  },

  /** Clock-out: sets hora_salida = NOW() and recalculates hours. */
  async marcarSalida(empresaId, usuario, registroId, { latitud, longitud, device_id: deviceId, jornada_continua: jornadaContinua } = {}) {
    const registro = await RegistrosModel.obtenerPorId(empresaId, registroId);
    if (!registro) throw new AppError('Registro no encontrado', 404);

    // Resuelve el trabajador DESDE el registro (registro.trabajador_id) y
    // compara usuario_id — no busca "cuál es mi trabajador en esta empresa"
    // por separado (resolverTrabajadorPropio), porque esa búsqueda puede
    // devolver una fila distinta si el usuario tiene más de una fila en
    // `trabajadores` para la misma empresa (la tabla no lo impide).
    const trabajador = await TrabajadoresModel.obtenerPorId(empresaId, registro.trabajador_id);
    if (!trabajador || trabajador.usuario_id !== usuario.sub) {
      throw new AppError('No autorizado', 403);
    }
    const trabajadorId = trabajador.id;
    if (!registro.hora_entrada) throw new AppError('No hay entrada registrada para hoy', 409);
    if (registro.hora_salida)   throw new AppError('Ya marcaste tu salida para hoy', 409);

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

    const { sumarNocturnasFestivo, clasificacion, recargoFestivo, numeroDiaFestivo } =
      await contextoFestivo(empresaId, trabajadorId, registro.fecha);
    const horas = horasDeSesionAbierta(registro, { horaSalida, jornadaContinua, ordinariasAcum, recargoFestivo, sumarNocturnasFestivo });

    const updated = await RegistrosModel.actualizarSalida(empresaId, registroId, {
      hora_salida: horaSalida,
      latitud,
      longitud,
      deviceId,
      ...horas,
      jornada_continua: Boolean(jornadaContinua),
      horas_acumuladas_semana: ordinariasAcum,
    });
    if (updated === 0) throw new AppError('Ya marcaste tu salida para hoy', 409);

    await revisarMarcajeSospechoso(empresaId, registroId, trabajador, registro.fecha, 'salida', horaSalida, latitud, longitud, deviceId);

    // Notifica a gestores de nómina que el trabajador marcó salida (best-effort).
    const gestoresSalidaIds = await NotificacionesModel.idsGestoresNomina(empresaId);
    if (gestoresSalidaIds.length > 0) {
      await NotificacionesService.notificarVarios(gestoresSalidaIds, {
        empresaId,
        tipo: 'nomina.salida',
        titulo: 'Salida registrada',
        mensaje: `${trabajador.nombre} ${trabajador.apellido} marcó salida.`,
        data: { registro_id: registroId, trabajador_id: trabajadorId },
      }).catch(() => {});
    }

    // Descanso compensatorio automático si es festivo o domingo (Art. 179 CST)
    await CompensatoriosService.crearSiCorresponde(empresaId, {
      trabajadorId,
      periodoId: registro.periodo_id,
      fecha: registro.fecha,
      esFestivo: Boolean(horas.es_festivo),
      registroId,
      clasificacion,
      numeroDiaFestivo,
      sumarNocturnasFestivo,
      tipoDia: 'ordinario', // marcarSalida() es siempre un día efectivamente trabajado
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
};

module.exports = RegistrosMarcajeService;
