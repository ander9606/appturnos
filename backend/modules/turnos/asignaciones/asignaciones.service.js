'use strict';

const AsignacionesModel = require('./asignaciones.model');
const TrabajadoresModel = require('../../trabajadores/trabajadores.model');
const PuntosMarcajeModel = require('../../puntos-marcaje/puntos-marcaje.model');
const { pool } = require('../../../config/database');
const NotificacionesService = require('../../notificaciones/notificaciones.service');
const IntegracionService = require('../../integracion/integracion.service');
const CostoLaborService = require('../../integracion/costo-labor.service');
const AppError = require('../../../utils/AppError');
const { estaEnAlgunPunto } = require('../../../utils/geoUtils');
const { calcularHoras } = require('../../../utils/laboralUtils');

const DIAS   = ['dom','lun','mar','mié','jue','vie','sáb'];
const MESES  = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

/** Formatea "YYYY-MM-DD" → "lun 5 jun" */
function fmtFechaCorta(isoDate) {
  const d = new Date(`${isoDate}T00:00:00`);
  return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`;
}

/** Resuelve el trabajador vinculado al usuario autenticado. */
async function resolverTrabajador(empresaId, usuarioId) {
  const trabajador = await TrabajadoresModel.obtenerPorUsuarioId(empresaId, usuarioId);
  if (!trabajador) {
    throw new AppError('Tu usuario no está vinculado a un trabajador activo', 403);
  }
  return trabajador;
}

const AsignacionesService = {
  async obtener(empresaId, id, usuario) {
    const asignacion = await AsignacionesModel.obtenerConDetalles(empresaId, id);
    if (!asignacion) throw new AppError('Asignación no encontrada', 404);
    // Workers can only view their own asignaciones
    if (usuario?.rol === 'trabajador_turnos') {
      const trabajador = await TrabajadoresModel.obtenerPorUsuarioId(empresaId, usuario.sub);
      if (!trabajador || asignacion.trabajador_id !== trabajador.id) {
        throw new AppError('Asignación no encontrada', 404);
      }
    }
    return asignacion;
  },

  async listar(empresaId, { fecha, oferta_id, trabajador_id, estado, page, limit }) {
    const offset = (page - 1) * limit;
    const { data, total } = await AsignacionesModel.listar(empresaId, {
      fecha,
      ofertaId: oferta_id,
      trabajadorId: trabajador_id,
      estado,
      limit,
      offset,
    });
    return { data, pagination: { page, limit, total } };
  },

  async confirmar(empresaId, id) {
    // Para trabajadores_nomina: verificar que el turno no solape con jornada ya registrada.
    const asig = await AsignacionesModel.obtenerPorId(empresaId, id);
    if (asig) {
      const trabajador = await TrabajadoresModel.obtenerPorId(empresaId, asig.trabajador_id);
      if (trabajador?.rol === 'trabajador_nomina' || trabajador?.usuario_rol === 'trabajador_nomina') {
        // Obtener detalle de la oferta para hora_inicio / hora_fin_estimada
        const [[ofertaRow]] = await pool.query(
          `SELECT o.fecha, o.hora_inicio, o.hora_fin_estimada
           FROM asignaciones_turno a
           JOIN ofertas_turno o ON o.id = a.oferta_id
           WHERE a.id = ? AND a.empresa_id = ?`,
          [id, empresaId]
        );
        if (ofertaRow) {
          const horaFin = ofertaRow.hora_fin_estimada || '23:59:00';
          const [[solapado]] = await pool.query(
            `SELECT id FROM registros_diarios
             WHERE empresa_id = ? AND trabajador_id = ? AND fecha = ?
               AND hora_entrada IS NOT NULL
               AND hora_entrada < ? AND COALESCE(hora_salida,'23:59:00') > ?
             LIMIT 1`,
            [empresaId, asig.trabajador_id, ofertaRow.fecha, horaFin, ofertaRow.hora_inicio]
          );
          if (solapado) {
            throw new AppError('Conflicto con jornada laboral registrada para ese día y horario', 409);
          }
        }
      }
    }

    const res = await AsignacionesModel.confirmar(empresaId, id);
    if (!res.ok) {
      const errores = {
        no_existe: ['Asignación no encontrada', 404],
        estado:    ['La asignación no está pendiente de confirmación', 409],
        oferta:    ['La oferta ya no está disponible para confirmar', 409],
        lleno:     ['La oferta ya no tiene plazas disponibles', 409],
        traslape:  ['El trabajador ya tiene un turno confirmado en ese horario', 409],
      };
      const [mensaje, codigo] = errores[res.motivo];
      throw new AppError(mensaje, codigo);
    }

    // Retorno simple — siempre funciona
    const asignacion = await AsignacionesModel.obtenerPorId(empresaId, id);

    // Detalles para la notificación (JOINs opcionales — best-effort)
    const detalles  = await AsignacionesModel.obtenerConDetalles(empresaId, id).catch(() => null);
    const trabajador = await TrabajadoresModel.obtenerPorId(empresaId, asignacion.trabajador_id);

    if (detalles) {
      const fecha = fmtFechaCorta(detalles.oferta_fecha);
      const hora  = detalles.hora_inicio?.slice(0, 5) ?? '';
      const lugar = detalles.lugar ? ` · ${detalles.lugar}` : '';
      const cargo = detalles.cargo_nombre ? ` como ${detalles.cargo_nombre}` : '';
      await NotificacionesService.notificar({
        empresaId,
        usuarioId: trabajador?.usuario_id,
        tipo: 'postulacion.confirmada',
        titulo: 'Turno confirmado',
        mensaje: `Quedaste confirmado${cargo} en "${detalles.oferta_titulo}" el ${fecha} a las ${hora}${lugar}. ¡Recuerda llegar a tiempo!`,
        data: { asignacion_id: id, oferta_id: asignacion.oferta_id },
      });

      // Notifica a logiq360 que este trabajador confirmó participación en la orden.
      if (detalles.oferta_external_ref) {
        await IntegracionService.emitir(empresaId, 'asignacion.confirmada', {
          external_ref:  detalles.oferta_external_ref,
          empleado_ref:  detalles.trabajador_external_ref || null,
          nombre:        detalles.trabajador_nombre,
          apellido:      detalles.trabajador_apellido,
          rol:           detalles.cargo_codigo || 'operario',
        });
      }
    }

    return asignacion;
  },

  async cancelar(empresaId, id, gestorId) {
    const res = await AsignacionesModel.cancelar(empresaId, id, gestorId);
    if (!res.ok) {
      const errores = {
        no_existe: ['Asignación no encontrada', 404],
        estado: ['Solo se pueden cancelar asignaciones confirmadas', 409],
      };
      const [mensaje, codigo] = errores[res.motivo];
      throw new AppError(mensaje, codigo);
    }

    const asignacion = await AsignacionesModel.obtenerPorId(empresaId, id);
    const detalles   = await AsignacionesModel.obtenerConDetalles(empresaId, id).catch(() => null);
    const trabajador = await TrabajadoresModel.obtenerPorId(empresaId, asignacion.trabajador_id);

    if (detalles) {
      const fecha = fmtFechaCorta(detalles.oferta_fecha);
      await NotificacionesService.notificar({
        empresaId,
        usuarioId: trabajador?.usuario_id,
        tipo: 'asignacion.cancelada',
        titulo: 'Turno cancelado',
        mensaje: `Tu turno "${detalles.oferta_titulo}" el ${fecha} fue cancelado por la empresa. Revisa otras ofertas disponibles.`,
        data: { asignacion_id: id, oferta_id: asignacion.oferta_id },
      });

      if (detalles.oferta_external_ref) {
        await IntegracionService.emitir(empresaId, 'asignacion.cancelada', {
          external_ref: detalles.oferta_external_ref,
          empleado_ref: detalles.trabajador_external_ref || null,
        });
      }
    }

    return asignacion;
  },

  async rechazar(empresaId, id, gestorId) {
    const res = await AsignacionesModel.rechazar(empresaId, id, gestorId);
    if (!res.ok) {
      const errores = {
        no_existe: ['Asignación no encontrada', 404],
        estado: ['Solo se pueden rechazar postulaciones pendientes', 409],
      };
      const [mensaje, codigo] = errores[res.motivo];
      throw new AppError(mensaje, codigo);
    }

    const asignacion = await AsignacionesModel.obtenerPorId(empresaId, id);
    const detalles   = await AsignacionesModel.obtenerConDetalles(empresaId, id).catch(() => null);
    const trabajador = await TrabajadoresModel.obtenerPorId(empresaId, asignacion.trabajador_id);

    if (detalles) {
      const fecha = fmtFechaCorta(detalles.oferta_fecha);
      await NotificacionesService.notificar({
        empresaId,
        usuarioId: trabajador?.usuario_id,
        tipo: 'postulacion.rechazada',
        titulo: 'Postulación no aceptada',
        mensaje: `Tu postulación para "${detalles.oferta_titulo}" el ${fecha} no fue aceptada. Revisa otras ofertas disponibles.`,
        data: { asignacion_id: id, oferta_id: asignacion.oferta_id },
      });
    }

    return asignacion;
  },

  async marcarIngreso(empresaId, id, usuarioId, { latitud, longitud }) {
    const asignacion = await AsignacionesModel.obtenerConDetalles(empresaId, id);
    if (!asignacion) throw new AppError('Asignación no encontrada', 404);

    const trabajador = await resolverTrabajador(empresaId, usuarioId);
    if (asignacion.trabajador_id !== trabajador.id) {
      throw new AppError('Esta asignación no te pertenece', 403);
    }
    if (asignacion.estado !== 'confirmado') {
      throw new AppError('Solo puedes marcar ingreso en un turno confirmado', 409);
    }

    // Validación de geofence según tipo_geofence del cargo
    const gf = asignacion.geofence_info;
    if (gf.tipo === 'fijo' && gf.latitud != null) {
      const { ok } = estaEnAlgunPunto(latitud, longitud, [{
        latitud: gf.latitud, longitud: gf.longitud, radio_metros: gf.radio_metros,
      }]);
      if (!ok) {
        throw new AppError(
          `Debes estar en "${gf.nombre}" para registrar el ingreso`,
          422
        );
      }
    } else if (gf.tipo === 'zonal') {
      const puntos = await PuntosMarcajeModel.listarZonales(empresaId);
      if (puntos.length > 0) {
        const { ok } = estaEnAlgunPunto(latitud, longitud, puntos);
        if (!ok) {
          throw new AppError(
            'Debes estar en uno de los puntos zonales autorizados para registrar el ingreso',
            422
          );
        }
      }
    } else if (gf.tipo === 'oferta' && gf.latitud != null) {
      const { ok } = estaEnAlgunPunto(latitud, longitud, [{
        latitud: gf.latitud, longitud: gf.longitud, radio_metros: gf.radio_metros,
      }]);
      if (!ok) {
        throw new AppError(
          'Estás fuera del área de trabajo del turno',
          422
        );
      }
    }
    // tipo 'libre' → sin validación

    // Use empresa_id from the DB row — JWT empresa_id is null for marketplace workers.
    const dbEmpresaId = asignacion.empresa_id;

    await AsignacionesModel.registrarIngreso(dbEmpresaId, id, latitud, longitud);
    await IntegracionService.emitir(dbEmpresaId, 'trabajador.ingreso', {
      external_ref:  asignacion.oferta_external_ref || null,
      empleado_ref:  asignacion.trabajador_external_ref || null,
      asignacion_id: id,
      hora_ingreso:  new Date().toISOString(),
      latitud,
      longitud,
    });

    // Notifica a jefes de turno y admin que el trabajador marcó ingreso (best-effort).
    const [gestores] = await pool.query(
      `SELECT id FROM usuarios
       WHERE empresa_id = ? AND rol IN ('jefe_turnos', 'admin_empresa') AND activo = 1`,
      [dbEmpresaId]
    );
    if (gestores.length > 0) {
      await NotificacionesService.notificarVarios(
        gestores.map((g) => g.id),
        {
          empresaId: dbEmpresaId,
          tipo: 'turno.ingreso',
          titulo: 'Trabajador marcó ingreso',
          mensaje: `${trabajador.nombre} ${trabajador.apellido} registró su llegada al turno.`,
          data: { asignacion_id: id, oferta_id: asignacion.oferta_id },
        }
      );
    }

    return AsignacionesModel.obtenerPorId(dbEmpresaId, id);
  },

  async marcarEgreso(empresaId, id, usuarioId, { firma_b64 }) {
    // obtenerConDetalles handles null empresaId; obtenerPorId does not.
    const asignacion = await AsignacionesModel.obtenerConDetalles(empresaId, id);
    if (!asignacion) throw new AppError('Asignación no encontrada', 404);

    // Use empresa_id from the DB row — JWT empresa_id is null for marketplace workers.
    const dbEmpresaId = asignacion.empresa_id;

    const trabajador = await resolverTrabajador(empresaId, usuarioId);
    if (asignacion.trabajador_id !== trabajador.id) {
      throw new AppError('Esta asignación no te pertenece', 403);
    }
    if (asignacion.estado !== 'en_progreso') {
      throw new AppError('Debes marcar el ingreso antes de marcar la salida', 409);
    }

    const minutosTranscurridos = Math.floor((Date.now() - new Date(asignacion.hora_ingreso_real)) / 60_000);
    if (minutosTranscurridos < 1) {
      throw new AppError('Debes esperar al menos 1 minuto entre el ingreso y la salida', 422);
    }

    await AsignacionesModel.registrarEgreso(dbEmpresaId, id, firma_b64);
    await IntegracionService.emitir(dbEmpresaId, 'trabajador.egreso', {
      external_ref:  asignacion.oferta_external_ref || null,
      empleado_ref:  asignacion.trabajador_external_ref || null,
      asignacion_id: id,
      hora_egreso:   new Date().toISOString(),
    });
    // Si este egreso completó la oferta entera, emite costo_labor.calculado
    // a logiq360 y marca la oferta como completada (best-effort).
    await CostoLaborService.verificarYEmitir(dbEmpresaId, asignacion.oferta_id);
    return AsignacionesModel.obtenerPorId(dbEmpresaId, id);
  },

  /**
   * Asignación directa por gestor/admin: crea la asignación confirmada sin que el
   * trabajador tenga que postularse primero. Útil para cuadrar equipos rápido.
   */
  async asignarDirecto(empresaId, ofertaId, { puesto_id, trabajador_id }) {
    const res = await AsignacionesModel.asignarDirecto(empresaId, ofertaId, puesto_id, trabajador_id);
    if (!res.ok) {
      const errores = {
        oferta:    ['La oferta no está disponible para asignaciones', 409],
        puesto:    ['El puesto no pertenece a esta oferta', 400],
        lleno:     ['El puesto ya no tiene plazas disponibles', 409],
        traslape:  ['El trabajador ya tiene un turno confirmado en ese horario', 409],
        duplicado: ['El trabajador ya está asignado a este puesto', 409],
      };
      const [mensaje, codigo] = errores[res.motivo];
      throw new AppError(mensaje, codigo);
    }

    const asignacion = await AsignacionesModel.obtenerPorId(empresaId, res.asignacionId);
    const detalles   = await AsignacionesModel.obtenerConDetalles(empresaId, res.asignacionId).catch(() => null);
    const trabajador = await TrabajadoresModel.obtenerPorId(empresaId, trabajador_id);

    if (detalles) {
      const fecha = fmtFechaCorta(detalles.oferta_fecha);
      const hora  = detalles.hora_inicio?.slice(0, 5) ?? '';
      const lugar = detalles.lugar ? ` · ${detalles.lugar}` : '';
      const cargo = detalles.cargo_nombre ? ` como ${detalles.cargo_nombre}` : '';
      await NotificacionesService.notificar({
        empresaId,
        usuarioId: trabajador?.usuario_id,
        tipo: 'postulacion.confirmada',
        titulo: 'Turno asignado',
        mensaje: `Fuiste asignado${cargo} en "${detalles.oferta_titulo}" el ${fecha} a las ${hora}${lugar}. ¡Recuerda llegar a tiempo!`,
        data: { asignacion_id: res.asignacionId, oferta_id: ofertaId },
      });

      if (detalles.oferta_external_ref) {
        await IntegracionService.emitir(empresaId, 'asignacion.confirmada', {
          external_ref:  detalles.oferta_external_ref,
          empleado_ref:  detalles.trabajador_external_ref || null,
          nombre:        detalles.trabajador_nombre,
          apellido:      detalles.trabajador_apellido,
          rol:           detalles.cargo_codigo || 'operario',
        });
      }
    }

    return asignacion;
  },

  /**
   * Corrección manual de ingreso y/o egreso por jefe_turnos / admin_empresa.
   * No requiere GPS ni firma digital. Recalcula horas_trabajadas si ambos extremos están presentes.
   * Estados permitidos: confirmado, en_progreso, completado.
   */
  async corregir(empresaId, id, usuarioId, { hora_ingreso_real, hora_egreso_real }) {
    const asig = await AsignacionesModel.obtenerPorId(empresaId, id);
    if (!asig) throw new AppError('Asignación no encontrada', 404);
    if (!['confirmado', 'en_progreso', 'completado'].includes(asig.estado)) {
      throw new AppError('Solo se pueden corregir asignaciones confirmadas, en progreso o completadas', 409);
    }

    const horaIngreso = hora_ingreso_real !== undefined ? hora_ingreso_real : asig.hora_ingreso_real;
    const horaEgreso  = hora_egreso_real  !== undefined ? hora_egreso_real  : asig.hora_egreso_real;

    if (horaIngreso && horaEgreso && new Date(horaEgreso) <= new Date(horaIngreso)) {
      throw new AppError('La hora de egreso debe ser posterior al ingreso', 422);
    }

    let estadoNuevo;
    let horasTrabajadas;
    if (horaIngreso && horaEgreso) {
      estadoNuevo    = 'completado';
      horasTrabajadas = (new Date(horaEgreso) - new Date(horaIngreso)) / 3_600_000;
    } else if (horaIngreso) {
      estadoNuevo    = 'en_progreso';
      horasTrabajadas = null;
    } else {
      estadoNuevo    = 'confirmado';
      horasTrabajadas = null;
    }

    await AsignacionesModel.corregir(empresaId, id, { horaIngreso, horaEgreso, horasTrabajadas, estado: estadoNuevo });

    const resultado = await AsignacionesModel.obtenerConDetalles(empresaId, id);

    if (resultado?.oferta_external_ref) {
      await IntegracionService.emitir(empresaId, 'trabajador.correccion_horas', {
        external_ref:  resultado.oferta_external_ref,
        empleado_ref:  resultado.trabajador_external_ref || null,
        asignacion_id: id,
        hora_ingreso:  horaIngreso ?? null,
        hora_egreso:   horaEgreso  ?? null,
      });
    }

    if (estadoNuevo === 'completado') {
      await CostoLaborService.verificarYEmitir(empresaId, asig.oferta_id);
    }

    return resultado;
  },

  async marcarNoPresentado(empresaId, id) {
    const res = await AsignacionesModel.marcarNoPresentado(empresaId, id);
    if (!res.ok) {
      const errores = {
        no_existe: ['Asignación no encontrada', 404],
        estado:    ['Solo se puede marcar como no presentado una asignación confirmada o en progreso', 409],
      };
      const [mensaje, codigo] = errores[res.motivo];
      throw new AppError(mensaje, codigo);
    }

    const asignacion = await AsignacionesModel.obtenerConDetalles(empresaId, id);
    const trabajador = await TrabajadoresModel.obtenerPorId(empresaId, res.trabajador_id);

    if (trabajador) {
      await NotificacionesService.notificar({
        empresaId,
        usuarioId: trabajador.usuario_id,
        tipo: 'asignacion.no_presentado',
        titulo: 'Turno marcado como no presentado',
        mensaje: 'Fuiste marcado como no presentado en un turno. Esto impacta tu calificación y la visibilidad de futuras ofertas.',
        data: { asignacion_id: id, oferta_id: res.oferta_id },
      });
    }

    await IntegracionService.emitir(empresaId, 'trabajador.no_presentado', {
      external_ref: asignacion?.oferta_external_ref || null,
      empleado_ref: asignacion?.trabajador_external_ref || null,
      asignacion_id: id,
    });

    return asignacion;
  },

  async misTurnos(empresaId, usuarioId) {
    // trabajador_turnos tiene empresa_id = null en el JWT (multi-empresa).
    // Se localiza por usuario_id a través de trabajador_empresa.
    let asignaciones;
    if (!empresaId) {
      asignaciones = await AsignacionesModel.listarPorUsuario(usuarioId);
    } else {
      const trabajador = await resolverTrabajador(empresaId, usuarioId);
      asignaciones = await AsignacionesModel.listarPorTrabajador(empresaId, trabajador.id);
    }

    // Enrich completado shifts with Colombian labor-law hour breakdown.
    // mysql2 may return DATETIME as a Date object or a string; extractTime handles both.
    const extractTime = (dt) => {
      const s = dt instanceof Date ? dt.toISOString() : String(dt);
      return s.slice(11, 19); // 'HH:MM:SS'
    };

    return asignaciones.map((a) => {
      if (a.estado !== 'completado' || !a.hora_ingreso_real || !a.hora_egreso_real) {
        return a;
      }
      const desglose = calcularHoras({
        horaEntrada: extractTime(a.hora_ingreso_real),
        horaSalida:  extractTime(a.hora_egreso_real),
        fecha:       a.oferta_fecha,
      });
      return { ...a, ...desglose };
    });
  },

  async liquidacion(empresaId, { fecha_inicio, fecha_fin }) {
    return AsignacionesModel.liquidacion(empresaId, {
      fechaInicio: fecha_inicio,
      fechaFin:    fecha_fin,
    });
  },

  /**
   * Califica una asignación completada (1–5 estrellas). Actualiza el
   * ranking del trabajador y notifica al trabajador (best-effort).
   * Una asignación solo puede calificarse una vez.
   */
  async calificar(empresaId, id, usuario, { calificacion, comentario }) {
    const asignacion = await AsignacionesModel.obtenerPorId(empresaId, id);
    if (!asignacion) throw new AppError('Asignación no encontrada', 404);
    if (asignacion.estado !== 'completado') {
      throw new AppError('Solo se puede calificar una asignación completada', 409);
    }

    let resultado;
    try {
      resultado = await AsignacionesModel.calificar(empresaId, id, {
        trabajadorId: asignacion.trabajador_id,
        calificacion,
        comentario: comentario || null,
        calificadoPor: usuario.sub,
      });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        throw new AppError('Esta asignación ya fue calificada', 409);
      }
      throw err;
    }

    const trabajador = await TrabajadoresModel.obtenerPorId(empresaId, asignacion.trabajador_id);
    await NotificacionesService.notificar({
      empresaId,
      usuarioId: trabajador?.usuario_id,
      tipo: 'calificacion.recibida',
      titulo: 'Recibiste una calificación',
      mensaje: `Tu turno fue calificado con ${calificacion}/5 estrellas.`,
      data: { asignacion_id: id, calificacion },
    });

    return {
      asignacion_id: id,
      trabajador_id: asignacion.trabajador_id,
      ranking: resultado.ranking,
      total_calificaciones: resultado.total,
    };
  },
};

module.exports = AsignacionesService;
