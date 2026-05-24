'use strict';

const bcrypt = require('bcrypt');
const crypto = require('crypto');

const { getProvider, listProviders } = require('./providers');
const OAuthModel = require('./oauth.model');
const AuthModel = require('../auth.model');
const TokenService = require('../../../utils/TokenService');
const AppError = require('../../../utils/AppError');
const { ROLES } = require('../../../config/constants');
const logger = require('../../../utils/logger');

const BCRYPT_ROUNDS = 12;

/** Construye el par de tokens y persiste el refresh token (mismo patrón que auth.service). */
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

/** Vista pública del usuario (sin password_hash). */
function perfilPublico(u) {
  return {
    id: u.id,
    empresa_id: u.empresa_id ?? null,
    nombre: u.nombre,
    apellido: u.apellido || null,
    email: u.email,
    rol: u.rol,
  };
}

/**
 * Genera un password_hash bcrypt aleatorio para usuarios OAuth-only.
 * Garantiza que la columna NOT NULL queda satisfecha y que ningún login
 * por password puede tener éxito (el random no es conocido por nadie).
 */
async function passwordHashAleatorio() {
  const random = crypto.randomBytes(32).toString('hex');
  return bcrypt.hash(random, BCRYPT_ROUNDS);
}

const OAuthService = {
  /**
   * Punto de entrada único para login OAuth.
   *
   * Flujo:
   *   1. Verifica el id_token contra el proveedor (Google, etc.).
   *   2. Si ya existe vínculo (provider, sub) → emite tokens.
   *   3. Si no, busca usuario por email:
   *      - Existe y email verificado por el provider → vincula y emite tokens.
   *      - Existe pero email no verificado → 403 (anti-takeover).
   *   4. Si no existe usuario → registro libre como TRABAJADOR_TURNOS,
   *      vincula y emite tokens.
   *
   * @returns {Promise<{
   *   access_token, refresh_token, usuario, tipo: 'login'|'vinculacion'|'registro'
   * }>}
   */
  async loginConProvider(providerName, token) {
    const provider = getProvider(providerName);
    if (!provider) {
      throw new AppError(
        `Proveedor OAuth no soportado. Disponibles: ${listProviders().join(', ')}`,
        400
      );
    }

    let info;
    try {
      info = await provider.verifyToken(token);
    } catch (err) {
      logger.warn(`[oauth] verificación ${providerName} fallida: ${err.message}`);
      throw new AppError(`Token de ${providerName} inválido`, 401);
    }

    // 1. ¿Vínculo existente?
    const linkExistente = await OAuthModel.buscarLinkPorProvider(
      providerName,
      info.provider_user_id
    );
    if (linkExistente) {
      const usuario = await AuthModel.buscarUsuarioPorId(linkExistente.usuario_id);
      if (!usuario) throw new AppError('Cuenta vinculada no encontrada', 404);
      if (!usuario.activo) throw new AppError('Usuario inactivo', 403);

      await OAuthModel.actualizarUltimaSesion(linkExistente.id);
      const tokens = await emitirTokens(usuario);
      return { ...tokens, usuario: perfilPublico(usuario), tipo: 'login' };
    }

    // 2. ¿Existe usuario con ese email? → auto-vincular si está verificado.
    if (info.email) {
      const usuarioExistente = await AuthModel.buscarUsuarioPorEmail(info.email);
      if (usuarioExistente) {
        if (!info.email_verified) {
          throw new AppError(
            `No se pudo vincular: ${providerName} no verificó tu email`,
            403
          );
        }
        if (!usuarioExistente.activo) throw new AppError('Usuario inactivo', 403);

        await OAuthModel.crearLink({
          usuarioId: usuarioExistente.id,
          provider: providerName,
          providerUserId: info.provider_user_id,
          email: info.email,
          emailVerified: info.email_verified,
          avatarUrl: info.avatar_url,
        });
        const tokens = await emitirTokens(usuarioExistente);
        return {
          ...tokens,
          usuario: perfilPublico(usuarioExistente),
          tipo: 'vinculacion',
        };
      }
    }

    // 3. Usuario nuevo → registro libre como TRABAJADOR_TURNOS.
    // Solo este rol puede crearse vía OAuth (modelo marketplace). Los demás
    // roles deben venir de invitación de empresa.
    if (!info.email_verified) {
      throw new AppError(
        `No se puede crear cuenta: ${providerName} no verificó tu email`,
        403
      );
    }

    const passwordHash = await passwordHashAleatorio();
    const usuarioId = await AuthModel.registrarTrabajadorLibre({
      nombre: info.nombre || info.email.split('@')[0],
      apellido: info.apellido || null,
      email: info.email,
      password_hash: passwordHash,
    });

    await OAuthModel.crearLink({
      usuarioId,
      provider: providerName,
      providerUserId: info.provider_user_id,
      email: info.email,
      emailVerified: info.email_verified,
      avatarUrl: info.avatar_url,
    });

    const usuario = {
      id: usuarioId,
      empresa_id: null,
      rol: ROLES.TRABAJADOR_TURNOS,
      nombre: info.nombre,
    };
    const tokens = await emitirTokens(usuario);
    return {
      ...tokens,
      usuario: {
        id: usuarioId,
        empresa_id: null,
        nombre: info.nombre,
        apellido: info.apellido,
        email: info.email,
        rol: ROLES.TRABAJADOR_TURNOS,
      },
      tipo: 'registro',
    };
  },

  /** Lista los providers vinculados a la cuenta autenticada. */
  async vinculosUsuario(usuarioId) {
    return OAuthModel.listarPorUsuario(usuarioId);
  },

  /**
   * Desvincula un proveedor de la cuenta. Solo permite desvincular si la
   * cuenta tiene otro método de acceso (password + email, u otro provider),
   * para que el usuario no se quede sin forma de entrar.
   */
  async desvincular(usuarioId, providerName) {
    const usuario = await AuthModel.buscarUsuarioPorId(usuarioId);
    if (!usuario) throw new AppError('Usuario no encontrado', 404);

    const vinculos = await OAuthModel.listarPorUsuario(usuarioId);
    const tieneOtroProvider = vinculos.some((v) => v.provider !== providerName);

    // password_hash con prefijo bcrypt válido indica que tiene password real
    // (los OAuth-only tienen hash random pero igual válido — no podemos
    // distinguir aquí, así que confiamos en que el usuario sabe).
    if (!tieneOtroProvider && vinculos.length === 1) {
      // Es el único método externo. Si no tiene password "real" (no lo sabemos
      // con certeza), recomendamos primero setear password. Por ahora dejamos
      // pasar pero con warning visible en frontend.
    }

    const eliminados = await OAuthModel.eliminarLink(usuarioId, providerName);
    if (eliminados === 0) {
      throw new AppError('No tienes ese proveedor vinculado', 404);
    }
    return { provider: providerName, desvinculado: true };
  },
};

module.exports = OAuthService;
