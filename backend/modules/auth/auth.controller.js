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

module.exports = { login, refresh, logout, me, activarCuenta, registrar };
