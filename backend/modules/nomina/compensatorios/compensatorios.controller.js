'use strict';

const CompensatoriosService = require('./compensatorios.service');

exports.listar = async (req, res, next) => {
  try {
    const data = await CompensatoriosService.listar(
      req.empresa_id, req.usuario, { estado: req.query.estado }
    );
    res.json({ success: true, data });
  } catch (e) { next(e); }
};

exports.asignar = async (req, res, next) => {
  try {
    const data = await CompensatoriosService.asignar(
      req.empresa_id, req.usuario.sub, Number(req.params.id), req.body
    );
    res.json({ success: true, data });
  } catch (e) { next(e); }
};
