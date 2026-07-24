'use strict';

const { pool } = require('../../../config/database');
const OfertasModel = require('./ofertas.model');
const PuestosModel = require('./puestos/puestos.model');
const AsignacionesModel = require('../asignaciones/asignaciones.model');
const TrabajadoresModel = require('../../trabajadores/trabajadores.model');
const TrabajadorEmpresaModel = require('../../trabajador-empresa/trabajador-empresa.model');
const CargosModel = require('../../cargos/cargos.model');
const NotificacionesService = require('../../notificaciones/notificaciones.service');
const AppError = require('../../../utils/AppError');
const { ROLES } = require('../../../config/constants');
const { delayPorRanking } = require('../../../utils/rankingUtils');

/**
 * Resuelve el trabajador vinculado al usuario autenticado en una empresa concreta.
 */
async function resolverTrabajador(empresaId, usuarioId) {
  const trabajador = await TrabajadoresModel.obtenerPorUsuarioId(empresaId, usuarioId);
  if (!trabajador) {
    throw new AppError('Tu usuario no está vinculado a un trabajador activo en esta empresa', 403);
  }
  return trabajador;
}

async function antiguedadMinima(empresaId, usuario) {
  if (usuario.rol !== ROLES.TRABAJADOR_TURNOS) return 0;
  const trabajador = await resolverTrabajador(empresaId, usuario.sub);
  return delayPorRanking(trabajador.ranking);
}

/** Valida que cada puesto del array tiene un cargo válido para la empresa. */
async function validarPuestosParaEmpresa(empresaId, puestos) {
  if (!Array.isArray(puestos) || puestos.length === 0) return;
  const ids = [...new Set(puestos.map((p) => Number(p.cargo_id)))];
  for (const id of ids) {
    const cargo = await CargosModel.obtenerPorId(id);
    if (!cargo) throw new AppError(`Cargo ${id} no encontrado`, 404);
    if (!cargo.activo) throw new AppError(`Cargo "${cargo.nombre}" está desactivado`, 409);
    if (cargo.empresa_id !== null && cargo.empresa_id !== empresaId) {
      throw new AppError(`Cargo "${cargo.nombre}" no pertenece a tu empresa`, 403);
    }
  }
  // Detectar duplicados (la UNIQUE (oferta_id, cargo_id) los rechazaría también,
  // pero damos un mensaje claro antes de la transacción).
  if (ids.length !== puestos.length) {
    throw new AppError('No puede haber dos puestos con el mismo cargo en una oferta', 400);
  }
}

/** Notifica a trabajadores con los cargos solicitados por la oferta (best-effort). */
async function notificarPoolPorPuestos(empresaId, oferta) {
  for (const puesto of oferta.puestos || []) {
    const [destinatarios] = await pool.query(
      `SELECT DISTINCT u.id AS usuario_id
       FROM trabajador_cargos tc
       JOIN trabajador_empresa te ON te.id = tc.trabajador_empresa_id
       JOIN trabajadores t        ON t.id  = te.trabajador_id
       JOIN usuarios u            ON u.id  = t.usuario_id
       WHERE te.empresa_id = ?
         AND tc.cargo_id   = ?
         AND te.estado     = 'activo'
         AND u.activo      = 1`,
      [empresaId, puesto.cargo_id]
    );
    if (destinatarios.length > 0) {
      await NotificacionesService.notificarVarios(
        destinatarios.map((d) => d.usuario_id),
        {
          empresaId,
          tipo: 'oferta.nueva',
          titulo: `Nueva oferta: ${puesto.cargo_nombre}`,
          mensaje: `${oferta.titulo} — ${oferta.fecha} — $${Number(puesto.tarifa_dia).toLocaleString('es-CO')}`,
          data: { oferta_id: oferta.id, puesto_id: puesto.id },
        }
      );
    }
  }
}

async function validarAceptaExtras(usuario) {
  if (usuario.rol !== ROLES.TRABAJADOR_NOMINA) return;
  const trabajador = await TrabajadoresModel.obtenerPorUsuarioId(null, usuario.sub);
  if (!trabajador || !trabajador.acepta_extras) {
    throw new AppError('No tienes activada la opción de turnos extra', 403);
  }
}

