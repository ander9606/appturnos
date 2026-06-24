'use strict';

const svc = require('./turnos-eventual.service');

const ctrl = {
  async periodoActivo(req, res, next) {
    try {
      const periodo = await svc.autoCrear(req.empresa_id);
      res.json({ success: true, data: periodo });
    } catch (err) { next(err); }
  },

  async liquidacion(req, res, next) {
    try {
      const data = await svc.liquidacion(req.empresa_id, Number(req.params.id));
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async liquidar(req, res, next) {
    try {
      const data = await svc.liquidar(req.empresa_id, Number(req.params.id));
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },
};

module.exports = ctrl;
