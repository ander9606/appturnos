'use strict';

const { pool } = require('../../../config/database');
const OfertasModel = require('./ofertas.model');
const AsignacionesModel = require('../asignaciones/asignaciones.model');
const TrabajadorEmpresaModel = require('../../trabajador-empresa/trabajador-empresa.model');
const CargosModel = require('../../cargos/cargos.model');
const NotificacionesService = require('../../notificaciones/notificaciones.service');
const AppError = require('../../../utils/AppError');
const { ROLES } = require('../../../config/constants');
const { delayPorRanking } = require('../../../utils/rankingUtils');
const { resolverTrabajador, validarAceptaExtras } = require('./ofertas.helpers');

/**
 * ¿Ya pasó la hora de inicio del turno? Compara contra la hora actual en
 * Bogotá (UTC-5, sin horario de verano). Antes solo se comparaba la fecha
 * (día), así que un turno de hoy con hora de inicio ya pasada seguía
 * aceptando postulaciones — mismo criterio que turnoYaInicio() en el mobile
 * (apps/mobile/features/turnos/turnosUtils.ts).
 */
function turnoYaInicio(fecha, horaInicio) {
  const [y, mo, d] = fecha.split('-').map(Number);
  const [hh, mm, ss] = String(horaInicio).split(':').map(Number);
  const nowBogota = new Date(Date.now() - 5 * 60 * 60 * 1000); // getUTC* == hora Bogotá
  const inicioBogotaMs = Date.UTC(y, mo - 1, d, hh, mm || 0, ss || 0);
  return nowBogota.getTime() >= inicioBogotaMs;
}

/**
 * Postulación y retiro del trabajador a un puesto de una oferta. Ver
 * ofertas.service.js para el resto de OfertasService.
 */
module.exports = {
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
    // Usa empresaOfertaId (ya resuelto arriba), no empresaId del JWT (null para
    // marketplace multi-empresa) — de lo contrario obtenerPorUsuarioId puede
    // devolver el trabajador de OTRA empresa vinculada (la más reciente), con
    // ranking distinto al de la empresa dueña de esta oferta. Mismo criterio
    // que OfertasConsultasService.obtener(), que ya usa ofertaEmpresaId correctamente.
    const trabajador = await resolverTrabajador(empresaOfertaId, usuarioId);

    // Fetch sin delay primero: necesitamos saber la visibilidad antes de decidir
    // si aplica el delay por ranking (un destinatario directo lo salta).
    const ofertaBase = await OfertasModel.obtenerPorId(empresaOfertaId, ofertaId, 0);
    if (!ofertaBase) throw new AppError('Oferta no encontrada', 404);

    const esDestinatarioDirecto = ofertaBase.visibilidad === 'dirigida'
      && await OfertasModel.esDestinatario(ofertaId, trabajador.id);
    if (ofertaBase.visibilidad === 'dirigida' && !esDestinatarioDirecto) {
      throw new AppError('Oferta no encontrada', 404);
    }

    let oferta = ofertaBase;
    if (!esDestinatarioDirecto) {
      const delay = delayPorRanking(trabajador.ranking);
      oferta = delay > 0 ? await OfertasModel.obtenerPorId(empresaOfertaId, ofertaId, delay) : ofertaBase;
      if (!oferta) throw new AppError('Oferta no encontrada o aún no disponible', 404);
    }
    if (oferta.estado !== 'abierta' && oferta.estado !== 'publicada') {
      throw new AppError('La oferta no está abierta a postulaciones', 409);
    }

    // Detectar si el turno ya comenzó — no bloquea, pero devuelve un aviso.
    const warnings = [];
    if (turnoYaInicio(oferta.fecha, oferta.hora_inicio)) {
      warnings.push('El turno ya empezó. Asegúrate de estar cerca para poder marcar ingreso.');
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
    // Si fue invitado a mano (destinatario directo) no se exige el cargo certificado —
    // el gestor eligiéndolo ya reemplaza ese filtro (mismo criterio que asignarDirecto).
    if (!esDestinatarioDirecto) {
      const tieneCargo = await CargosModel.tieneAsignacion(vinculo.id, puesto.cargo_id);
      if (!tieneCargo) {
        throw new AppError(
          `No tienes el cargo "${puesto.cargo_nombre}" certificado por esta empresa`,
          403
        );
      }
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

    const asignacion = await AsignacionesModel.obtenerPorId(empresaOfertaId, id);
    return warnings.length > 0 ? { ...asignacion, warnings } : asignacion;
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

    const trabajador = await resolverTrabajador(empresaOfertaId, usuarioId);
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
