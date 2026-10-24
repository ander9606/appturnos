'use strict';

const PuestosModel = require('./puestos.model');
const OfertasModel = require('../ofertas.model');
const CargosModel = require('../../../cargos/cargos.model');
const AsignacionesModel = require('../../asignaciones/asignaciones.model');
const TrabajadoresModel = require('../../../trabajadores/trabajadores.model');
const NotificacionesService = require('../../../notificaciones/notificaciones.service');
const AppError = require('../../../../utils/AppError');
const { ahoraColombiaSQL } = require('../../../../utils/fechaColombia');
const { HORAS_CORTE_EDICION_OFERTA } = require('../../../../config/constants');
const logger = require('../../../../utils/logger');

/**
 * Lógica para gestionar puestos (slots cargo+plazas+tarifa) de una oferta
 * después de que ya fue creada. La creación inicial de puestos se hace
 * desde `OfertasService.crear()` en la misma transacción que la oferta.
 *
 * Reglas:
 *   - Solo jefe_turnos/admin_empresa (resuelto en routes).
 *   - La oferta debe pertenecer a la empresa del usuario.
 *   - El cargo debe ser del sistema o de la empresa de la oferta.
 *   - No se puede eliminar un puesto con plazas_cubiertas > 0.
 *   - No se puede reducir `plazas` por debajo de `plazas_cubiertas`.
 */

async function cargarOfertaDeEmpresa(empresaId, ofertaId) {
  const oferta = await OfertasModel.obtenerPorId(empresaId, ofertaId);
  if (!oferta) throw new AppError('Oferta no encontrada', 404);
  return oferta;
}

async function cargarPuestoDeOferta(empresaId, ofertaId, puestoId) {
  const oferta = await cargarOfertaDeEmpresa(empresaId, ofertaId);
  const puesto = await PuestosModel.obtenerPorId(puestoId);
  if (!puesto || puesto.oferta_id !== oferta.id) {
    throw new AppError('Puesto no encontrado en esta oferta', 404);
  }
  return puesto;
}

async function validarCargoUtilizable(cargoId, empresaId) {
  const cargo = await CargosModel.obtenerPorId(cargoId);
  if (!cargo) throw new AppError('Cargo no encontrado', 404);
  if (!cargo.activo) throw new AppError('El cargo está desactivado', 409);
  if (cargo.empresa_id !== null && cargo.empresa_id !== empresaId) {
    throw new AppError('Este cargo no pertenece a tu empresa', 403);
  }
  return cargo;
}

/**
 * Advierte (sin bloquear) si `plazas` supera el número de trabajadores
 * activos certificados para el cargo en la empresa.
 */
async function advertenciaCapacidad(empresaId, cargoId, cargoNombre, plazas) {
  if (!plazas) return null;
  const disponibles = await CargosModel.contarActivosPorEmpresa(cargoId, empresaId);
  if (plazas <= disponibles) return null;
  return `"${cargoNombre}" pide ${plazas} plaza(s), pero tu empresa solo tiene ` +
    `${disponibles} trabajador(es) activo(s) certificado(s) para ese cargo.`;
}

/**
 * Cambiar `tarifa_dia` no puede aplicarse en silencio sobre alguien que ya
 * aceptó el turno con la tarifa anterior — mismo criterio que camposCriticos
 * en OfertasService.actualizar (fecha/hora/lugar): bloquea si alguien de este
 * puesto ya marcó ingreso, y devuelve a quien esté 'confirmado' para que
 * actualizar() lo pase a 'por_reconfirmar' y le avise, con el mismo margen de
 * HORAS_CORTE_EDICION_OFERTA para que pueda reaccionar a tiempo.
 */
async function confirmadosParaReconfirmarPorTarifa(empresaId, ofertaId, puestoId) {
  const asignaciones = (await AsignacionesModel.listarPorOferta(empresaId, ofertaId))
    .filter((a) => a.puesto_id === puestoId);

  const yaIniciado = asignaciones.some((a) => ['en_progreso', 'completado'].includes(a.estado));
  if (yaIniciado) {
    throw new AppError(
      'No puedes cambiar el valor de este puesto: ya hay alguien que marcó ingreso en este turno.',
      409
    );
  }

  const confirmados = asignaciones.filter((a) => a.estado === 'confirmado');
  if (confirmados.length > 0) {
    const oferta = await OfertasModel.obtenerPorId(empresaId, ofertaId);
    const inicio = `${oferta.fecha} ${oferta.hora_inicio}`;
    const limiteEdicion = ahoraColombiaSQL(HORAS_CORTE_EDICION_OFERTA * 3_600_000);
    if (inicio <= limiteEdicion) {
      throw new AppError(
        `No puedes cambiar el valor a menos de ${HORAS_CORTE_EDICION_OFERTA}h de que empiece el turno.`,
        409
      );
    }
  }
  return confirmados;
}

