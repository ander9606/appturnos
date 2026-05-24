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

module.exports = { directorio, detalle };
