'use strict';

const RegistrosModel = require('./registros.model');
const PeriodosModel = require('../periodos/periodos.model');
const TrabajadoresModel = require('../../trabajadores/trabajadores.model');
const { calcularHoras } = require('../../../utils/laboralUtils');
const AppError = require('../../../utils/AppError');
const { ROLES } = require('../../../config/constants');

/**
 * El trabajador_nomina solo opera sobre sus propios registros: se resuelve
 * su trabajador y se ignora cualquier trabajador_id que venga en la petición.
 */
async function resolverTrabajadorPropio(empresaId, usuarioId) {
  const trabajador = await TrabajadoresModel.obtenerPorUsuarioId(empresaId, usuarioId);
  if (!trabajador) {
    throw new AppError('Tu usuario no está vinculado a un trabajador activo', 403);
  }
  return trabajador.id;
}

const RegistrosService = {
  async listar(empresaId, usuario, { periodo_id, trabajador_id, fecha, page, limit }) {
    let trabajadorId = trabajador_id;
    if (usuario.rol === ROLES.TRABAJADOR_NOMINA) {
      trabajadorId = await resolverTrabajadorPropio(empresaId, usuario.sub);
    }
    const offset = (page - 1) * limit;
    const { data, total } = await RegistrosModel.listar(empresaId, {
      periodoId: periodo_id,
      trabajadorId,
      fecha,
      limit,
      offset,
    });
    return { data, pagination: { page, limit, total } };
  },

  async crear(empresaId, usuario, datos) {
    let trabajadorId = datos.trabajador_id;
    if (usuario.rol === ROLES.TRABAJADOR_NOMINA) {
      trabajadorId = await resolverTrabajadorPropio(empresaId, usuario.sub);
    }
    if (!trabajadorId) {
      throw new AppError('trabajador_id es obligatorio', 422);
    }

    const periodo = await PeriodosModel.obtenerPorId(empresaId, datos.periodo_id);
    if (!periodo) throw new AppError('Período no encontrado', 404);
    if (periodo.estado !== 'abierto') {
      throw new AppError('No se puede registrar en un período que no está abierto', 409);
    }
    if (datos.fecha < periodo.fecha_inicio || datos.fecha > periodo.fecha_fin) {
      throw new AppError('La fecha está fuera del rango del período', 422);
    }

    const horas = calcularHoras({
      horaEntrada: datos.hora_entrada,
      horaSalida: datos.hora_salida,
      fecha: datos.fecha,
    });

    const id = await RegistrosModel.crear(empresaId, {
      trabajador_id: trabajadorId,
      periodo_id: datos.periodo_id,
      fecha: datos.fecha,
      hora_entrada: datos.hora_entrada || null,
      hora_salida: datos.hora_salida || null,
      horas_ordinarias: horas.horas_ordinarias,
      horas_extra_diurnas: horas.horas_extra_diurnas,
      horas_extra_nocturnas: horas.horas_extra_nocturnas,
      horas_nocturnas: horas.horas_nocturnas,
      horas_festivo: horas.horas_festivo,
      es_festivo: horas.es_festivo,
      novedad: datos.novedad || null,
    });
    return RegistrosModel.obtenerPorId(empresaId, id);
  },

  /** Corrección de un registro. Recalcula las horas y registra el aprobador. */
  async corregir(empresaId, usuario, id, datos) {
    const registro = await RegistrosModel.obtenerPorId(empresaId, id);
    if (!registro) throw new AppError('Registro no encontrado', 404);

    const periodo = await PeriodosModel.obtenerPorId(empresaId, registro.periodo_id);
    if (periodo.estado !== 'abierto') {
      throw new AppError('No se puede corregir un registro de un período cerrado', 409);
    }

    const horaEntrada =
      datos.hora_entrada !== undefined ? datos.hora_entrada : registro.hora_entrada;
    const horaSalida =
      datos.hora_salida !== undefined ? datos.hora_salida : registro.hora_salida;

    const horas = calcularHoras({ horaEntrada, horaSalida, fecha: registro.fecha });

    await RegistrosModel.actualizar(empresaId, id, {
      hora_entrada: horaEntrada || null,
      hora_salida: horaSalida || null,
      horas_ordinarias: horas.horas_ordinarias,
      horas_extra_diurnas: horas.horas_extra_diurnas,
      horas_extra_nocturnas: horas.horas_extra_nocturnas,
      horas_nocturnas: horas.horas_nocturnas,
      horas_festivo: horas.horas_festivo,
      es_festivo: horas.es_festivo,
      novedad: datos.novedad !== undefined ? datos.novedad : registro.novedad,
      aprobado_por: usuario.sub,
    });
    return RegistrosModel.obtenerPorId(empresaId, id);
  },
};

module.exports = RegistrosService;
