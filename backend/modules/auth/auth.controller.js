'use strict';

const AuthService       = require('./auth.service');
const VerificacionSvc   = require('./verificacion.service');

/**
 * Controladores HTTP del módulo auth.
 * Express 5 reenvía automáticamente los rechazos de funciones async al
 * errorHandler, por lo que no se necesita try/catch aquí.
 */

async function login(req, res) {
  const { email, password } = req.body;
  const data = await AuthService.login(email, password);
  res.json({ success: true, data, message: 'Inicio de sesión exitoso' });
}

async function refresh(req, res) {
  const data = await AuthService.refresh(req.body.refresh_token);
  res.json({ success: true, data, message: 'Token renovado' });
}

async function logout(req, res) {
  await AuthService.logout(req.body.refresh_token);
  res.json({ success: true, data: null, message: 'Sesión cerrada' });
}

async function me(req, res) {
  const data = await AuthService.perfil(req.usuario.sub);
  res.json({ success: true, data, message: 'Perfil del usuario' });
}

async function verificarCedula(req, res) {
  const cedula = String(req.query.cedula ?? '').trim();
  if (!cedula) return res.status(400).json({ success: false, data: null, message: 'cedula requerida' });
  const data = await AuthService.verificarCedula(cedula);
  res.json({ success: true, data, message: 'Verificación de cédula' });
}

async function activarCuenta(req, res) {
  const { cedula, email, password } = req.body;
  const data = await AuthService.activarCuenta({ cedula, email, password });
  res.status(201).json({ success: true, data, message: 'Cuenta activada' });
}

/** Registro libre para trabajador_turnos (modelo marketplace). */
async function registrar(req, res) {
  const { nombre, apellido, email, telefono, password, email_token, telefono_token } = req.body;
  VerificacionSvc.validarTokenVerificacion(email_token, 'email', email);
  VerificacionSvc.validarTokenVerificacion(telefono_token, 'telefono', telefono);
  const data = await AuthService.registrarLibre({ nombre, apellido, email, telefono, password });
  res.status(201).json({ success: true, data, message: 'Cuenta creada. ¡Bienvenido!' });
}

async function actualizarFoto(req, res) {
  const data = await AuthService.actualizarFoto(req.usuario.sub, req.body.foto_b64 ?? null);
  res.json({ success: true, data, message: 'Foto de perfil actualizada' });
}

async function actualizarPerfil(req, res) {
  const { nombre, apellido, email, telefono } = req.body;
  const data = await AuthService.actualizarPerfil(req.usuario.sub, { nombre, apellido, email, telefono });
  res.json({ success: true, data, message: 'Perfil actualizado' });
}

async function cambiarPassword(req, res) {
  const { password_actual, password_nueva } = req.body;
  await AuthService.cambiarPassword(req.usuario.sub, password_actual, password_nueva);
  res.json({ success: true, data: null, message: 'Contraseña actualizada. Inicia sesión de nuevo.' });
}

async function registrarEmpresa(req, res) {
  const { nombre_empresa, nit, descripcion, actividad, telefono, email_empresa, direccion, ciudad,
          nombre, apellido, email, password, email_token, telefono_token } = req.body;
  VerificacionSvc.validarTokenVerificacion(email_token, 'email', email);
  if (telefono) VerificacionSvc.validarTokenVerificacion(telefono_token, 'telefono', telefono);
  const data = await AuthService.registrarEmpresa({
    nombreEmpresa: nombre_empresa, nit, descripcion, actividad, telefono,
    emailEmpresa: email_empresa, direccion, ciudad,
    nombre, apellido, email, password,
  });
  res.status(201).json({ success: true, data, message: '¡Empresa registrada! Bienvenido a AppTurnos.' });
}

async function crearGestor(req, res) {
  const { nombre, apellido, email, rol } = req.body;
  const data = await AuthService.crearGestor(req.empresa_id, { nombre, apellido, email, rol });
  res.status(201).json({ success: true, data, message: 'Gestor creado exitosamente' });
}

async function listarGestores(req, res) {
  const data = await AuthService.listarGestores(req.empresa_id);
  res.json({ success: true, data, message: 'Gestores de la empresa' });
}

async function setActivoGestor(req, res) {
  const gestorId = Number(req.params.id);
  const { activo } = req.body;
  await AuthService.setActivoGestor(req.empresa_id, gestorId, activo);
  res.json({ success: true, data: null, message: activo ? 'Gestor activado' : 'Gestor desactivado' });
}

async function enviarOtp(req, res) {
  const { tipo, destino } = req.body;
  await VerificacionSvc.enviarOtp(tipo, destino);
  res.json({ success: true, data: null, message: 'Código enviado' });
}

async function verificarOtp(req, res) {
  const { tipo, destino, codigo } = req.body;
  const token = await VerificacionSvc.verificarOtp(tipo, destino, codigo);
  res.json({ success: true, data: { token }, message: 'Verificado' });
}

async function aceptarTerminos(req, res) {
  const data = await AuthService.aceptarTerminos(req.usuario.sub);
  res.json({ success: true, data, message: 'Términos aceptados' });
}

/** Restablece la contraseña vía OTP de email (sin sesión). */
async function resetPassword(req, res) {
  const { email, password, email_token } = req.body;
  VerificacionSvc.validarTokenVerificacion(email_token, 'email', email);
  await AuthService.resetPassword(email, password);
  res.json({ success: true, data: null, message: 'Contraseña actualizada. Inicia sesión con tu nueva contraseña.' });
}

module.exports = { login, refresh, logout, me, verificarCedula, activarCuenta, registrar,
  registrarEmpresa, actualizarPerfil, actualizarFoto, cambiarPassword, crearGestor,
  listarGestores, setActivoGestor, enviarOtp, verificarOtp, aceptarTerminos, resetPassword };
