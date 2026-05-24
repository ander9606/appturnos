'use strict';

const PuestosModel = require('./puestos.model');
const OfertasModel = require('../ofertas.model');
const CargosModel = require('../../../cargos/cargos.model');
const AppError = require('../../../../utils/AppError');

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

const PuestosService = {
  async listar(empresaId, ofertaId) {
    await cargarOfertaDeEmpresa(empresaId, ofertaId);
    return PuestosModel.listarPorOferta(ofertaId);
  },

  async agregar(empresaId, ofertaId, { cargo_id, plazas, tarifa_dia, notas }) {
    await cargarOfertaDeEmpresa(empresaId, ofertaId);
    await validarCargoUtilizable(cargo_id, empresaId);

    try {
      const id = await PuestosModel.crear({
        ofertaId,
        cargoId: cargo_id,
        plazas,
        tarifaDia: tarifa_dia,
        notas,
      });
      return PuestosModel.obtenerPorId(id);
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
    const afectadas = await PuestosModel.actualizar(puestoId, cambios);
    if (afectadas === 0) throw new AppError('Nada que actualizar', 400);
    return PuestosModel.obtenerPorId(puestoId);
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
