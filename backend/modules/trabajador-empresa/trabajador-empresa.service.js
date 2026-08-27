'use strict';

const TrabajadorEmpresaModel = require('./trabajador-empresa.model');
const TrabajadoresModel = require('../trabajadores/trabajadores.model');
const EmpresasModel = require('../empresas/empresas.model');
const NotificacionesService = require('../notificaciones/notificaciones.service');
const AppError = require('../../utils/AppError');
const { ROLES, ESTADOS_TRABAJADOR_EMPRESA } = require('../../config/constants');

const E = ESTADOS_TRABAJADOR_EMPRESA;

/** admin_empresa + jefe_turnos activos de la empresa — gestionan solicitudes de vinculación. */
async function notificarGestores(empresaId, base) {
  const { pool } = require('../../config/database');
  const [gestores] = await pool.query(
    `SELECT id FROM usuarios
     WHERE empresa_id = ? AND rol IN ('jefe_turnos', 'admin_empresa') AND activo = 1`,
    [empresaId]
  );
  if (gestores.length > 0) {
    await NotificacionesService.notificarVarios(gestores.map((g) => g.id), { empresaId, ...base });
  }
}

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
      await notificarGestores(empresaId, {
        tipo: 'trabajador_empresa.solicitud',
        titulo: 'Nueva solicitud de vinculación',
        mensaje: `Un trabajador quiere unirse a ${empresa.nombre}. Revisa las solicitudes pendientes.`,
        data: { relacion_id: existente.id },
      });
      return TrabajadorEmpresaModel.obtenerPorId(existente.id);
    }

    const id = await TrabajadorEmpresaModel.crear({
      usuarioId,
      empresaId,
      estado: E.SOLICITADO_POR_TRABAJADOR,
      iniciadoPor: 'trabajador',
    });
    await notificarGestores(empresaId, {
      tipo: 'trabajador_empresa.solicitud',
      titulo: 'Nueva solicitud de vinculación',
      mensaje: `Un trabajador quiere unirse a ${empresa.nombre}. Revisa las solicitudes pendientes.`,
      data: { relacion_id: id },
    });
    return TrabajadorEmpresaModel.obtenerPorId(id);
  },

  /**
   * La empresa invita a un trabajador por cédula.
   * Si la cédula no tiene cuenta, se crea la ficha de trabajador esperando activación.
   * tipo='nomina' solo aplica a trabajadores que YA tienen cuenta trabajador_turnos
   * (ver query de usuariosRows) — implica exclusividad y requiere aceptación explícita.
   */
  async invitar(empresaId, cedula, tipo = 'turnos') {
    const { pool } = require('../../config/database');

    // Buscar ficha en ESTA empresa (puede no tener cuenta aún).
    const [trabajadoresRows] = await pool.query(
      `SELECT t.id, t.usuario_id, t.empresa_id
       FROM trabajadores t
       WHERE t.cedula = ? AND t.empresa_id = ? LIMIT 1`,
      [cedula, empresaId]
    );

    // Buscar cualquier cuenta YA asociada a esta cédula, sin importar en qué
    // empresa se creó la ficha ni el rol actual — necesario para poder rechazar
    // con un mensaje claro a alguien que ya es trabajador_nomina en otra parte
    // (rol trabajador_nomina = cuenta exclusiva a una sola empresa) en vez de
    // crear una ficha fantasma silenciosa.
    const [cuentaRows] = await pool.query(
      `SELECT u.id AS usuario_id, u.rol FROM usuarios u
       INNER JOIN trabajadores t ON t.usuario_id = u.id
       WHERE t.cedula = ? LIMIT 1`,
      [cedula]
    );
    const cuenta = cuentaRows[0] || null;
    if (cuenta && cuenta.rol !== ROLES.TRABAJADOR_TURNOS) {
      throw new AppError(
        'Esta cédula ya tiene una cuenta con otro rol en la plataforma (por ejemplo, nómina de otra empresa) y no puede ser invitada así.',
        409
      );
    }
    let usuarioId = cuenta?.usuario_id || null;
    let trabajadorId = trabajadoresRows[0]?.id || null;

    // Si no hay ficha en esta empresa, crearla.
    if (!trabajadorId) {
      trabajadorId = await TrabajadoresModel.crear(empresaId, {
        nombre: cedula, // placeholder hasta que active cuenta
        apellido: '',
        cedula,
        tipo: 'turnos',
      });
    }

    // Si no hay usuario aún, no podemos crear el link de trabajador_empresa todavía.
    // Guardamos el empresa_id en empresas_invitacion para que activarCuenta lo procese.
    if (!usuarioId) {
      if (tipo === 'nomina') {
        throw new AppError(
          'Solo puedes invitar a nómina a un trabajador que ya tenga cuenta activa como trabajador de turnos',
          409
        );
      }
      await pool.query(
        `UPDATE trabajadores
         SET empresas_invitacion = JSON_ARRAY_APPEND(COALESCE(empresas_invitacion, JSON_ARRAY()), '$', ?)
         WHERE id = ?`,
        [empresaId, trabajadorId]
      );
      return {
        mensaje: 'Trabajador no tiene cuenta. Se creó la ficha. Al activar cuenta quedará vinculado.',
        trabajador_id: trabajadorId,
        pendiente_activacion: true,
      };
    }

    // Ya tiene cuenta: vincular la ficha de esta empresa a su usuario
    // (si ya existía sin usuario_id, o si se acaba de crear el placeholder).
    await pool.query('UPDATE trabajadores SET usuario_id = ? WHERE id = ? AND usuario_id IS NULL', [usuarioId, trabajadorId]);

    const notificarInvitacion = () => {
      if (tipo === 'nomina') {
        return NotificacionesService.notificar({
          empresaId,
          usuarioId,
          tipo: 'invitacion_empresa_nomina',
          titulo: 'Invitación a nómina — cambio de modalidad',
          mensaje:
            'Una empresa te invitó a formar parte de su nómina: salario fijo y aportes de ley (salud/pensión) ' +
            'calculados automáticamente. Si aceptas, tu cuenta queda exclusiva para ella — dejas de ver turnos ' +
            'de otras empresas y tus demás vínculos se archivan. Revisa los detalles antes de aceptar.',
          data: { empresa_id: empresaId },
        });
      }
      return NotificacionesService.notificar({
        empresaId,
        usuarioId,
        tipo: 'invitacion_empresa',
        titulo: 'Nueva invitación de empresa',
        mensaje: 'Una empresa te ha invitado a unirte. Revisa tus invitaciones.',
        data: { empresa_id: empresaId },
      });
    };

    // Ya tiene cuenta: crear relación.
    const existente = await TrabajadorEmpresaModel.obtenerPorUsuarioEmpresa(usuarioId, empresaId);
    if (existente) {
      if (existente.estado === E.ACTIVO) {
        throw new AppError('Este trabajador ya es parte de tu empresa', 409);
      }
      // Cualquier otro estado: actualizar a invitación.
      await TrabajadorEmpresaModel.cambiarEstado(existente.id, E.SOLICITADO_POR_EMPRESA, {
        trabajadorId,
        tipoOfrecido: tipo,
        motivo: null,
      });
      await notificarInvitacion();
      return TrabajadorEmpresaModel.obtenerPorId(existente.id);
    }

    const id = await TrabajadorEmpresaModel.crear({
      usuarioId,
      empresaId,
      estado: E.SOLICITADO_POR_EMPRESA,
      iniciadoPor: 'empresa',
      tipoOfrecido: tipo,
    });
    // Actualizar trabajador_id en la relación recién creada.
    await TrabajadorEmpresaModel.cambiarEstado(id, E.SOLICITADO_POR_EMPRESA, { trabajadorId });
    await notificarInvitacion();
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

    const { pool } = require('../../config/database');
    const [[u]] = await pool.query('SELECT rol FROM usuarios WHERE id = ? LIMIT 1', [relacion.usuario_id]);
    if (u?.rol !== ROLES.TRABAJADOR_TURNOS) {
      // Pudo convertirse a nómina de otra empresa mientras esta solicitud quedó pendiente.
      throw new AppError('Este trabajador ya no está disponible para turnos (es nómina de otra empresa)', 409);
    }

    const trabajadorId = await vincularTrabajador(relacion.usuario_id, empresaId);
    await TrabajadorEmpresaModel.cambiarEstado(relacionId, E.ACTIVO, { trabajadorId });

    const empresa = await EmpresasModel.obtenerDetalle(empresaId);
    await NotificacionesService.notificar({
      empresaId,
      usuarioId: relacion.usuario_id,
      tipo: 'trabajador_empresa.aprobado',
      titulo: 'Solicitud aprobada',
      mensaje: `${empresa?.nombre ?? 'La empresa'} aceptó tu solicitud. Ya eres parte del equipo.`,
      data: { relacion_id: relacionId },
    });
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

    const { pool } = require('../../config/database');
    const esNomina = relacion.tipo_ofrecido === 'nomina';

    const [[u]] = await pool.query('SELECT nombre, apellido, rol FROM usuarios WHERE id = ? LIMIT 1', [usuarioId]);
    // Solo un trabajador_turnos puede ganar una relación nueva (nómina es exclusiva
    // a una empresa; si ya convirtió en otra parte mientras esto quedó pendiente, se corta acá).
    if (u?.rol !== ROLES.TRABAJADOR_TURNOS) {
      throw new AppError('Ya no puedes aceptar esta invitación: tu cuenta es de nómina en otra empresa', 409);
    }
    const nombre = u ? `${u.nombre} ${u.apellido || ''}`.trim() : 'Un trabajador';

    const trabajadorId =
      relacion.trabajador_id ||
      (await vincularTrabajador(usuarioId, relacion.empresa_id));
    await TrabajadorEmpresaModel.cambiarEstado(relacionId, E.ACTIVO, { trabajadorId });

    if (esNomina) {
      // Conversión real: fija el track de la ficha, cambia el rol global del
      // usuario (nómina = exclusivo a una empresa) y archiva sus demás vínculos
      // (activos Y pendientes — una solicitud/invitación vieja no debe poder
      // reactivarse después y romper la exclusividad).
      await pool.query('UPDATE trabajadores SET tipo = ? WHERE id = ?', ['nomina', trabajadorId]);
      await pool.query(
        'UPDATE usuarios SET rol = ?, empresa_id = ? WHERE id = ?',
        [ROLES.TRABAJADOR_NOMINA, relacion.empresa_id, usuarioId]
      );

      const archivadas = await TrabajadorEmpresaModel.archivarOtrasRelacionesDeUsuario(usuarioId, relacionId);
      for (const otra of archivadas) {
        await notificarGestores(otra.empresa_id, {
          tipo: 'trabajador_empresa.archivado_por_conversion',
          titulo: 'Trabajador ya no disponible',
          mensaje: `${nombre} pasó a nómina de otra empresa y ya no está disponible para turnos contigo.`,
          data: { relacion_id: otra.id },
        });
      }

      const empresaNomina = await EmpresasModel.obtenerDetalle(relacion.empresa_id);
      await NotificacionesService.notificar({
        empresaId: relacion.empresa_id,
        usuarioId,
        tipo: 'trabajador_empresa.bienvenida_nomina',
        titulo: `Ya eres parte de la nómina de ${empresaNomina?.nombre ?? 'la empresa'}`,
        mensaje:
          'Beneficios: salario fijo, aportes de ley a salud y pensión calculados automáticamente, y tu empresa ' +
          'asume 100% de ARL y caja de compensación. Cambios en la app: tu pestaña principal ahora es "Nómina" ' +
          '(ahí ves tus registros diarios y pagos calculados según la ley laboral colombiana). Ya no verás ni ' +
          'podrás tomar ofertas de turnos de otras empresas — tu cuenta quedó exclusiva para esta empresa.',
        data: { empresa_id: relacion.empresa_id },
      });
    }

    await notificarGestores(relacion.empresa_id, {
      tipo: 'trabajador_empresa.aceptada',
      titulo: 'Invitación aceptada',
      mensaje: `${nombre} aceptó tu invitación y ya es parte del equipo.`,
      data: { relacion_id: relacionId },
    });
    return TrabajadorEmpresaModel.obtenerPorId(relacionId);
  },

  /**
   * Rechaza una solicitud o invitación.
   * Puede hacerlo el trabajador (rechaza invitación) o la empresa (rechaza solicitud).
   */
  async rechazar(actorId, actorRol, actorEmpresaId, relacionId, motivo) {
    const relacion = await TrabajadorEmpresaModel.obtenerPorId(relacionId);
    if (!relacion) throw new AppError('Solicitud no encontrada', 404);

    const esTrabajador = relacion.usuario_id === actorId;
    const esJefe = actorRol === ROLES.JEFE_TURNOS && relacion.empresa_id === actorEmpresaId;

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
  async archivar(actorId, actorRol, actorEmpresaId, relacionId) {
    const relacion = await TrabajadorEmpresaModel.obtenerPorId(relacionId);
    if (!relacion) throw new AppError('Solicitud no encontrada', 404);

    const esTrabajador = relacion.usuario_id === actorId;
    const esJefe = actorRol === ROLES.JEFE_TURNOS && relacion.empresa_id === actorEmpresaId;

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

  /**
   * Solicitudes pendientes para una empresa (panel del jefe de turnos).
   * Adjunta perfil_previo: cédula/experiencia/diplomas si el usuario ya
   * tiene una ficha activa en OTRA empresa (mismo patrón cross-empresa
   * que usa TrabajadoresService.me()) — nada que mostrar si es su primera empresa.
   */
  async solicitudesPorEmpresa(empresaId, estado) {
    const filas = await TrabajadorEmpresaModel.listarPorEmpresa(empresaId, estado || null);

    const usuarioIds = filas.map((f) => f.usuario_id);
    const trabajadoresPorUsuario = await TrabajadoresModel.obtenerPorUsuarioIds(usuarioIds);

    const trabajadorIds = [...trabajadoresPorUsuario.values()].map((t) => t.id);
    const [experienciasPorTrabajador, diplomasPorTrabajador] = await Promise.all([
      TrabajadoresModel.listarExperienciasPorTrabajadores(trabajadorIds),
      TrabajadoresModel.listarDiplomasPorTrabajadores(trabajadorIds),
    ]);

    return filas.map((fila) => {
      const trabajador = trabajadoresPorUsuario.get(fila.usuario_id);
      if (!trabajador) return { ...fila, perfil_previo: null };
      return {
        ...fila,
        perfil_previo: {
          cedula: trabajador.cedula,
          tipo_documento: trabajador.tipo_documento,
          experiencias: experienciasPorTrabajador.get(trabajador.id) || [],
          diplomas: diplomasPorTrabajador.get(trabajador.id) || [],
        },
      };
    });
  },
};

module.exports = TrabajadorEmpresaService;
