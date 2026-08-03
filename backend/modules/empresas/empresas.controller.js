'use strict';

const EmpresasService = require('./empresas.service');

async function directorio(req, res) {
  const { busqueda, ciudad, page = 1, limit = 20 } = req.query;
  const data = await EmpresasService.directorio({
    busqueda,
    ciudad,
    page: Number(page),
    limit: Math.min(Number(limit), 50),
  });
  res.json({ success: true, data, message: 'Directorio de empresas' });
}

async function detalle(req, res) {
  const data = await EmpresasService.detalle(Number(req.params.id));
  res.json({ success: true, data, message: 'Detalle de empresa' });
}

async function miEmpresa(req, res) {
  const data = await EmpresasService.miEmpresa(req.empresa_id);
  res.json({ success: true, data, message: 'Mi empresa' });
}

async function actualizarMiEmpresa(req, res) {
  const {
    nombre, nit, ciudad, descripcion, actividad, logo_url,
    telefono, email_empresa, direccion, acepta_postulaciones, tipo_liquidacion,
  } = req.body;
  const datos = {};
  if (nombre               !== undefined) datos.nombre               = nombre;
  if (nit                  !== undefined) datos.nit                  = nit;
  if (ciudad               !== undefined) datos.ciudad               = ciudad;
  if (descripcion          !== undefined) datos.descripcion          = descripcion;
  if (actividad            !== undefined) datos.actividad            = actividad;
  if (logo_url             !== undefined) datos.logo_url             = logo_url;
  if (telefono             !== undefined) datos.telefono             = telefono;
  if (email_empresa        !== undefined) datos.email_empresa        = email_empresa;
  if (direccion            !== undefined) datos.direccion            = direccion;
  if (acepta_postulaciones !== undefined) datos.acepta_postulaciones = acepta_postulaciones ? 1 : 0;
  if (tipo_liquidacion     !== undefined) datos.tipo_liquidacion     = tipo_liquidacion;

  const data = await EmpresasService.actualizarMiEmpresa(req.empresa_id, datos, req.usuario.sub);
  res.json({ success: true, data, message: 'Empresa actualizada' });
}

async function generarLinkPago(req, res) {
  const { meses } = req.body;
  const data = await EmpresasService.generarLinkPago(req.empresa_id, { meses });
  res.json({ success: true, data, message: 'Link de pago generado' });
}

async function obtenerSuscripcion(req, res) {
  const data = await EmpresasService.estadoSuscripcion(req.empresa_id);
  res.json({ success: true, data });
}

module.exports = { directorio, detalle, miEmpresa, actualizarMiEmpresa, generarLinkPago, obtenerSuscripcion };
