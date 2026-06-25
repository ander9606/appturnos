'use strict';

const TrabajadorEmpresaModel = require('./trabajador-empresa.model');
const TrabajadoresModel = require('../trabajadores/trabajadores.model');
const EmpresasModel = require('../empresas/empresas.model');
const AppError = require('../../utils/AppError');
const { ROLES, ESTADOS_TRABAJADOR_EMPRESA } = require('../../config/constants');

const E = ESTADOS_TRABAJADOR_EMPRESA;

/**
 * Crea o reutiliza la ficha de trabajadores para el usuario en la empresa dada.
 * Se llama al aprobar/aceptar una solicitud.
 */
async function vincularTrabajador(usuarioId, empresaId) {
  const { pool } = require('../../config/database');

  // Buscar si ya existe un trabajador con este usuario en la empresa.
  const [filas] = await pool.query(
    'SELECT id FROM trabajadores WHERE usuario_id = ? AND empresa_id = ? LIMIT 1',
    [usuarioId, empresaId]
  );
  if (filas.length) return filas[0].id;

  // Obtener datos básicos del usuario para crear la ficha.
  const [usuarioRows] = await pool.query(
    'SELECT nombre, apellido, email FROM usuarios WHERE id = ? LIMIT 1',
    [usuarioId]
  );
  if (!usuarioRows.length) return null;
  const u = usuarioRows[0];

  // Crear ficha de trabajador tipo 'turnos' para esta empresa.
  const id = await TrabajadoresModel.crear(empresaId, {
    nombre: u.nombre,
    apellido: u.apellido || '',
    email: u.email || null,
    tipo: 'turnos',
  });

  // Vincular el usuario_id a la ficha recién creada.
  await pool.query('UPDATE trabajadores SET usuario_id = ? WHERE id = ?', [usuarioId, id]);

  return id;
}

