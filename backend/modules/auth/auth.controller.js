'use strict';

const AuthService = require('./auth.service');

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

async function activarCuenta(req, res) {
  const { cedula, email, password } = req.body;
  const data = await AuthService.activarCuenta({ cedula, email, password });
  res.status(201).json({ success: true, data, message: 'Cuenta activada' });
}

/** Registro libre para trabajador_turnos (modelo marketplace). */
async function registrar(req, res) {
  const { nombre, apellido, email, password } = req.body;
  const data = await AuthService.registrarLibre({ nombre, apellido, email, password });
  res.status(201).json({ success: true, data, message: 'Cuenta creada. ¡Bienvenido!' });
}

async function actualizarPerfil(req, res) {
  const { nombre, apellido, email } = req.body;
  const data = await AuthService.actualizarPerfil(req.usuario.sub, { nombre, apellido, email });
  res.json({ success: true, data, message: 'Perfil actualizado' });
}

async function cambiarPassword(req, res) {
  const { password_actual, password_nueva } = req.body;
  await AuthService.cambiarPassword(req.usuario.sub, password_actual, password_nueva);
  res.json({ success: true, data: null, message: 'Contraseña actualizada. Inicia sesión de nuevo.' });
}

async function registrarEmpresa(req, res) {
  const { nombre_empresa, nit, descripcion, actividad, telefono, email_empresa, direccion, ciudad, nombre, apellido, email, password } = req.body;
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

module.exports = { login, refresh, logout, me, activarCuenta, registrar, registrarEmpresa, actualizarPerfil, cambiarPassword, crearGestor, listarGestores, setActivoGestor };
