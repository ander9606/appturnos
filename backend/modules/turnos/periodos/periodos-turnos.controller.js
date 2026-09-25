'use strict';

const PeriodosTurnosService = require('./periodos-turnos.service');

const PeriodosTurnosController = {
  async listar(req, res, next) {
    try {
      const { page = 1, limit = 50, estado, esExtraNomina, fechaDesde, fechaHasta } = req.query;
      const resultado = await PeriodosTurnosService.listar(req.empresa_id, {
        page: Number(page),
        limit: Number(limit),
        estado,
        esExtraNomina: esExtraNomina ? esExtraNomina === 'true' : undefined,
        fechaDesde,
        fechaHasta,
      }, req.usuario);

      res.json({ success: true, data: resultado.data, pagination: resultado.pagination });
    } catch (err) {
      next(err);
    }
  },

  async obtener(req, res, next) {
    try {
      const { id } = req.params;
      const periodo = await PeriodosTurnosService.obtener(req.empresa_id, Number(id));
      res.json({ success: true, data: periodo });
    } catch (err) {
      next(err);
    }
  },

  async cerrar(req, res, next) {
    try {
      const { id } = req.params;
      const periodo = await PeriodosTurnosService.cerrar(
        req.empresa_id,
        Number(id),
        req.usuario.sub
      );
      res.json({ success: true, data: periodo, message: 'Período cerrado y asignaciones vinculadas' });
    } catch (err) {
      next(err);
    }
  },

  async liquidar(req, res, next) {
    try {
      const { id } = req.params;
      const periodo = await PeriodosTurnosService.liquidar(req.empresa_id, Number(id));
      res.json({ success: true, data: periodo, message: 'Período liquidado' });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = PeriodosTurnosController;