const TrabajadorEmpresaService = {
  /**
   * El trabajador solicita unirse a una empresa.
   * Crea relación en estado 'solicitado_por_trabajador'.
   */
  async solicitar(usuarioId, empresaId) {
    const empresa = await EmpresasModel.obtenerDetalle(empresaId);
    if (!empresa) throw new AppError('Empresa no encontrada', 404);

    const existente = await TrabajadorEmpresaModel.obtenerPorUsuarioEmpresa(usuarioId, empresaId);
    if (existente) {
      if (existente.estado === E.ACTIVO) {
        throw new AppError('Ya eres parte de esta empresa', 409);
      }
      if (existente.estado === E.SOLICITADO_POR_TRABAJADOR) {
        throw new AppError('Ya tienes una solicitud pendiente para esta empresa', 409);
      }
      // Si la empresa ya lo invitó, aceptar directamente.
      if (existente.estado === E.SOLICITADO_POR_EMPRESA) {
        return TrabajadorEmpresaService.aceptar(usuarioId, existente.id);
      }
      // Si fue rechazado/archivado, reactivar la solicitud.
      await TrabajadorEmpresaModel.cambiarEstado(existente.id, E.SOLICITADO_POR_TRABAJADOR, {
        motivo: null,
      });
      return TrabajadorEmpresaModel.obtenerPorId(existente.id);
    }

    const id = await TrabajadorEmpresaModel.crear({
      usuarioId,
      empresaId,
      estado: E.SOLICITADO_POR_TRABAJADOR,
      iniciadoPor: 'trabajador',
    });
    return TrabajadorEmpresaModel.obtenerPorId(id);
  },

  /**
   * La empresa invita a un trabajador por cédula.
   * Si la cédula no tiene cuenta, se crea la ficha de trabajador esperando activación.
   */
  async invitar(empresaId, cedula) {
    const { pool } = require('../../config/database');

    // Buscar usuario con esta cédula (puede no tener cuenta aún).
    const [trabajadoresRows] = await pool.query(
      `SELECT t.id, t.usuario_id, t.empresa_id
       FROM trabajadores t
       WHERE t.cedula = ? AND t.empresa_id = ? LIMIT 1`,
      [cedula, empresaId]
    );

    // Buscar también en usuarios directamente (por si ya tiene cuenta multi-empresa).
    const [usuariosRows] = await pool.query(
      `SELECT u.id AS usuario_id FROM usuarios u
       INNER JOIN trabajadores t ON t.usuario_id = u.id
       WHERE t.cedula = ? AND u.rol = 'trabajador_turnos' LIMIT 1`,
      [cedula]
    );

    let usuarioId = usuariosRows[0]?.usuario_id || null;
    let trabajadorId = trabajadoresRows[0]?.id || null;

    // Si no hay ficha en esta empresa, crearla.
    if (!trabajadorId) {
      trabajadorId = await TrabajadoresModel.crear(empresaId, {
        nombre: cedula, // placeholder hasta que active cuenta
        cedula,
        tipo: 'turnos',
      });
    }

    // Si no hay usuario aún, no podemos crear el link de trabajador_empresa todavía.
    // Lo hacemos cuando active la cuenta.
    if (!usuarioId) {
      // Guardar marcador en trabajadores para que activarCuenta lo encuentre.
      return {
        mensaje: 'Trabajador no tiene cuenta. Se creó la ficha. Al activar cuenta quedará vinculado.',
        trabajador_id: trabajadorId,
        pendiente_activacion: true,
      };
    }

    const PushService = require('../notificaciones/push/push.service');
    const pushInvitacion = () => PushService.enviarExpo(usuarioId, {
      titulo: 'Nueva invitación de empresa',
      mensaje: 'Una empresa te ha invitado a unirte. Revisa tus invitaciones.',
      data: { tipo: 'invitacion_empresa', empresa_id: empresaId },
    }).catch(() => {});

    // Ya tiene cuenta: crear relación.
    const existente = await TrabajadorEmpresaModel.obtenerPorUsuarioEmpresa(usuarioId, empresaId);
    if (existente) {
      if (existente.estado === E.ACTIVO) {
        throw new AppError('Este trabajador ya es parte de tu empresa', 409);
      }
      // Cualquier otro estado: actualizar a invitación.
      await TrabajadorEmpresaModel.cambiarEstado(existente.id, E.SOLICITADO_POR_EMPRESA, {
        trabajadorId,
        motivo: null,
      });
      pushInvitacion();
      return TrabajadorEmpresaModel.obtenerPorId(existente.id);
    }

    const id = await TrabajadorEmpresaModel.crear({
      usuarioId,
      empresaId,
      estado: E.SOLICITADO_POR_EMPRESA,
      iniciadoPor: 'empresa',
    });
    // Actualizar trabajador_id en la relación recién creada.
    await TrabajadorEmpresaModel.cambiarEstado(id, E.SOLICITADO_POR_EMPRESA, { trabajadorId });
    pushInvitacion();
    return TrabajadorEmpresaModel.obtenerPorId(id);
  },

  /**
   * El jefe de turnos aprueba una solicitud 'solicitado_por_trabajador'.
   * Crea la ficha de trabajadores si no existe y la vincula.
   */
  async aprobar(empresaId, relacionId) {
    const relacion = await TrabajadorEmpresaModel.obtenerPorId(relacionId);
    if (!relacion || relacion.empresa_id !== empresaId) {
      throw new AppError('Solicitud no encontrada', 404);
    }
    if (relacion.estado !== E.SOLICITADO_POR_TRABAJADOR) {
      throw new AppError('Solo se pueden aprobar solicitudes pendientes del trabajador', 409);
    }

    const trabajadorId = await vincularTrabajador(relacion.usuario_id, empresaId);
    await TrabajadorEmpresaModel.cambiarEstado(relacionId, E.ACTIVO, { trabajadorId });
    return TrabajadorEmpresaModel.obtenerPorId(relacionId);
  },

  /**
   * El trabajador acepta una invitación 'solicitado_por_empresa'.
   */
  async aceptar(usuarioId, relacionId) {
    const relacion = await TrabajadorEmpresaModel.obtenerPorId(relacionId);
    if (!relacion || relacion.usuario_id !== usuarioId) {
      throw new AppError('Invitación no encontrada', 404);
    }
    if (relacion.estado !== E.SOLICITADO_POR_EMPRESA) {
      throw new AppError('Solo se pueden aceptar invitaciones pendientes de la empresa', 409);
    }

    const trabajadorId =
      relacion.trabajador_id ||
      (await vincularTrabajador(usuarioId, relacion.empresa_id));
    await TrabajadorEmpresaModel.cambiarEstado(relacionId, E.ACTIVO, { trabajadorId });
    return TrabajadorEmpresaModel.obtenerPorId(relacionId);
  },

  /**
   * Rechaza una solicitud o invitación.
   * Puede hacerlo el trabajador (rechaza invitación) o la empresa (rechaza solicitud).
   */
  async rechazar(actorId, actorRol, relacionId, motivo) {
    const relacion = await TrabajadorEmpresaModel.obtenerPorId(relacionId);
    if (!relacion) throw new AppError('Solicitud no encontrada', 404);

    const esTrabajador = relacion.usuario_id === actorId;
    const esJefe = actorRol === ROLES.JEFE_TURNOS && relacion.empresa_id !== undefined;

    if (!esTrabajador && !esJefe) {
      throw new AppError('Sin permisos para esta acción', 403);
    }
    if ([E.RECHAZADO, E.ARCHIVADO].includes(relacion.estado)) {
      throw new AppError('La solicitud ya está cerrada', 409);
    }

    await TrabajadorEmpresaModel.cambiarEstado(relacionId, E.RECHAZADO, { motivo: motivo || null });
    return TrabajadorEmpresaModel.obtenerPorId(relacionId);
  },

  /**
   * Archiva una relación activa (renuncia del trabajador o desvinculación por la empresa).
   */
  async archivar(actorId, actorRol, relacionId) {
    const relacion = await TrabajadorEmpresaModel.obtenerPorId(relacionId);
    if (!relacion) throw new AppError('Solicitud no encontrada', 404);

    const esTrabajador = relacion.usuario_id === actorId;
    const esJefe = actorRol === ROLES.JEFE_TURNOS;

    if (!esTrabajador && !esJefe) {
      throw new AppError('Sin permisos para esta acción', 403);
    }
    if (relacion.estado !== E.ACTIVO) {
      throw new AppError('Solo se pueden archivar relaciones activas', 409);
    }

    await TrabajadorEmpresaModel.cambiarEstado(relacionId, E.ARCHIVADO);
    return TrabajadorEmpresaModel.obtenerPorId(relacionId);
  },

  /** Empresas del trabajador agrupadas por estado (para "Mis empresas"). */
  async misEmpresas(usuarioId) {
    const todas = await TrabajadorEmpresaModel.listarPorUsuario(usuarioId);
    return {
      activas: todas.filter((r) => r.estado === E.ACTIVO),
      pendientes: todas.filter((r) => r.estado === E.SOLICITADO_POR_TRABAJADOR),
      invitaciones: todas.filter((r) => r.estado === E.SOLICITADO_POR_EMPRESA),
      archivadas: todas.filter((r) => [E.RECHAZADO, E.ARCHIVADO].includes(r.estado)),
    };
  },

  /** Solicitudes pendientes para una empresa (panel del jefe de turnos). */
  async solicitudesPorEmpresa(empresaId, estado) {
    return TrabajadorEmpresaModel.listarPorEmpresa(empresaId, estado || null);
  },
};

module.exports = TrabajadorEmpresaService;
