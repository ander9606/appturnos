'use strict';

const ContratosModel = require('./contratos.model');
const IntegracionService = require('../integracion/integracion.service');
const TrabajadoresService = require('../trabajadores/trabajadores.service');
const TrabajadoresModel = require('../trabajadores/trabajadores.model');
const AppError = require('../../utils/AppError');
const {
  ROLES,
  SALARIO_MINIMO_DIARIO_COP,
  CONTRATOS_ACUMULATIVOS_LIMITE,
  CONTRATOS_ACUMULATIVOS_ALERTA,
} = require('../../config/constants');
const EmpresasModel = require('../empresas/empresas.model');

function verificarAcceso(contrato, usuario) {
  if (
    usuario.rol === ROLES.TRABAJADOR_TURNOS &&
    contrato.trabajador_usuario_id !== usuario.sub
  ) {
    throw new AppError('No tienes acceso a este contrato', 403);
  }
}

function validarSalarioMinimo(valorDia) {
  if (valorDia < SALARIO_MINIMO_DIARIO_COP) {
    throw new AppError(
      `El salario diario debe ser mínimo $${SALARIO_MINIMO_DIARIO_COP.toLocaleString('es-CO')}. ` +
      `Propuesto: $${valorDia.toLocaleString('es-CO')}`,
      400
    );
  }
  return true;
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
    if (contrato) {
      verificarAcceso(contrato, usuario);
      return contrato;
    }

    // Si no existe, obtener asignación con detalles
    const AsignacionesModel = require('../turnos/asignaciones/asignaciones.model');
    const asignacion = await AsignacionesModel.obtenerConDetalles(realEmpresaId, asignacionId);

    if (!asignacion) throw new AppError('Asignación no encontrada', 404);

    // Verificar que el usuario es el trabajador asignado
    const t = await TrabajadoresService.resolverTrabajadorPorUsuario(realEmpresaId, usuario.sub);
    if (asignacion.trabajador_id !== t.id) {
      throw new AppError('No tienes permiso para generar este contrato', 403);
    }

    // Validar salario mínimo
    validarSalarioMinimo(asignacion.tarifa_dia);

    // Obtener tipo de contrato de la empresa
    const empresa = await EmpresasModel.obtenerPorId(realEmpresaId);
    const tipoContrato = empresa?.tipo_contrato || 'LABORAL';

    // Auditoría: verificar acumulación de contratos
    const cantidadContratos = await ContratosModel.contarPorTrabajadorUltimo12Meses(realEmpresaId, asignacion.trabajador_id);

    let estadoAcumulacion = 'normal';
    let accionAuditoria = 'generacion_permitida';

    if (cantidadContratos >= CONTRATOS_ACUMULATIVOS_LIMITE) {
      // Bloquear generación si ya alcanzó el límite
      await ContratosModel.registrarAuditoria(realEmpresaId, asignacion.trabajador_id, cantidadContratos, 'bloqueado', 'generacion_bloqueada');
      throw new AppError(
        `Este trabajador ha excedido el límite de ${CONTRATOS_ACUMULATIVOS_LIMITE} contratos en 12 meses. ` +
        `Se recomienda cambiar a contrato laboral indefinido para cumplir con ley colombiana.`,
        409
      );
    } else if (cantidadContratos >= CONTRATOS_ACUMULATIVOS_ALERTA) {
      estadoAcumulacion = 'alerta_50';
      accionAuditoria = 'advertencia_mostrada';
    }

    // Registrar auditoría
    await ContratosModel.registrarAuditoria(realEmpresaId, asignacion.trabajador_id, cantidadContratos, estadoAcumulacion, accionAuditoria);

    // Crear contrato con datos de la asignación
    const anio = asignacion.oferta_fecha.split('-')[0];
    const contratoId = await ContratosModel.crear(realEmpresaId, {
      asignacionId,
      anio,
      fecha: asignacion.oferta_fecha,
      descripcionLabor: `${asignacion.cargo_nombre} - ${asignacion.oferta_titulo}`,
      valorDia: asignacion.tarifa_dia,
      tipoContrato,
      salarioMinimoValidado: true,
    });

    // Retornar el contrato creado con verificación de acceso
    const contratoCreado = await ContratosModel.obtenerPorId(realEmpresaId, contratoId);
    verificarAcceso(contratoCreado, usuario);
    return contratoCreado;
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
