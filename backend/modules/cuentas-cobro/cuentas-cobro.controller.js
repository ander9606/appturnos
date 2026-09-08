'use strict';

const CuentasCobroService = require('./cuentas-cobro.service');
const { generarCuentaCobroPdf } = require('../../utils/cuentaCobroPdf');

async function listar(req, res) {
  const data = await CuentasCobroService.listarMisCuentas(req.usuario);
  res.json({ success: true, data, message: 'Mis cuentas de cobro' });
}

async function listarSinFirmar(req, res) {
  const data = await CuentasCobroService.listarSinFirmar(req.usuario);
  res.json({ success: true, data, message: 'Cuentas de cobro sin firmar' });
}

async function obtener(req, res) {
  const data = await CuentasCobroService.obtener(req.empresa_id, Number(req.params.id), req.usuario);
  res.json({ success: true, data, message: 'Detalle de la cuenta de cobro' });
}

async function firmar(req, res) {
  const data = await CuentasCobroService.firmar(
    req.empresa_id,
    Number(req.params.id),
    req.usuario,
    req.body.firma_b64
  );
  res.json({ success: true, data, message: 'Cuenta de cobro firmada' });
}

async function regenerarParaPeriodo(req, res) {
  const data = await CuentasCobroService.generarParaPeriodo(req.empresa_id, Number(req.params.periodoId));
  res.json({ success: true, data, message: 'Cuentas de cobro regeneradas' });
}

async function pdf(req, res) {
  const cuenta = await CuentasCobroService.obtener(req.empresa_id, Number(req.params.id), req.usuario);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="cuenta-cobro-${cuenta.numero_cuenta}.pdf"`
  );
  generarCuentaCobroPdf(cuenta, res);
}

module.exports = { listar, listarSinFirmar, obtener, firmar, regenerarParaPeriodo, pdf };
