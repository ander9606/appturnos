'use strict';

const OfertasModel = require('./ofertas.model');
const AsignacionesModel = require('../asignaciones/asignaciones.model');
const TrabajadoresModel = require('../../trabajadores/trabajadores.model');
const TrabajadorEmpresaModel = require('../../trabajador-empresa/trabajador-empresa.model');
const AppError = require('../../../utils/AppError');
const { ROLES } = require('../../../config/constants');
const { delayPorRanking } = require('../../../utils/rankingUtils');
const { resolverTrabajador, validarAceptaExtras } = require('./ofertas.helpers');

async function antiguedadMinima(empresaId, usuario) {
  if (usuario.rol !== ROLES.TRABAJADOR_TURNOS) return 0;
  const trabajador = await resolverTrabajador(empresaId, usuario.sub);
  return delayPorRanking(trabajador.ranking);
}

/**
 * Lecturas de ofertas: listado y detalle, con las reglas de visibilidad
 * (ranking, dirigidas, multi-empresa) según el rol del solicitante. Ver
 * ofertas.service.js para el resto de OfertasService.
 */
module.exports = {
  async listar(empresaId, usuario, { fecha, fechaDesde, fechaHasta, estado, disponibles, page, limit, paraQuien }, empresasActivas) {
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
        fecha, fechaDesde, fechaHasta, estado, disponibles, paraQuien, limit, offset,
      });
      return { data, pagination: { page, limit, total } };
    }

    const antiguedadMinMin = await antiguedadMinima(empresaId, usuario);
    const { data, total } = await OfertasModel.listar(empresaId, {
      fecha, fechaDesde, fechaHasta, estado, disponibles, antiguedadMinMin, paraQuien, limit, offset,
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

      // Fetch sin delay primero: necesitamos saber la visibilidad antes de decidir
      // si aplica el delay por ranking (un destinatario directo lo salta).
      const ofertaBase = await OfertasModel.obtenerPorId(ofertaEmpresaId, id, 0);
      if (!ofertaBase) throw new AppError('Oferta no encontrada', 404);

      const esDestinatarioDirecto = ofertaBase.visibilidad === 'dirigida'
        && await OfertasModel.esDestinatario(id, trabajador?.id);
      if (ofertaBase.visibilidad === 'dirigida' && !esDestinatarioDirecto) {
        throw new AppError('Oferta no encontrada', 404);
      }

      let ofertaConDelay = ofertaBase;
      if (!esDestinatarioDirecto) {
        const delay = delayPorRanking(trabajador?.ranking);
        ofertaConDelay = delay > 0 ? await OfertasModel.obtenerPorId(ofertaEmpresaId, id, delay) : ofertaBase;
        if (!ofertaConDelay) {
          throw new AppError('Oferta aún no disponible para tu nivel de ranking', 403);
        }
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
};
