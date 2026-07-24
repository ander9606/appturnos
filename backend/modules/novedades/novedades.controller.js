'use strict';

const NovedadesService = require('./novedades.service');

async function listar(req, res) {
  const data = await NovedadesService.listar(
    req.empresa_id, Number(req.params.asignacionId), req.usuario
  );
  res.json({ success: true, data });
}

async function crear(req, res) {
  const data = await NovedadesService.crear(
    req.empresa_id,
    Number(req.params.asignacionId),
    req.body.tipo,
    req.body.descripcion,
    req.body.hora_evento || null,
    req.body.foto_b64 || null,
    req.usuario,
    req.body.latitud ?? null,
    req.body.longitud ?? null
  );
  res.status(201).json({ success: true, data });
}

module.exports = { listar, crear };
