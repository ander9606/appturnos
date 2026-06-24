'use strict';

const crypto = require('crypto');
const bcrypt = require('bcrypt');

const AuthModel = require('./auth.model');
const TokenService = require('../../utils/TokenService');
const AppError = require('../../utils/AppError');
const { ROLES, LOGIN } = require('../../config/constants');

const BCRYPT_ROUNDS = 11;

// Mapea el tipo de trabajador al rol con el que se crea su cuenta.
// 'ambos' usa el rol de Turnos por defecto (track principal en campo).
const ROL_POR_TIPO = {
  nomina: ROLES.TRABAJADOR_NOMINA,
  turnos: ROLES.TRABAJADOR_TURNOS,
  ambos: ROLES.TRABAJADOR_TURNOS,
};

/** Construye el par de tokens y persiste el refresh token. */
async function emitirTokens(usuario) {
  const accessToken = TokenService.generarAccessToken(usuario);
  const refreshToken = TokenService.generarRefreshToken();
  await AuthModel.guardarRefreshToken({
    usuario_id: usuario.id,
    token: refreshToken,
    expira_at: TokenService.fechaExpiracionRefresh(),
  });
  return { access_token: accessToken, refresh_token: refreshToken };
}

/** Vista pública de un usuario (sin password_hash). */
function perfilPublico(u) {
  return {
    id: u.id,
    empresa_id: u.empresa_id,
    nombre: u.nombre,
    apellido: u.apellido,
    foto_perfil: u.foto_perfil ?? null,
    email: u.email,
    rol: u.rol,
  };
}

