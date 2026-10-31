'use strict';

const EmpresasModel = require('./empresas.model');
const IntegracionModel = require('../integracion/integracion.model');
const PeriodosService = require('../nomina/periodos/periodos.service');
const RegistrosService = require('../nomina/registros/registros.service');
const AppError = require('../../utils/AppError');
const { DIAS_GRACIA_SUSCRIPCION } = require('../../config/constants');
const { PlanesModel, precioPlanCop, montoSuscripcionCop, MESES_ANUAL } = require('../suscripciones/planes.model');
const logger = require('../../utils/logger');

/** Fuente de verdad de "es logiq360": conexión activa con api_key, no una etiqueta manual. */
async function tieneIntegracionLogiq360Activa(empresaId) {
  return IntegracionModel.estaConectado(empresaId);
}

const EmpresasService = {
  async directorio({ busqueda, ciudad, page, limit }) {
    const offset = (page - 1) * limit;
    const { data, total } = await EmpresasModel.listarDirectorio({
      busqueda: busqueda || null,
      ciudad: ciudad || null,
      limit,
      offset,
    });
    return { data, pagination: { page, limit, total } };
  },

  async detalle(empresaId) {
    const empresa = await EmpresasModel.obtenerDetalle(empresaId);
    if (!empresa) throw new AppError('Empresa no encontrada', 404);
    return empresa;
  },

  async miEmpresa(empresaId) {
    const empresa = await EmpresasModel.obtenerParaAdmin(empresaId);
    if (!empresa) throw new AppError('Empresa no encontrada', 404);
    return empresa;
  },

  /** Auditoría legal de cambios a la firma del representante — solo admin_empresa (ver routes). */
  async historialFirma(empresaId) {
    return EmpresasModel.listarHistorialFirma(empresaId);
  },

  /** auditoria: { usuario_id, usuario_nombre, usuario_rol, ip } — ver controller. */
  async actualizarMiEmpresa(empresaId, datos, auditoria) {
    const { firma_representante_b64, ...resto } = datos;
    const antes = await EmpresasModel.obtenerParaAdmin(empresaId);
    if (Object.keys(resto).length > 0) {
      await EmpresasModel.actualizarPorAdmin(empresaId, resto);
    }
    // Aparte: se cifra y audita (quién/cuándo/desde dónde), nunca pasa por la
    // allowlist genérica de arriba.
    if (firma_representante_b64 !== undefined) {
      await EmpresasModel.actualizarFirmaConAuditoria(empresaId, firma_representante_b64, auditoria);
    }
    const empresa = await EmpresasModel.obtenerParaAdmin(empresaId);

    // Pasar a 'sin recargos' queda registrado: quién lo hizo y cuándo (evidencia del aviso aceptado).
    if (datos.sumar_nocturnas_festivo === 0 && antes && Number(antes.sumar_nocturnas_festivo) === 1) {
      await EmpresasModel.registrarAvisoRecargos(empresaId, auditoria.usuario_id);
    }

    // El ciclo (tipo_liquidacion) es lo que determina los límites de cada
    // período — si cambia, un período ya abierto con las fechas del ciclo
    // viejo queda desactualizado. Se cierra con lo acumulado a la fecha
    // (snapshot, igual que un cierre normal) y se abre uno nuevo ya con el
    // ciclo nuevo. Best-effort: un fallo acá no debe tumbar la actualización
    // de los datos de la empresa, que ya se guardaron.
    if (
      datos.tipo_liquidacion !== undefined &&
      antes &&
      datos.tipo_liquidacion !== antes.tipo_liquidacion
    ) {
      await PeriodosService.recalcularPorCambioDeCiclo(empresaId, auditoria.usuario_id)
        .catch((err) => logger.error(`[empresas] no se pudo recalcular el período tras cambiar tipo_liquidacion (empresa ${empresaId}):`, err.message));
    }

    return empresa;
  },

  /** Reprocesa el período abierto con la configuración de recargos actual — ver RegistrosService.reprocesarPeriodoAbierto. */
  async reprocesarRecargos(empresaId, usuario) {
    return RegistrosService.reprocesarPeriodoAbierto(empresaId, usuario);
  },

  /**
   * `plan` opcional: el admin_empresa lo elige para ampliar (o reducir) su
   * plan. Sin plan, WompiService renueva el actual. Un plan cuyo tope no
   * admite los trabajadores activos se rechaza — pagaría por un plan que
   * lo bloquea al día siguiente.
   */
  async generarLinkPago(empresaId, { meses = 1, plan }) {
    const empresa = await EmpresasModel.obtenerParaPago(empresaId);
    if (!empresa) throw new AppError('Empresa no encontrada', 404);
    if (await tieneIntegracionLogiq360Activa(empresaId)) {
      throw new AppError('Esta empresa gestiona su suscripción a través de logiq360', 409);
    }
    if (plan) {
      const [planes, activos] = await Promise.all([
        PlanesModel.listar(), EmpresasModel.contarTrabajadoresActivos(empresaId),
      ]);
      const elegido = planes.find((p) => p.codigo === plan);
      if (!elegido) throw new AppError('Plan no encontrado', 404);
      if (elegido.max_trabajadores != null && activos > elegido.max_trabajadores) {
        throw new AppError(
          `El plan ${elegido.nombre} admite hasta ${elegido.max_trabajadores} trabajadores y tienes ${activos} activos`,
          422
        );
      }
    }
    const WompiService = require('../webhooks/wompi.service');
    return WompiService.generarLinkPago({ empresaId, nombreEmpresa: empresa.nombre, meses, plan });
  },

  async estadoSuscripcion(empresaId) {
    const e = await EmpresasModel.obtenerEstadoSuscripcion(empresaId);
    if (!e) throw new AppError('Empresa no encontrada', 404);
    const esLogiq360 = await tieneIntegracionLogiq360Activa(empresaId);
    const hoy = new Date();
    const vence = e.suscripcion_vigente_hasta ? new Date(e.suscripcion_vigente_hasta) : null;
    const limite = vence ? new Date(vence) : null;
    if (limite) limite.setDate(limite.getDate() + DIAS_GRACIA_SUSCRIPCION);
    const activa = esLogiq360 || !vence || limite >= hoy;
    const diasRestantes = vence ? Math.ceil((vence - hoy) / 86400000) : null;
    const [planes, activos] = await Promise.all([
      PlanesModel.listar(), EmpresasModel.contarTrabajadoresActivos(empresaId),
    ]);
    const actual = planes.find((p) => p.codigo === e.plan);
    const cambios = esLogiq360 ? {} : await require('../webhooks/wompi.service').cotizarCambiosPlan(empresaId, planes, activos);
    return {
      activa,
      plan: e.plan,
      vigente_hasta: e.suscripcion_vigente_hasta,
      dias_restantes: diasRestantes,
      dias_gracia: DIAS_GRACIA_SUSCRIPCION,
      origen: esLogiq360 ? 'logiq360' : 'directo',
      logiq360_conectado: esLogiq360,
      trabajadores_activos: activos,
      max_trabajadores: actual?.max_trabajadores ?? null,
      // Para la sección "Ampliar plan": precio que pagaría hoy con sus activos
      // y si el plan admite a todos sus trabajadores.
      planes: planes.map((p) => ({
        codigo: p.codigo,
        nombre: p.nombre,
        max_trabajadores: p.max_trabajadores,
        incluidos: p.incluidos,
        precio_adicional_cop: p.precio_adicional_cop,
        precio_mensual_cop: precioPlanCop(p, activos),
        precio_anual_cop: montoSuscripcionCop(p, activos, MESES_ANUAL),
        // Si sube de plan en plena vigencia: solo la diferencia, sin mover el vencimiento. null = paga el plan completo.
        precio_cambio_cop: cambios[p.codigo] ?? null,
        disponible: p.max_trabajadores == null || activos <= p.max_trabajadores,
      })),
    };
  },
};

module.exports = EmpresasService;