const OfertasService = {
  async listar(empresaId, usuario, { fecha, estado, disponibles, page, limit, paraQuien }, empresasActivas) {
    const offset = (page - 1) * limit;

    if (usuario.rol === ROLES.TRABAJADOR_NOMINA) {
      await validarAceptaExtras(usuario);
    }

    if (usuario.rol === ROLES.TRABAJADOR_TURNOS || usuario.rol === ROLES.TRABAJADOR_NOMINA) {
      const ids = empresasActivas && empresasActivas.length
        ? empresasActivas
        : await TrabajadorEmpresaModel.listarEmpresaIds(usuario.sub);

      // trabajador_nomina solo ve ofertas dirigidas a nómina, en su empresa actual
      const paraQuien = usuario.rol === ROLES.TRABAJADOR_NOMINA ? 'nomina' : 'turnos';
      const idsFiltered = usuario.rol === ROLES.TRABAJADOR_NOMINA ? [empresaId] : ids;

      const { data, total } = await OfertasModel.listarMultiEmpresa(usuario.sub, idsFiltered, {
        fecha, estado, disponibles, paraQuien, limit, offset,
      });
      return { data, pagination: { page, limit, total } };
    }

    const antiguedadMinMin = await antiguedadMinima(empresaId, usuario);
    const { data, total } = await OfertasModel.listar(empresaId, {
      fecha, estado, disponibles, antiguedadMinMin, paraQuien, limit, offset,
    });
    return { data, pagination: { page, limit, total } };
  },

  async obtener(empresaId, id, usuario, empresasActivas) {
    if (usuario.rol === ROLES.TRABAJADOR_NOMINA) {
      await validarAceptaExtras(usuario);
    }

    if (usuario.rol === ROLES.TRABAJADOR_TURNOS || usuario.rol === ROLES.TRABAJADOR_NOMINA) {
      // empresaId (req.empresa_id) es null para trabajadores multi-empresa — no sirve
      // para el fetch inicial, que debe resolver la empresa dueña de la oferta primero.
      const ofertaEmpresaId = await OfertasModel.obtenerEmpresaId(id);
      if (!ofertaEmpresaId) throw new AppError('Oferta no encontrada', 404);

      const ids = empresasActivas && empresasActivas.length
        ? empresasActivas
        : await TrabajadorEmpresaModel.listarEmpresaIds(usuario.sub);

      if (!ids.includes(ofertaEmpresaId)) {
        throw new AppError('Oferta no encontrada', 404);
      }
      const trabajador = await TrabajadoresModel.obtenerPorUsuarioId(ofertaEmpresaId, usuario.sub);
      const delay = delayPorRanking(trabajador?.ranking);
      const ofertaConDelay = await OfertasModel.obtenerPorId(ofertaEmpresaId, id, delay);
      if (!ofertaConDelay) {
        throw new AppError('Oferta aún no disponible para tu nivel de ranking', 403);
      }

      const asignaciones = await AsignacionesModel.listarPorOferta(ofertaEmpresaId, id);
      return { ...ofertaConDelay, asignaciones };
    }

    const antiguedadMinMin = await antiguedadMinima(empresaId, usuario);
    const oferta = await OfertasModel.obtenerPorId(empresaId, id, antiguedadMinMin);
    if (!oferta) throw new AppError('Oferta no encontrada', 404);
    const asignaciones = await AsignacionesModel.listarPorOferta(empresaId, id);
    return { ...oferta, asignaciones };
  },

  /**
   * Crea oferta + puestos en una sola transacción. El body recibe
   * `puestos: [{ cargo_id, plazas, tarifa_dia, notas? }]`. Si la oferta
   * viene de un canal externo (logiq360) puede llegar sin puestos —
   * el jefe los agrega antes de publicar.
   */
  async crear(empresaId, datos, creadoPor) {
    await validarPuestosParaEmpresa(empresaId, datos.puestos);
    const id = await OfertasModel.crear(empresaId, datos, creadoPor);
    const oferta = await OfertasModel.obtenerPorId(empresaId, id);

    await notificarPoolPorPuestos(empresaId, oferta);

    return oferta;
  },

  async actualizar(empresaId, id, datos) {
    const oferta = await OfertasModel.obtenerPorId(empresaId, id);
    if (!oferta) throw new AppError('Oferta no encontrada', 404);
    if (oferta.estado !== 'abierta' && oferta.estado !== 'borrador') {
      throw new AppError('Solo se puede editar una oferta en borrador o abierta', 409);
    }

    const camposCriticos = ['fecha', 'hora_inicio', 'hora_fin_estimada', 'lugar'];
    const hayCambioRelevante = camposCriticos.some(
      (k) => datos[k] !== undefined && String(datos[k] ?? '') !== String(oferta[k] ?? '')
    );

    await OfertasModel.actualizar(empresaId, id, datos);

    if (hayCambioRelevante) {
      const destinatarios = await AsignacionesModel.listarUsuariosAsignados(empresaId, id);
      await NotificacionesService.notificarVarios(destinatarios, {
        empresaId,
        tipo: 'oferta.modificada',
        titulo: 'Turno modificado',
        mensaje: `"${oferta.titulo}" fue actualizado. Revisa los cambios y confirma tu participación o cancela.`,
        data: { oferta_id: id },
      });
    }

    return OfertasModel.obtenerPorId(empresaId, id);
  },

  /**
   * Publica manualmente una oferta en 'borrador' (típicamente creada por
   * logiq360 vía orden.creada) para que sea visible al pool de trabajadores.
   * Normalmente esto lo dispara el evento orden.publicada de logiq360, pero
   * el jefe_turnos puede hacerlo a mano si logiq360 nunca lo envía o si
   * completó los puestos y quiere publicar antes.
   */
  async publicar(empresaId, id) {
    const oferta = await OfertasModel.obtenerPorId(empresaId, id);
    if (!oferta) throw new AppError('Oferta no encontrada', 404);
    if (oferta.estado !== 'borrador') {
      throw new AppError('Solo se puede publicar una oferta en borrador', 409);
    }
    if (!oferta.puestos || oferta.puestos.length === 0) {
      throw new AppError('Agrega al menos un puesto antes de publicar', 409);
    }

    await OfertasModel.cambiarEstado(empresaId, id, 'publicada');

    // Mismo criterio de notificación que crear() — necesario porque los puestos
    // de una oferta externa se agregan después de crearla y nunca dispararon esto.
    await notificarPoolPorPuestos(empresaId, oferta);

    return OfertasModel.obtenerPorId(empresaId, id);
  },

  async cancelar(empresaId, id) {
    const oferta = await OfertasModel.obtenerPorId(empresaId, id);
    if (!oferta) throw new AppError('Oferta no encontrada', 404);
    if (oferta.estado === 'cancelada') return;
    if (oferta.estado === 'completada') {
      throw new AppError('No se puede cancelar una oferta completada', 409);
    }

    const destinatarios = await AsignacionesModel.listarUsuariosAsignados(empresaId, id);
    await OfertasModel.cancelar(empresaId, id);

    await NotificacionesService.notificarVarios(destinatarios, {
      empresaId,
      tipo: 'oferta.cancelada',
      titulo: 'Turno cancelado',
      mensaje: `El turno "${oferta.titulo}" del ${oferta.fecha} fue cancelado.`,
      data: { oferta_id: id },
    });
  },

  /** Borra definitivamente una oferta cancelada que nunca tuvo postulantes (ej: se creó por error). */
  async eliminarDefinitivo(empresaId, id) {
    const oferta = await OfertasModel.obtenerPorId(empresaId, id);
    if (!oferta) throw new AppError('Oferta no encontrada', 404);
    if (oferta.estado !== 'cancelada') {
      throw new AppError('Solo se pueden eliminar ofertas canceladas.', 409);
    }
    const totalAsignaciones = await AsignacionesModel.contarPorOferta(empresaId, id);
    if (totalAsignaciones > 0) {
      throw new AppError('No se puede eliminar: esta oferta tuvo postulantes.', 409);
    }
    await OfertasModel.eliminarDefinitivo(empresaId, id);
  },

  /**
   * Postular al trabajador autenticado a un PUESTO específico de la oferta.
   * Valida que:
   *   - El puesto pertenece a la oferta y la empresa coincide.
   *   - La oferta es visible para este trabajador (ranking).
   *   - La oferta está abierta y el puesto aún tiene plazas.
   *   - El trabajador tiene el cargo del puesto CERTIFICADO por la empresa.
   *   - El trabajador no está ya postulado a ese puesto.
   */
  async aplicar(empresaId, ofertaId, puestoId, usuarioId, empresasActivas, usuario) {
    if (!puestoId) throw new AppError('puesto_id requerido para postular', 400);

    if (usuario && usuario.rol === ROLES.TRABAJADOR_NOMINA) {
      await validarAceptaExtras(usuario);
    }

    // Resolver empresa real de la oferta (multi-empresa para TRABAJADOR_TURNOS).
    let empresaOfertaId = empresaId;
    if (!empresaId) {
      const [[ofertaBase]] = await pool.query(
        'SELECT empresa_id FROM ofertas_turno WHERE id = ? LIMIT 1',
        [ofertaId]
      );
      if (!ofertaBase) throw new AppError('Oferta no encontrada', 404);
      empresaOfertaId = ofertaBase.empresa_id;

      const ids = empresasActivas && empresasActivas.length
        ? empresasActivas
        : await TrabajadorEmpresaModel.listarEmpresaIds(usuarioId);
      if (!ids.includes(empresaOfertaId)) {
        throw new AppError('Oferta no encontrada', 404);
      }
    }

    // Visibilidad (ranking) + apertura.
    // Use the JWT's empresaId (null for marketplace workers) so obtenerPorUsuarioId
    // finds the worker row that was created with empresa_id = null.
    const trabajador = await resolverTrabajador(empresaId, usuarioId);
    const oferta = await OfertasModel.obtenerPorId(
      empresaOfertaId,
      ofertaId,
      delayPorRanking(trabajador.ranking)
    );
    if (!oferta) throw new AppError('Oferta no encontrada o aún no disponible', 404);
    if (oferta.estado !== 'abierta' && oferta.estado !== 'publicada') {
      throw new AppError('La oferta no está abierta a postulaciones', 409);
    }
    const hoyBogota = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (oferta.fecha < hoyBogota) {
      throw new AppError('No puedes postularte a un turno que ya pasó', 409);
    }

    // Puesto existe y pertenece a la oferta.
    const puesto = oferta.puestos.find((p) => p.id === Number(puestoId));
    if (!puesto) throw new AppError('Puesto no encontrado en esta oferta', 404);
    if (puesto.plazas_cubiertas >= puesto.plazas) {
      throw new AppError('Este puesto ya no tiene plazas disponibles', 409);
    }

    // Cargo certificado por la empresa.
    const vinculo = await TrabajadorEmpresaModel.obtenerPorUsuarioEmpresa(
      usuarioId,
      empresaOfertaId
    );
    if (!vinculo || vinculo.estado !== 'activo') {
      throw new AppError('No tienes vínculo activo con esta empresa', 403);
    }
    const tieneCargo = await CargosModel.tieneAsignacion(vinculo.id, puesto.cargo_id);
    if (!tieneCargo) {
      throw new AppError(
        `No tienes el cargo "${puesto.cargo_nombre}" certificado por esta empresa`,
        403
      );
    }

    // Duplicado de postulación al MISMO puesto.
    const existente = await AsignacionesModel.obtenerPorPuestoYTrabajador(
      Number(puestoId),
      trabajador.id
    );
    if (existente) throw new AppError('Ya estás postulado a este puesto', 409);

    const id = await AsignacionesModel.crear(
      empresaOfertaId,
      ofertaId,
      Number(puestoId),
      trabajador.id
    );

    // Notifica a jefes de turno y admin que hay una postulación nueva (best-effort).
    const [gestores] = await pool.query(
      `SELECT id FROM usuarios
       WHERE empresa_id = ? AND rol IN ('jefe_turnos', 'admin_empresa') AND activo = 1`,
      [empresaOfertaId]
    );
    if (gestores.length > 0) {
      await NotificacionesService.notificarVarios(
        gestores.map((g) => g.id),
        {
          empresaId: empresaOfertaId,
          tipo: 'postulacion.nueva',
          titulo: 'Nueva postulación',
          mensaje: `${trabajador.nombre} ${trabajador.apellido} se postuló${puesto.cargo_nombre ? ` como ${puesto.cargo_nombre}` : ''} a "${oferta.titulo}".`,
          data: { asignacion_id: id, oferta_id: ofertaId },
        }
      );
    }

    return AsignacionesModel.obtenerPorId(empresaOfertaId, id);
  },

  async duplicar(empresaId, id, nuevaFecha, creadoPor) {
    const original = await OfertasModel.obtenerPorId(empresaId, id);
    if (!original) throw new AppError('Oferta no encontrada', 404);
    const nuevaId = await OfertasModel.duplicar(empresaId, id, nuevaFecha, creadoPor);
    return OfertasModel.obtenerPorId(empresaId, nuevaId);
  },

  /** Retira la postulación del trabajador autenticado de un puesto (si sigue pendiente). */
  async retirar(empresaId, ofertaId, puestoId, usuarioId, empresasActivas) {
    if (!puestoId) throw new AppError('puesto_id requerido', 400);

    let empresaOfertaId = empresaId;
    if (!empresaId) {
      const [[ofertaBase]] = await pool.query(
        'SELECT empresa_id FROM ofertas_turno WHERE id = ? LIMIT 1',
        [ofertaId]
      );
      if (!ofertaBase) throw new AppError('No estás postulado a esta oferta', 404);
      empresaOfertaId = ofertaBase.empresa_id;
    }

    const trabajador = await resolverTrabajador(empresaId, usuarioId);
    const asignacion = await AsignacionesModel.obtenerPorPuestoYTrabajador(
      Number(puestoId),
      trabajador.id
    );
    if (!asignacion) throw new AppError('No estás postulado a este puesto', 404);
    if (asignacion.estado !== 'pendiente') {
      throw new AppError(
        'No puedes retirar una postulación ya confirmada o en curso',
        409
      );
    }
    await AsignacionesModel.eliminar(empresaOfertaId, asignacion.id);
  },
};

module.exports = OfertasService;
