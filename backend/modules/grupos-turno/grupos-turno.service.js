'use strict';

const GruposTurnoModel = require('./grupos-turno.model');
const AppError = require('../../utils/AppError');
const { ahoraColombiaSQL } = require('../../utils/fechaColombia');

/**
 * Grupos de turnos: agrupan turnos de distintos días bajo un mismo contexto (feria, obra,
 * proyecto…). Reglas:
 *   - Solo existen para empresas con `usa_grupos_turno = 1` (ver `requiereGrupos` en las rutas).
 *   - El nombre es único por empresa (sin importar mayúsculas).
 *   - lugar, latitud y longitud van juntos o no va ninguno. Es solo el valor por defecto de
 *     los turnos nuevos: cada turno guarda su propia copia.
 *   - Un grupo se CIERRA, no se borra; cerrado no recibe turnos nuevos. Se puede reabrir.
 */

/** Fase calculada con las fechas de sus turnos (hoy = fecha de Colombia). No se guarda. */
function faseDe(grupo, hoy) {
  if (grupo.estado === 'cerrado') return 'cerrado';
  if (!grupo.fecha_inicio) return 'sin_turnos';
  if (hoy < grupo.fecha_inicio) return 'proximo';
  if (hoy > grupo.fecha_fin) return 'terminado';
  return 'en_curso';
}

const conFase = (grupo) => ({ ...grupo, fase: faseDe(grupo, ahoraColombiaSQL().slice(0, 10)) });

/** lugar + latitud + longitud: los tres o ninguno. */
function validarLugar({ lugar, latitud, longitud }) {
  const presentes = [lugar, latitud, longitud].filter((v) => v != null && v !== '').length;
  if (presentes !== 0 && presentes !== 3) {
    throw new AppError('El lugar del grupo necesita dirección y coordenadas (o ninguna de las dos).', 422);
  }
}

/** 409 con el id del grupo que ya usa ese nombre, para que la app ofrezca "Usar ese". */
async function errorNombreRepetido(empresaId, nombre) {
  const grupoId = await GruposTurnoModel.idPorNombre(empresaId, nombre);
  const error = new AppError(`Ya existe un grupo llamado "${nombre}".`, 409);
  error.detalles = [{ campo: 'nombre', mensaje: error.message, grupo_id: grupoId }];
  return error;
}

async function obtenerOFallar(empresaId, id) {
  const grupo = await GruposTurnoModel.obtenerPorId(empresaId, id);
  if (!grupo) throw new AppError('Grupo no encontrado', 404);
  return grupo;
}

const GruposTurnoService = {
  /** estado: 'activo' (por defecto) | 'cerrado' | 'todos'. */
  async listar(empresaId, estado = 'activo') {
    const filas = await GruposTurnoModel.listar(empresaId, estado === 'todos' ? null : estado);
    return filas.map(conFase);
  },

  async obtener(empresaId, id) {
    const grupo = await obtenerOFallar(empresaId, id);
    return { ...conFase(grupo), turnos: await GruposTurnoModel.turnos(empresaId, id) };
  },

  async crear(empresaId, datos, creadoPor) {
    validarLugar(datos);
    try {
      const id = await GruposTurnoModel.crear(empresaId, datos, creadoPor);
      return conFase(await GruposTurnoModel.obtenerPorId(empresaId, id));
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') throw await errorNombreRepetido(empresaId, datos.nombre);
      throw err;
    }
  },

  async actualizar(empresaId, id, cambios) {
    const grupo = await obtenerOFallar(empresaId, id);
    validarLugar({
      lugar: cambios.lugar !== undefined ? cambios.lugar : grupo.lugar,
      latitud: cambios.latitud !== undefined ? cambios.latitud : grupo.latitud,
      longitud: cambios.longitud !== undefined ? cambios.longitud : grupo.longitud,
    });
    try {
      await GruposTurnoModel.actualizar(empresaId, id, cambios);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') throw await errorNombreRepetido(empresaId, cambios.nombre);
      throw err;
    }
    return conFase(await GruposTurnoModel.obtenerPorId(empresaId, id));
  },

  async cerrar(empresaId, id) {
    const grupo = await obtenerOFallar(empresaId, id);
    if (grupo.estado === 'cerrado') throw new AppError('El grupo ya está cerrado', 409);
    const pendientes = await GruposTurnoModel.contarPendientes(empresaId, id, ahoraColombiaSQL());
    if (pendientes > 0) {
      throw new AppError(
        `No se puede cerrar: tiene ${pendientes} turno${pendientes !== 1 ? 's' : ''} sin terminar. `
        + 'Espera a que terminen o cancélalos.',
        409
      );
    }
    await GruposTurnoModel.cambiarEstado(empresaId, id, 'cerrado');
    return conFase(await GruposTurnoModel.obtenerPorId(empresaId, id));
  },

  async reabrir(empresaId, id) {
    const grupo = await obtenerOFallar(empresaId, id);
    if (grupo.estado === 'activo') throw new AppError('El grupo ya está activo', 409);
    await GruposTurnoModel.cambiarEstado(empresaId, id, 'activo');
    return conFase(await GruposTurnoModel.obtenerPorId(empresaId, id));
  },
};

module.exports = GruposTurnoService;
