'use strict';

const AdminService = require('./admin.service');

const AdminController = {
  // GET /api/admin/empresas
  async listarEmpresas(req, res, next) {
    try {
      const { busqueda, plan, page, limit } = req.query;
      const activo =
        req.query.activo === 'true' ? true
        : req.query.activo === 'false' ? false
        : undefined;

      const resultado = await AdminService.listarEmpresas({
        busqueda,
        activo,
        plan,
        page: Number(page) || 1,
        limit: Math.min(Number(limit) || 20, 100),
      });

      res.json({ success: true, data: resultado, message: 'Empresas obtenidas' });
    } catch (err) {
      next(err);
    }
  },

  // GET /api/admin/empresas/:id
  async obtenerEmpresa(req, res, next) {
    try {
      const empresa = await AdminService.obtenerEmpresa(Number(req.params.id));
      res.json({ success: true, data: empresa, message: 'Empresa obtenida' });
    } catch (err) {
      next(err);
    }
  },

  // POST /api/admin/empresas
  async crearEmpresa(req, res, next) {
    try {
      const empresa = await AdminService.crearEmpresa(req.body);
      res.status(201).json({ success: true, data: empresa, message: 'Empresa creada' });
    } catch (err) {
      next(err);
    }
  },

  // PUT /api/admin/empresas/:id
  async actualizarEmpresa(req, res, next) {
    try {
      const empresa = await AdminService.actualizarEmpresa(Number(req.params.id), req.body);
      res.json({ success: true, data: empresa, message: 'Empresa actualizada' });
    } catch (err) {
      next(err);
    }
  },

  // PATCH /api/admin/empresas/:id/estado
  async cambiarEstadoEmpresa(req, res, next) {
    try {
      const empresa = await AdminService.cambiarEstadoEmpresa(
        Number(req.params.id),
        req.body.activo
      );
      res.json({ success: true, data: empresa, message: 'Estado actualizado' });
    } catch (err) {
      next(err);
    }
  },

  // POST /api/admin/empresas/:id/link-pago
  async generarLinkPago(req, res, next) {
    try {
      const resultado = await AdminService.generarLinkPago(
        Number(req.params.id),
        req.body
      );
      res.json({ success: true, data: resultado, message: 'Link de pago generado' });
    } catch (err) {
      next(err);
    }
  },

  // PATCH /api/admin/empresas/:id/suscripcion
  async gestionarSuscripcion(req, res, next) {
    try {
      const empresa = await AdminService.gestionarSuscripcion(
        Number(req.params.id),
        req.body
      );
      res.json({ success: true, data: empresa, message: 'Suscripción actualizada' });
    } catch (err) {
      next(err);
    }
  },

  // GET /api/admin/wompi-eventos
  async listarWompiEventos(req, res, next) {
    try {
      const { estado, page, limit } = req.query;
      const resultado = await AdminService.listarWompiEventos({
        estado: estado || undefined,
        page: Number(page) || 1,
        limit: Math.min(Number(limit) || 30, 100),
      });
      res.json({ success: true, data: resultado });
    } catch (err) { next(err); }
  },

  // POST /api/admin/wompi-eventos/:id/reintentar
  async reintentarWompiEvento(req, res, next) {
    try {
      const resultado = await AdminService.reintentarWompiEvento(Number(req.params.id));
      res.json({ success: true, data: resultado, message: 'Evento reintentado con éxito' });
    } catch (err) { next(err); }
  },

  // GET /api/admin/reportes/global
  async reportesGlobales(req, res, next) {
    try {
      const reportes = await AdminService.obtenerReportesGlobales();
      res.json({ success: true, data: reportes, message: 'Reportes globales obtenidos' });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = AdminController;
