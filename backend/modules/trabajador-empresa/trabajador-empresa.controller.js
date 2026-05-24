'use strict';

const TrabajadorEmpresaService = require('./trabajador-empresa.service');

async function solicitar(req, res) {
  const usuarioId = req.usuario.sub;
  const empresaId = Number(req.body.empresa_id);
  const data = await TrabajadorEmpresaService.solicitar(usuarioId, empresaId);
  res.status(201).json({ success: true, data, message: 'Solicitud enviada' });
}

async function invitar(req, res) {
  const empresaId = req.empresa_id;
  const { cedula } = req.body;
  const data = await TrabajadorEmpresaService.invitar(empresaId, cedula);
  res.status(201).json({ success: true, data, message: 'Invitación enviada' });
}

async function aprobar(req, res) {
  const empresaId = req.empresa_id;
  const relacionId = Number(req.params.id);
  const data = await TrabajadorEmpresaService.aprobar(empresaId, relacionId);
  res.json({ success: true, data, message: 'Solicitud aprobada' });
}

async function aceptar(req, res) {
  const usuarioId = req.usuario.sub;
  const relacionId = Number(req.params.id);
  const data = await TrabajadorEmpresaService.aceptar(usuarioId, relacionId);
  res.json({ success: true, data, message: 'Invitación aceptada' });
}

async function rechazar(req, res) {
  const data = await TrabajadorEmpresaService.rechazar(
    req.usuario.sub,
    req.usuario.rol,
    Number(req.params.id),
    req.body.motivo || null
  );
  res.json({ success: true, data, message: 'Solicitud rechazada' });
}

async function archivar(req, res) {
  const data = await TrabajadorEmpresaService.archivar(
    req.usuario.sub,
    req.usuario.rol,
    Number(req.params.id)
  );
  res.json({ success: true, data, message: 'Relación archivada' });
}

async function misEmpresas(req, res) {
  const data = await TrabajadorEmpresaService.misEmpresas(req.usuario.sub);
  res.json({ success: true, data, message: 'Mis empresas' });
}

async function solicitudes(req, res) {
  const empresaId = req.empresa_id;
  const { estado } = req.query;
  const data = await TrabajadorEmpresaService.solicitudesPorEmpresa(empresaId, estado);
  res.json({ success: true, data, message: 'Solicitudes de vinculación' });
}

module.exports = { solicitar, invitar, aprobar, aceptar, rechazar, archivar, misEmpresas, solicitudes };