/** Pasa a 'por_reconfirmar' a quien ya estaba confirmado en el puesto cuya tarifa cambió, y le avisa. */
async function reconfirmarPorCambioDeTarifa(empresaId, puesto, confirmados) {
  for (const a of confirmados) {
    const res = await AsignacionesModel.marcarPorReconfirmar(empresaId, a.id);
    if (!res.ok) {
      logger.warn(`[puestos] no se pudo pasar a por_reconfirmar la asignación ${a.id} al editar la tarifa del puesto ${puesto.id}: ${res.motivo}`);
    }
  }

  const montoFmt = Number(puesto.tarifa_dia).toLocaleString('es-CO');
  for (const a of confirmados) {
    const usuarioId = await TrabajadoresModel.obtenerUsuarioId(a.trabajador_id);
    if (!usuarioId) continue;
    await NotificacionesService.notificar({
      empresaId,
      usuarioId,
      tipo: 'oferta.modificada',
      titulo: 'Cambió el pago de tu turno — reconfirma tu participación',
      mensaje: `El pago de "${puesto.cargo_nombre}" cambió a $${montoFmt}. Si quieres seguir, reconfirma o tu cupo quedará libre.`,
      data: { oferta_id: puesto.oferta_id, puesto_id: puesto.id },
    });
  }
}

const PuestosService = {
  async listar(empresaId, ofertaId) {
    await cargarOfertaDeEmpresa(empresaId, ofertaId);
    return PuestosModel.listarPorOferta(ofertaId);
  },

  async agregar(empresaId, ofertaId, { cargo_id, plazas, tarifa_dia, notas }) {
    await cargarOfertaDeEmpresa(empresaId, ofertaId);
    const cargo = await validarCargoUtilizable(cargo_id, empresaId);

    try {
      const id = await PuestosModel.crear({
        ofertaId,
        cargoId: cargo_id,
        plazas,
        tarifaDia: tarifa_dia,
        notas,
      });
      const puesto = await PuestosModel.obtenerPorId(id);
      puesto.advertencia = await advertenciaCapacidad(empresaId, cargo.id, cargo.nombre, Number(plazas));
      return puesto;
    } catch (err) {
      // UNIQUE (oferta_id, cargo_id): no dos puestos con mismo cargo en la misma oferta.
      if (err.code === 'ER_DUP_ENTRY') {
        throw new AppError('Esta oferta ya tiene un puesto para ese cargo', 409);
      }
      throw err;
    }
  },

  async actualizar(empresaId, ofertaId, puestoId, cambios) {
    const puesto = await cargarPuestoDeOferta(empresaId, ofertaId, puestoId);

    if (cambios.plazas !== undefined && cambios.plazas < puesto.plazas_cubiertas) {
      throw new AppError(
        `No se puede reducir plazas a ${cambios.plazas}: ya hay ${puesto.plazas_cubiertas} cubiertas`,
        409
      );
    }

    const cambiaTarifa = cambios.tarifa_dia !== undefined
      && Number(cambios.tarifa_dia) !== Number(puesto.tarifa_dia);
    const confirmados = cambiaTarifa
      ? await confirmadosParaReconfirmarPorTarifa(empresaId, ofertaId, puestoId)
      : [];

    const afectadas = await PuestosModel.actualizar(puestoId, cambios);
    if (afectadas === 0) throw new AppError('Nada que actualizar', 400);
    const actualizado = await PuestosModel.obtenerPorId(puestoId);

    if (confirmados.length > 0) {
      await reconfirmarPorCambioDeTarifa(empresaId, actualizado, confirmados);
    }
    if (cambios.plazas !== undefined) {
      actualizado.advertencia = await advertenciaCapacidad(
        empresaId, actualizado.cargo_id, actualizado.cargo_nombre, Number(cambios.plazas)
      );
    }
    return actualizado;
  },

  async eliminar(empresaId, ofertaId, puestoId) {
    const puesto = await cargarPuestoDeOferta(empresaId, ofertaId, puestoId);
    if (puesto.plazas_cubiertas > 0) {
      throw new AppError(
        'No se puede eliminar un puesto con plazas cubiertas. Cancela las asignaciones primero.',
        409
      );
    }
    await PuestosModel.eliminar(puestoId);
  },
};

module.exports = PuestosService;
