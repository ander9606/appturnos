'use strict';

const ContratosModel = require('./contratos.model');
const IntegracionService = require('../integracion/integracion.service');
const TrabajadoresService = require('../trabajadores/trabajadores.service');
const TrabajadoresModel = require('../trabajadores/trabajadores.model');
const AppError = require('../../utils/AppError');
const { ROLES } = require('../../config/constants');

function verificarAcceso(contrato, usuario) {
  if (
    usuario.rol === ROLES.TRABAJADOR_TURNOS &&
    contrato.trabajador_usuario_id !== usuario.sub
  ) {
    throw new AppError('No tienes acceso a este contrato', 403);
  }
}

const ContratosService = {
  async listarMisContratos(empresaId, usuario) {
    // empresaId puede ser null (TRABAJADOR_TURNOS multi-empresa) — se usa la
    // empresa real del trabajador resuelto, no la del token.
    const t = await TrabajadoresService.resolverTrabajadorPorUsuario(empresaId, usuario.sub);
    return ContratosModel.listarPorTrabajador(t.empresa_id, t.id);
  },

  async generarSiNoExiste(empresaId, asignacionId, usuario) {
    // empresaId puede ser null (TRABAJADOR_TURNOS multi-empresa)
    let realEmpresaId = empresaId;
    if (!realEmpresaId) {
      const t = await TrabajadoresService.resolverTrabajadorPorUsuario(null, usuario.sub);
      realEmpresaId = t.empresa_id;
    }

    // Verificar si ya existe
    let contrato = await ContratosModel.obtenerPorAsignacion(realEmpresaId, asignacionId);
    if (contrato) return contrato;

    // Si no existe, obtener asignación con detalles
    const AsignacionesModel = require('../turnos/asignaciones/asignaciones.model');
    const asignacion = await AsignacionesModel.obtenerConDetalles(realEmpresaId, asignacionId);

    if (!asignacion) throw new AppError('Asignación no encontrada', 404);

    // Crear contrato con datos de la asignación
    const anio = asignacion.oferta_fecha.split('-')[0];
    const contratoId = await ContratosModel.crear(realEmpresaId, {
      asignacionId,
      anio,
      fecha: asignacion.oferta_fecha,
      descripcionLabor: `${asignacion.cargo_nombre} - ${asignacion.oferta_titulo}`,
      valorDia: asignacion.tarifa_dia,
    });

    // Retornar el contrato creado
    return ContratosModel.obtenerPorId(realEmpresaId, contratoId);
  },

  async obtenerPorAsignacion(empresaId, asignacionId, usuario) {
    // empresaId puede ser null (TRABAJADOR_TURNOS multi-empresa) — se resuelve
    // la empresa real del trabajador para la consulta
    let realEmpresaId = empresaId;
    if (!realEmpresaId) {
      const t = await TrabajadoresService.resolverTrabajadorPorUsuario(null, usuario.sub);
      realEmpresaId = t.empresa_id;
    }
    const contrato = await ContratosModel.obtenerPorAsignacion(realEmpresaId, asignacionId);
    if (!contrato) throw new AppError('Contrato no encontrado', 404);
    verificarAcceso(contrato, usuario);
    return contrato;
  },

  async obtener(empresaId, id, usuario) {
    // empresaId puede ser null (TRABAJADOR_TURNOS multi-empresa)
    let realEmpresaId = empresaId;
    if (!realEmpresaId) {
      const t = await TrabajadoresService.resolverTrabajadorPorUsuario(null, usuario.sub);
      realEmpresaId = t.empresa_id;
    }
    const contrato = await ContratosModel.obtenerPorId(realEmpresaId, id);
    if (!contrato) throw new AppError('Contrato no encontrado', 404);
    verificarAcceso(contrato, usuario);
    return contrato;
  },

  async firmar(empresaId, id, usuario, firmaB64) {
    // empresaId puede ser null (TRABAJADOR_TURNOS multi-empresa)
    let realEmpresaId = empresaId;
    if (!realEmpresaId) {
      const t = await TrabajadoresService.resolverTrabajadorPorUsuario(null, usuario.sub);
      realEmpresaId = t.empresa_id;
    }
    let contrato = await ContratosModel.obtenerPorId(realEmpresaId, id);

    // Si el contrato no existe, intentar generarlo on-demand
    if (!contrato) {
      // Intenta obtener la asignación del contrato a través de la relación
      // (esto es fallback; lo ideal es que el cliente pase asignacionId)
      throw new AppError('Contrato no encontrado', 404);
    }

    if (contrato.trabajador_usuario_id !== usuario.sub) {
      throw new AppError('Solo el trabajador del contrato puede firmarlo', 403);
    }
    if (contrato.firmado_trabajador) {
      throw new AppError('El contrato ya está firmado', 409);
    }
    await ContratosModel.firmar(realEmpresaId, id, firmaB64);
    // Guarda la firma como atajo reutilizable para el próximo contrato (best-effort).
    await TrabajadoresModel.guardarFirma(contrato.trabajador_id, firmaB64).catch(() => null);
    await IntegracionService.emitir(realEmpresaId, 'contrato.completado', {
      contrato_id: id,
      asignacion_id: contrato.asignacion_id,
      numero_contrato: contrato.numero_contrato,
    });
    return ContratosModel.obtenerPorId(realEmpresaId, id);
  },
};

module.exports = ContratosService;
