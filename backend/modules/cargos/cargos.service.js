'use strict';

const CargosModel = require('./cargos.model');
const TrabajadorEmpresaModel = require('../trabajador-empresa/trabajador-empresa.model');
const AppError = require('../../utils/AppError');

/**
 * Lógica del catálogo de cargos y de la asignación de cargos por trabajador.
 *
 * Reglas:
 *   - Cualquier usuario autenticado de una empresa ve el catálogo (sistema + custom de su empresa).
 *   - Solo jefe_turnos / admin_empresa crean/editan cargos custom.
 *   - Solo jefe_turnos / admin_empresa asignan cargos a trabajadores.
 *   - Nadie modifica cargos del sistema (empresa_id IS NULL) vía endpoint.
 *   - Si un cargo está en uso, no se borra: se desactiva (soft delete).
 */

function esCargoDelSistema(cargo) {
  return cargo.empresa_id === null;
}

/** Slugifica un nombre humano a un código interno: "Jefe de Montaje" → "jefe_de_montaje". */
function slugificar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}

const CargosService = {
  /** Catálogo visible para la empresa del usuario (sistema + custom). */
  async listarParaEmpresa(empresaId) {
    return CargosModel.listarParaEmpresa(empresaId);
  },

  /**
   * Crea un cargo custom para la empresa del usuario. El código se
   * autogenera desde el nombre si no se provee.
   */
  async crearParaEmpresa(empresaId, { codigo, nombre, descripcion, tipo_geofence: tipoGeofence, punto_marcaje_id: puntoMarcajeId }) {
    if (!nombre || !nombre.trim()) {
      throw new AppError('Nombre del cargo requerido', 400);
    }
    const codigoFinal = (codigo || slugificar(nombre)).trim();
    if (!codigoFinal) {
      throw new AppError('No se pudo generar un código válido para el cargo', 400);
    }

    // No permitir colisión con un cargo del sistema (transparente para el usuario).
    const colisionSistema = await CargosModel.obtenerPorCodigoEmpresa(codigoFinal, null);
    if (colisionSistema) {
      throw new AppError(
        `Ya existe un cargo del sistema con código "${codigoFinal}". Usa otro nombre.`,
        409
      );
    }

    const existente = await CargosModel.obtenerPorCodigoEmpresa(codigoFinal, empresaId);
    if (existente) {
      throw new AppError(`Tu empresa ya tiene un cargo con código "${codigoFinal}"`, 409);
    }

    const id = await CargosModel.crear({
      empresaId,
      codigo: codigoFinal,
      nombre: nombre.trim(),
      descripcion: descripcion ? descripcion.trim() : null,
      tipoGeofence: tipoGeofence || 'oferta',
      puntoMarcajeId: puntoMarcajeId || null,
    });
    return CargosModel.obtenerPorId(id);
  },

  /** Edita un cargo custom de la empresa. No permite tocar cargos del sistema. */
  async actualizar(empresaId, cargoId, cambios) {
    const cargo = await CargosModel.obtenerPorId(cargoId);
    if (!cargo) throw new AppError('Cargo no encontrado', 404);
    if (esCargoDelSistema(cargo)) {
      throw new AppError('No se pueden modificar cargos del sistema', 403);
    }
    if (cargo.empresa_id !== empresaId) {
      throw new AppError('Este cargo no pertenece a tu empresa', 403);
    }

    const { tipo_geofence, punto_marcaje_id, ...resto } = cambios;
    const afectadas = await CargosModel.actualizar(cargoId, {
      ...resto,
      ...(tipo_geofence !== undefined && { tipoGeofence: tipo_geofence }),
      ...(punto_marcaje_id !== undefined && { puntoMarcajeId: punto_marcaje_id }),
    });
    if (afectadas === 0) {
      throw new AppError('Nada que actualizar', 400);
    }
    return CargosModel.obtenerPorId(cargoId);
  },

  /**
   * Elimina un cargo custom. Hard delete si nadie lo usa; soft delete
   * (activo=0) si ya está asignado a trabajadores. Así no rompemos
   * el historial de asignaciones.
   */
  async eliminar(empresaId, cargoId) {
    const cargo = await CargosModel.obtenerPorId(cargoId);
    if (!cargo) throw new AppError('Cargo no encontrado', 404);
    if (esCargoDelSistema(cargo)) {
      throw new AppError('No se pueden eliminar cargos del sistema', 403);
    }
    if (cargo.empresa_id !== empresaId) {
      throw new AppError('Este cargo no pertenece a tu empresa', 403);
    }

    const usos = await CargosModel.contarUsos(cargoId);
    if (usos > 0) {
      await CargosModel.actualizar(cargoId, { activo: 0 });
      return { eliminado: false, desactivado: true, usos };
    }
    await CargosModel.eliminar(cargoId);
    return { eliminado: true, desactivado: false, usos: 0 };
  },

  // -------- Asignaciones --------

  /** Lista los cargos certificados a un trabajador en la empresa del jefe. */
  async listarCargosDeVinculo(empresaId, vinculoId) {
    const vinculo = await TrabajadorEmpresaModel.obtenerPorId(vinculoId);
    if (!vinculo) throw new AppError('Vínculo no encontrado', 404);
    if (vinculo.empresa_id !== empresaId) {
      throw new AppError('Este vínculo no pertenece a tu empresa', 403);
    }
    return CargosModel.listarPorVinculo(vinculoId);
  },

  /**
   * Asigna un cargo a un trabajador. Valida:
   *   - El vínculo es de la empresa del jefe que asigna.
   *   - El vínculo está activo (no se asignan cargos a solicitudes pendientes ni archivados).
   *   - El cargo existe y es del sistema o de esta misma empresa.
   *   - El cargo está activo.
   *   - No está ya asignado.
   */
  async asignarCargo(empresaId, vinculoId, cargoId, asignadoPor) {
    const vinculo = await TrabajadorEmpresaModel.obtenerPorId(vinculoId);
    if (!vinculo) throw new AppError('Vínculo no encontrado', 404);
    if (vinculo.empresa_id !== empresaId) {
      throw new AppError('Este vínculo no pertenece a tu empresa', 403);
    }
    if (vinculo.estado !== 'activo') {
      throw new AppError(
        'Solo se pueden asignar cargos a vínculos activos',
        409
      );
    }

    const cargo = await CargosModel.obtenerPorId(cargoId);
    if (!cargo) throw new AppError('Cargo no encontrado', 404);
    if (!cargo.activo) throw new AppError('El cargo está desactivado', 409);
    if (cargo.empresa_id !== null && cargo.empresa_id !== empresaId) {
      throw new AppError('Este cargo no pertenece a tu empresa', 403);
    }

    if (await CargosModel.tieneAsignacion(vinculoId, cargoId)) {
      throw new AppError('El trabajador ya tiene este cargo asignado', 409);
    }

    await CargosModel.asignar({
      trabajadorEmpresaId: vinculoId,
      cargoId,
      asignadoPor,
    });
    return CargosModel.listarPorVinculo(vinculoId);
  },

  async desasignarCargo(empresaId, vinculoId, cargoId) {
    const vinculo = await TrabajadorEmpresaModel.obtenerPorId(vinculoId);
    if (!vinculo) throw new AppError('Vínculo no encontrado', 404);
    if (vinculo.empresa_id !== empresaId) {
      throw new AppError('Este vínculo no pertenece a tu empresa', 403);
    }
    const eliminadas = await CargosModel.desasignar(vinculoId, cargoId);
    if (eliminadas === 0) {
      throw new AppError('El trabajador no tiene este cargo asignado', 404);
    }
    return CargosModel.listarPorVinculo(vinculoId);
  },
};

module.exports = CargosService;