const AuthService = {
  /**
   * Autentica por email + password. Aplica lockout tras
   * LOGIN.MAX_INTENTOS fallos durante LOGIN.LOCKOUT_MINUTOS.
   */
  async login(email, password) {
    const usuario = await AuthModel.buscarUsuarioPorEmail(email);
    // Mensaje genérico: no revela si el email existe.
    if (!usuario) throw new AppError('Credenciales inválidas', 401);

    const intentos = await AuthModel.obtenerIntentos(usuario.id);
    if (intentos?.bloqueado) {
      throw new AppError(
        'Cuenta bloqueada temporalmente por intentos fallidos. Intenta más tarde.',
        429
      );
    }

    // Si hubo un bloqueo que ya expiró, el contador arranca de cero.
    let intentosPrevios = intentos?.intentos || 0;
    if (intentos?.bloqueado_hasta && !intentos.bloqueado) {
      await AuthModel.limpiarIntentos(usuario.id);
      intentosPrevios = 0;
    }

    if (!usuario.activo) throw new AppError('Usuario inactivo', 403);

    const passwordOk = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordOk) {
      await AuthModel.registrarIntentoFallido(usuario.id);
      if (intentosPrevios + 1 >= LOGIN.MAX_INTENTOS) {
        await AuthModel.establecerBloqueo(usuario.id, LOGIN.LOCKOUT_MINUTOS);
      }
      throw new AppError('Credenciales inválidas', 401);
    }

    await AuthModel.limpiarIntentos(usuario.id);
    const tokens = await emitirTokens(usuario);
    return { ...tokens, usuario: perfilPublico(usuario) };
  },

  /**
   * Renueva el access token a partir de un refresh token válido.
   * Rota el refresh token (revoca el usado, emite uno nuevo).
   */
  async refresh(refreshToken) {
    const fila = await AuthModel.buscarRefreshToken(refreshToken);
    if (!fila) throw new AppError('Refresh token inválido', 401);

    // Token ya revocado pero presentado de nuevo: posible robo.
    // Se revocan todas las sesiones del usuario por precaución.
    if (fila.revocado) {
      await AuthModel.revocarRefreshTokensDeUsuario(fila.usuario_id);
      throw new AppError('Refresh token inválido', 401);
    }
    if (fila.expirado) throw new AppError('Refresh token expirado', 401);
    if (!fila.usuario_activo) throw new AppError('Usuario inactivo', 403);

    await AuthModel.revocarRefreshToken(refreshToken);
    const tokens = await emitirTokens({
      id: fila.usuario_id,
      empresa_id: fila.empresa_id,
      rol: fila.rol,
      nombre: fila.nombre,
    });
    return tokens;
  },

  /** Invalida un refresh token (cierre de sesión). */
  async logout(refreshToken) {
    await AuthModel.revocarRefreshToken(refreshToken);
  },

  /** Perfil del usuario autenticado. */
  async perfil(usuarioId) {
    const usuario = await AuthModel.buscarUsuarioPorId(usuarioId);
    if (!usuario) throw new AppError('Usuario no encontrado', 404);
    return perfilPublico(usuario);
  },

  /**
   * Activa la cuenta de un trabajador que aún no tiene login.
   * Crea el usuario (rol según `trabajador.tipo`) y lo vincula.
   */
  async verificarCedula(cedula) {
    const fila = await AuthModel.verificarCedula(cedula);
    if (!fila) return { existe: false };

    // Determinar el label de tipo/rol más específico disponible
    const tipo = fila.rol_usuario
      ? (fila.rol_usuario === 'nomina' ? 'nomina_gestor' : fila.rol_usuario)
      : fila.tipo;

    return {
      existe: true,
      tiene_cuenta: !!fila.usuario_id,
      tipo,
      invitacion: fila.estado_vinculo === 'solicitado_por_empresa'
        ? { empresa_nombre: fila.empresa_nombre }
        : null,
    };
  },

  async activarCuenta({ cedula, email, password }) {
    const trabajadores = await AuthModel.buscarTrabajadoresPorCedula(cedula);
    if (trabajadores.length === 0) {
      throw new AppError('No se encontró un trabajador con esa cédula', 404);
    }
    if (trabajadores.length > 1) {
      throw new AppError(
        'Se encontró más de un trabajador con esa cédula. Contacta al administrador.',
        409
      );
    }

    const trabajador = trabajadores[0];
    if (trabajador.usuario_id) {
      throw new AppError('Este trabajador ya tiene una cuenta activa', 409);
    }

    const emailEnUso = await AuthModel.buscarUsuarioPorEmail(email);
    if (emailEnUso) {
      throw new AppError('El email ya está registrado', 409);
    }

    const rol = ROL_POR_TIPO[trabajador.tipo] || ROLES.TRABAJADOR_TURNOS;
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    let usuarioId;
    try {
      usuarioId = await AuthModel.activarCuentaTrabajador({
        trabajadorId: trabajador.id,
        empresa_id: trabajador.empresa_id,
        nombre: trabajador.nombre,
        apellido: trabajador.apellido,
        email,
        password_hash: passwordHash,
        rol,
      });
    } catch (err) {
      // ER_DUP_ENTRY: concurrent activation with same email beat this request to the INSERT
      if (err.code === 'ER_DUP_ENTRY') {
        throw new AppError('El email ya está registrado', 409);
      }
      throw err;
    }

    // Crear solicitudes de vinculación para las empresas pre-seleccionadas.
    if (rol === ROLES.TRABAJADOR_TURNOS && trabajador.empresas_postulacion) {
      const empresaIds = Array.isArray(trabajador.empresas_postulacion)
        ? trabajador.empresas_postulacion
        : JSON.parse(trabajador.empresas_postulacion);

      const TrabajadorEmpresaModel = require('../trabajador-empresa/trabajador-empresa.model');
      const ESTADOS = require('../../config/constants').ESTADOS_TRABAJADOR_EMPRESA;

      for (const empId of empresaIds) {
        try {
          const existente = await TrabajadorEmpresaModel.obtenerPorUsuarioEmpresa(usuarioId, empId);
          if (!existente) {
            await TrabajadorEmpresaModel.crear({
              usuarioId,
              empresaId: empId,
              estado: ESTADOS.SOLICITADO_POR_TRABAJADOR,
              iniciadoPor: 'trabajador',
            });
          }
        } catch (_e) {
          // Ignorar errores individuales — no bloquear la activación
        }
      }
    }

    return { usuario_id: usuarioId, email, rol };
  },

  /**
   * Actualiza nombre, apellido y/o email del usuario autenticado.
   */
  async actualizarPerfil(usuarioId, datos) {
    if (datos.email) {
      const existente = await AuthModel.buscarUsuarioPorEmail(datos.email);
      if (existente && existente.id !== usuarioId) {
        throw new AppError('El email ya está registrado', 409);
      }
    }
    await AuthModel.actualizarPerfil(usuarioId, datos);
    return AuthService.perfil(usuarioId);
  },

  async actualizarFoto(usuarioId, fotoB64) {
    await AuthModel.actualizarFotoPerfil(usuarioId, fotoB64 || null);
    return AuthService.perfil(usuarioId);
  },

  /**
   * Cambia la contraseña verificando la contraseña actual primero.
   */
  async cambiarPassword(usuarioId, passwordActual, passwordNueva) {
    const hash = await AuthModel.obtenerPasswordHash(usuarioId);
    if (!hash) throw new AppError('Usuario no encontrado', 404);

    const ok = await bcrypt.compare(passwordActual, hash);
    if (!ok) throw new AppError('La contraseña actual es incorrecta', 400);

    const nuevoHash = await bcrypt.hash(passwordNueva, BCRYPT_ROUNDS);
    await AuthModel.actualizarPassword(usuarioId, nuevoHash);
    await AuthModel.revocarRefreshTokensDeUsuario(usuarioId);
  },

  /**
   * Registro libre para trabajador_turnos (modelo marketplace).
   * No requiere cédula ni empresa preexistente: cualquier persona puede
   * registrarse y luego solicitar vinculación a empresas desde el directorio.
   */
  async registrarLibre({ nombre, apellido, email, telefono, password }) {
    const emailEnUso = await AuthModel.buscarUsuarioPorEmail(email);
    if (emailEnUso) {
      throw new AppError('El email ya está registrado', 409);
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const usuarioId = await AuthModel.registrarTrabajadorLibre({
      nombre,
      apellido: apellido || null,
      email,
      telefono: telefono || null,
      password_hash: passwordHash,
    });

    // Construir el objeto mínimo necesario para emitir tokens.
    const usuario = {
      id: usuarioId,
      empresa_id: null,
      rol: ROLES.TRABAJADOR_TURNOS,
      nombre,
    };
    const tokens = await emitirTokens(usuario);
    return {
      ...tokens,
      usuario: {
        id: usuarioId,
        empresa_id: null,
        nombre,
        apellido: apellido || null,
        email,
        rol: ROLES.TRABAJADOR_TURNOS,
      },
    };
  },

  /**
   * Registro público de empresa nueva.
   * Crea empresa + usuario admin_empresa en una transacción y devuelve tokens.
   */
  async registrarEmpresa({ nombreEmpresa, nit, descripcion, actividad, telefono, emailEmpresa, direccion, ciudad, nombre, apellido, email, password }) {
    const existente = await AuthModel.buscarUsuarioPorEmail(email);
    if (existente) throw new AppError('El email ya está registrado', 409);

    const base = nombreEmpresa.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const slug = `${base}-${crypto.randomBytes(3).toString('hex')}`;

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const { empresaId, usuarioId } = await AuthModel.registrarEmpresa({
      nombreEmpresa, slug, nit, descripcion, actividad, telefono, emailEmpresa, direccion, ciudad, nombre, apellido, email, passwordHash,
    });

    const usuario = { id: usuarioId, empresa_id: empresaId, rol: ROLES.ADMIN_EMPRESA, nombre };
    const tokens = await emitirTokens(usuario);
    return {
      ...tokens,
      usuario: { id: usuarioId, empresa_id: empresaId, nombre, apellido: apellido || null, email, rol: ROLES.ADMIN_EMPRESA },
    };
  },

  /** Devuelve todos los gestores de la empresa. */
  async listarGestores(empresaId) {
    return AuthModel.listarGestores(empresaId);
  },

  /** Activa o desactiva un gestor de la empresa. */
  async setActivoGestor(empresaId, gestorId, activo) {
    const actualizado = await AuthModel.setActivoGestor(empresaId, gestorId, activo);
    if (!actualizado) throw new AppError('Gestor no encontrado', 404);
  },

  /**
   * Crea un usuario gestor (jefe_turnos, jefe_nomina, nomina) para la empresa del admin.
   * Genera una contraseña temporal que se devuelve una sola vez.
   */
  async crearGestor(empresaId, { nombre, apellido, email, rol }) {
    const ROLES_PERMITIDOS = [ROLES.JEFE_TURNOS, ROLES.JEFE_NOMINA, ROLES.NOMINA];
    if (!ROLES_PERMITIDOS.includes(rol)) {
      throw new AppError(`Rol inválido. Usa: ${ROLES_PERMITIDOS.join(', ')}`, 400);
    }

    const existente = await AuthModel.buscarUsuarioPorEmail(email);
    if (existente) throw new AppError('Ya existe un usuario con ese email', 409);

    // Contraseña temporal: "Tmp" + 8 hex chars = 11 caracteres
    const passwordTemporal = 'Tmp' + crypto.randomBytes(4).toString('hex');
    const passwordHash = await bcrypt.hash(passwordTemporal, BCRYPT_ROUNDS);

    const id = await AuthModel.crearGestor({
      empresaId,
      nombre:       nombre.trim(),
      apellido:     apellido?.trim() || null,
      email:        email.trim().toLowerCase(),
      passwordHash,
      rol,
    });

    return {
      id,
      nombre:            nombre.trim(),
      apellido:          apellido?.trim() || null,
      email:             email.trim().toLowerCase(),
      rol,
      password_temporal: passwordTemporal,
    };
  },
};

module.exports = AuthService;
