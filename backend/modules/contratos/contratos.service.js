'use strict';

const ContratosModel = require('./contratos.model');
const IntegracionService = require('../integracion/integracion.service');
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
    // Agrega a través de todas las empresas activas del usuario — un
    // trabajador_turnos marketplace puede tener fila de trabajador en más de
    // una, y resolver "la" empresa antes de consultar escondía las demás.
    return ContratosModel.listarPorUsuario(usuario.sub);
  },

  async generarSiNoExiste(empresaId, asignacionId, usuario) {
    // empresaId puede ser null (TRABAJADOR_TURNOS multi-empresa) — el modelo
    // ya soporta buscar sin acotar por empresa cuando es null.
    let contrato = await ContratosModel.obtenerPorAsignacion(empresaId, asignacionId);
    if (contrato) {
      verificarAcceso(contrato, usuario);
      return contrato;
    }

    // Si no existe, obtener asignación con detalles (trae su propio empresa_id
    // real — no hay que adivinarlo resolviendo un trabajador de antemano).
    const AsignacionesModel = require('../turnos/asignaciones/asignaciones.model');
    const asignacion = await AsignacionesModel.obtenerConDetalles(empresaId, asignacionId);
    if (!asignacion) throw new AppError('Asignación no encontrada', 404);

    if (usuario.rol === ROLES.TRABAJADOR_TURNOS && asignacion.usuario_id !== usuario.sub) {
      throw new AppError('No tienes permiso para generar este contrato', 403);
    }

    contrato = await ContratosService.generarParaAsignacion(asignacion.empresa_id, asignacionId);
    verificarAcceso(contrato, usuario);
    return contrato;
  },

  /**
   * Crea el contrato diario de una asignación si aún no existe. A diferencia
   * de generarSiNoExiste, no requiere un `usuario` que la solicite: la usan
   * los flujos internos (marcarEgreso, corregir, cierre masivo) que completan
   * una asignación sin que el trabajador haya abierto antes el detalle del
   * turno — sin esto, el contrato nunca se creaba y el turno no aparecía en
   * "sin firmar" pese a estar completado.
   */
  async generarParaAsignacion(empresaId, asignacionId) {
    let contrato = await ContratosModel.obtenerPorAsignacion(empresaId, asignacionId);
    if (contrato) return contrato;

    const AsignacionesModel = require('../turnos/asignaciones/asignaciones.model');
    const asignacion = await AsignacionesModel.obtenerConDetalles(empresaId, asignacionId);
    if (!asignacion) throw new AppError('Asignación no encontrada', 404);

    // Validar salario mínimo
    validarSalarioMinimo(asignacion.tarifa_dia);

    // Obtener tipo de contrato de la empresa (guarda 'laboral'/'prestacion_servicios'
    // en minúscula; contratos_diarios.tipo_contrato espera 'LABORAL'/'PRESTACION_SERVICIOS')
    const tipoContratoEmpresa = await EmpresasModel.obtenerTipoContrato(empresaId);
    const tipoContrato = tipoContratoEmpresa.toUpperCase();

    // Auditoría: verificar acumulación de contratos
    const cantidadContratos = await ContratosModel.contarPorTrabajadorUltimo12Meses(empresaId, asignacion.trabajador_id);

    let estadoAcumulacion = 'normal';
    let accionAuditoria = 'generacion_permitida';

    if (cantidadContratos >= CONTRATOS_ACUMULATIVOS_LIMITE) {
      // Bloquear generación si ya alcanzó el límite
      await ContratosModel.registrarAuditoria(empresaId, asignacion.trabajador_id, cantidadContratos, 'bloqueado', 'generacion_bloqueada');
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
    await ContratosModel.registrarAuditoria(empresaId, asignacion.trabajador_id, cantidadContratos, estadoAcumulacion, accionAuditoria);

    // Crear contrato con datos de la asignación
    const anio = asignacion.oferta_fecha.split('-')[0];
    const contratoId = await ContratosModel.crear(empresaId, {
      asignacionId,
      anio,
      fecha: asignacion.oferta_fecha,
      descripcionLabor: `${asignacion.cargo_nombre} - ${asignacion.oferta_titulo}`,
      valorDia: asignacion.tarifa_dia,
      tipoContrato,
      salarioMinimoValidado: true,
    });

    return ContratosModel.obtenerPorId(empresaId, contratoId);
  },

  async obtenerPorAsignacion(empresaId, asignacionId, usuario) {
    // empresaId puede ser null (TRABAJADOR_TURNOS multi-empresa) — el modelo
    // ya soporta buscar sin acotar por empresa cuando es null.
    const contrato = await ContratosModel.obtenerPorAsignacion(empresaId, asignacionId);
    if (!contrato) throw new AppError('Contrato no encontrado', 404);
    verificarAcceso(contrato, usuario);
    return contrato;
  },

  async obtener(empresaId, id, usuario) {
    const contrato = await ContratosModel.obtenerPorId(empresaId, id);
    if (!contrato) throw new AppError('Contrato no encontrado', 404);
    verificarAcceso(contrato, usuario);
    return contrato;
  },

  async firmar(empresaId, id, usuario, firmaB64) {
    const contrato = await ContratosModel.obtenerPorId(empresaId, id);
    if (!contrato) throw new AppError('Contrato no encontrado', 404);

    if (contrato.trabajador_usuario_id !== usuario.sub) {
      throw new AppError('Solo el trabajador del contrato puede firmarlo', 403);
    }
    if (contrato.firmado_trabajador) {
      throw new AppError('El contrato ya está firmado', 409);
    }
    // Empresa real del contrato (nunca adivinada) — necesaria para firmar()
    // y emitir() aunque el caller (TRABAJADOR_TURNOS) haya llegado con null.
    const realEmpresaId = contrato.empresa_id;
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

  async listarSinFirmar(empresaId, usuario) {
    // Agrega a través de todas las empresas activas del usuario (ver
    // listarMisContratos) — este es el bug reportado: un trabajador con
    // turnos en 2 empresas solo veía los de la que se resolvía por casualidad.
    return ContratosModel.listarSinFirmarPorUsuario(usuario.sub);
  },
};

module.exports = ContratosService;
