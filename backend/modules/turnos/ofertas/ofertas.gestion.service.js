'use strict';

const { pool } = require('../../../config/database');
const OfertasModel = require('./ofertas.model');
const AsignacionesModel = require('../asignaciones/asignaciones.model');
const CargosModel = require('../../cargos/cargos.model');
const NotificacionesService = require('../../notificaciones/notificaciones.service');
const CostoLaborService = require('../../integracion/costo-labor.service');
const AppError = require('../../../utils/AppError');
const { ROLES, MAX_OFERTAS_ACTIVAS_POR_EMPRESA } = require('../../../config/constants');
const { ahoraColombiaSQL } = require('../../../utils/fechaColombia');

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

/**
 * Advierte (sin bloquear — el pool puede crecer o la oferta puede quedar
 * parcialmente cubierta) cuando un puesto pide más plazas que trabajadores
 * activos certificados para ese cargo hay en la empresa.
 */
async function advertenciasCapacidad(empresaId, puestos) {
  if (!Array.isArray(puestos) || puestos.length === 0) return [];
  const advertencias = [];
  for (const p of puestos) {
    const cargoId = Number(p.cargo_id);
    const plazas = Number(p.plazas);
    if (!plazas) continue;
    const disponibles = await CargosModel.contarActivosPorEmpresa(cargoId, empresaId);
    if (plazas > disponibles) {
      const cargo = await CargosModel.obtenerPorId(cargoId);
      advertencias.push(
        `"${cargo?.nombre ?? 'Cargo ' + cargoId}" pide ${plazas} plaza(s), pero tu empresa solo tiene ` +
        `${disponibles} trabajador(es) activo(s) certificado(s) para ese cargo.`
      );
    }
  }
  return advertencias;
}

/**
 * Valida los destinatarios elegidos a mano para un turno dirigido: debe haber
 * al menos uno y todos deben tener vínculo activo con la empresa. A propósito
 * NO se exige cargo certificado — el gestor eligiendo a la persona reemplaza
 * ese filtro (mismo criterio que asignarDirecto).
 */
async function validarDestinatarios(empresaId, visibilidad, trabajadorIds) {
  if (visibilidad !== 'dirigida') return;
  const ids = [...new Set((trabajadorIds || []).map(Number))];
  if (ids.length === 0) {
    throw new AppError('Elige al menos una persona para un turno dirigido', 400);
  }
  const [filas] = await pool.query(
    `SELECT t.id FROM trabajadores t
     JOIN trabajador_empresa te ON te.trabajador_id = t.id
     WHERE t.id IN (?) AND te.empresa_id = ? AND te.estado = 'activo'`,
    [ids, empresaId]
  );
  if (filas.length !== ids.length) {
    throw new AppError('Alguno de los trabajadores seleccionados no pertenece a esta empresa', 400);
  }
}

/**
 * Roles que deben recibir el aviso de una oferta según a quién va dirigida —
 * mismo criterio que OfertasService.listar() usa para filtrar qué puede ver
 * cada rol, para no avisarle a alguien de algo que después no puede abrir.
 */
function rolesParaAviso(paraQuien) {
  if (paraQuien === 'nomina') return [ROLES.TRABAJADOR_NOMINA];
  if (paraQuien === 'turnos') return [ROLES.TRABAJADOR_TURNOS];
  return [ROLES.TRABAJADOR_NOMINA, ROLES.TRABAJADOR_TURNOS]; // 'ambos'
}

