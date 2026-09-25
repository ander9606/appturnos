'use strict';

const GeocodingService = require('./geocoding.service');

async function buscar(req, res) {
  const data = await GeocodingService.buscar(req.query.q);
  res.json({ success: true, data });
}

async function reverse(req, res) {
  const data = await GeocodingService.reverse(Number(req.query.lat), Number(req.query.lon));
  res.json({ success: true, data });
}

module.exports = { buscar, reverse };