/** Notifica a trabajadores con los cargos solicitados por la oferta (best-effort). */
async function notificarPoolPorPuestos(empresaId, oferta) {
  if (oferta.visibilidad === 'dirigida') {
    return notificarDestinatariosDirectos(empresaId, oferta);
  }
  const roles = rolesParaAviso(oferta.para_quien);
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
         AND u.activo      = 1
         AND u.rol IN (?)
         AND (u.rol != ? OR t.acepta_extras = 1)`,
      [empresaId, puesto.cargo_id, roles, ROLES.TRABAJADOR_NOMINA]
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

/** Notifica solo a los destinatarios elegidos a mano de un turno dirigido (best-effort). */
async function notificarDestinatariosDirectos(empresaId, oferta) {
  const destinatarios = oferta.destinatarios || [];
  const trabajadorIds = destinatarios.map((d) => d.trabajador_id).filter(Boolean);

  // Un trabajador_nomina sin acepta_extras no puede abrir la oferta (ver
  // validarAceptaExtras) aunque lo hayan elegido a mano — avisarle igual solo
  // lo lleva a un 403 sin explicación.
  let sinExtras = new Set();
  if (trabajadorIds.length > 0) {
    const [filas] = await pool.query(
      `SELECT t.id AS trabajador_id
       FROM trabajadores t
       JOIN usuarios u ON u.id = t.usuario_id
       WHERE t.id IN (?) AND u.rol = ? AND t.acepta_extras = 0`,
      [trabajadorIds, ROLES.TRABAJADOR_NOMINA]
    );
    sinExtras = new Set(filas.map((f) => f.trabajador_id));
  }

  const usuarioIds = destinatarios
    .filter((d) => !sinExtras.has(d.trabajador_id))
    .map((d) => d.usuario_id)
    .filter(Boolean);
  if (usuarioIds.length === 0) return;
  await NotificacionesService.notificarVarios(usuarioIds, {
    empresaId,
    tipo: 'oferta.nueva',
    titulo: `Te invitaron a un turno: ${oferta.titulo}`,
    mensaje: `${oferta.titulo} — ${oferta.fecha}. Te eligieron directamente para este turno.`,
    data: { oferta_id: oferta.id },
  });
}

/**
 * Fecha no pasada + hora_fin_estimada posterior a hora_inicio — mismo criterio
 * que validateStep1() en el mobile (apps/mobile/features/turnos/crear/utils.ts),
 * ahora también exigido en el backend para cerrar el hueco en web/API directa.
 */
function validarFechaHoraOferta({ fecha, hora_inicio, hora_fin_estimada }) {
  if (fecha && fecha < ahoraColombiaSQL().slice(0, 10)) {
    throw new AppError('La fecha del turno no puede ser en el pasado', 422);
  }
  if (hora_inicio && hora_fin_estimada && hora_fin_estimada <= hora_inicio) {
    throw new AppError('La hora de fin debe ser posterior a la hora de inicio', 422);
  }
}

/**
 * Ciclo de vida de la oferta (crear/editar/publicar/cancelar/completar/
 * eliminar/duplicar), gestionado por jefe_turnos/admin_empresa. Ver
 * ofertas.service.js para el resto de OfertasService.
 */
module.exports = {
  /**
   * Crea oferta + puestos en una sola transacción. El body recibe
   * `puestos: [{ cargo_id, plazas, tarifa_dia, notas? }]`. Si la oferta
   * viene de un canal externo (logiq360) puede llegar sin puestos —
   * el jefe los agrega antes de publicar.
   */
  async crear(empresaId, datos, creadoPor) {
    const activas = await OfertasModel.contarActivasPorEmpresa(empresaId);
    if (activas >= MAX_OFERTAS_ACTIVAS_POR_EMPRESA) {
      throw new AppError(
        `Llegaste al máximo de ${MAX_OFERTAS_ACTIVAS_POR_EMPRESA} ofertas activas. Cierra o cancela ofertas antiguas antes de crear nuevas.`,
        409
      );
    }
    await validarPuestosParaEmpresa(empresaId, datos.puestos);
    await validarDestinatarios(empresaId, datos.visibilidad, datos.trabajador_ids);
    const id = await OfertasModel.crear(empresaId, datos, creadoPor);
    const oferta = await OfertasModel.obtenerPorId(empresaId, id);

    await notificarPoolPorPuestos(empresaId, oferta);

    // No bloquea la creación — solo avisa al gestor si el catálogo de
    // trabajadores de la empresa no alcanza para cubrir lo pedido.
    oferta.advertencias = await advertenciasCapacidad(empresaId, datos.puestos);

    return oferta;
  },

  async actualizar(empresaId, id, datos) {
    const oferta = await OfertasModel.obtenerPorId(empresaId, id);
    if (!oferta) throw new AppError('Oferta no encontrada', 404);
    if (oferta.estado !== 'abierta' && oferta.estado !== 'borrador') {
      throw new AppError('Solo se puede editar una oferta en borrador o abierta', 409);
    }
    validarFechaHoraOferta({
      fecha: datos.fecha ?? oferta.fecha,
      hora_inicio: datos.hora_inicio ?? oferta.hora_inicio,
      hora_fin_estimada: datos.hora_fin_estimada !== undefined ? datos.hora_fin_estimada : oferta.hora_fin_estimada,
    });

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

  /**
   * Marca una oferta como completada a mano. El jefe/admin puede hacerlo en
   * cualquier momento del turno (no depende de que la fecha haya pasado ni de
   * que todas las asignaciones estén en estado terminal) — es una decisión
   * humana, no un cálculo automático.
   *
   * Si la oferta viene de logiq360 (external_ref) primero intenta el cierre
   * normal vía CostoLaborService, para no perder la emisión de
   * costo_labor.calculado cuando las condiciones ya se cumplen; si no se
   * cumplen (turno cerrado antes de que todos terminen), igual se fuerza el
   * estado — el jefe puede estar completando a propósito antes de tiempo.
   */
  async completar(empresaId, id) {
    const oferta = await OfertasModel.obtenerPorId(empresaId, id);
    if (!oferta) throw new AppError('Oferta no encontrada', 404);
    if (oferta.estado === 'cancelada') {
      throw new AppError('No se puede completar una oferta cancelada', 409);
    }
    if (oferta.estado === 'completada') return oferta;

    await CostoLaborService.verificarYEmitir(empresaId, id);
    const actualizada = await OfertasModel.obtenerPorId(empresaId, id);
    if (actualizada.estado !== 'completada') {
      await OfertasModel.cambiarEstado(empresaId, id, 'completada');
    }
    return OfertasModel.obtenerPorId(empresaId, id);
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

  async duplicar(empresaId, id, nuevaFecha, creadoPor) {
    const original = await OfertasModel.obtenerPorId(empresaId, id);
    if (!original) throw new AppError('Oferta no encontrada', 404);
    const activas = await OfertasModel.contarActivasPorEmpresa(empresaId);
    if (activas >= MAX_OFERTAS_ACTIVAS_POR_EMPRESA) {
      throw new AppError(
        `Llegaste al máximo de ${MAX_OFERTAS_ACTIVAS_POR_EMPRESA} ofertas activas. Cierra o cancela ofertas antiguas antes de crear nuevas.`,
        409
      );
    }
    const nuevaId = await OfertasModel.duplicar(empresaId, id, nuevaFecha, creadoPor);
    return OfertasModel.obtenerPorId(empresaId, nuevaId);
  },
};
