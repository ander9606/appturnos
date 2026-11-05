'use strict';

const express = require('express');
const { body, param, query } = require('express-validator');
const { validar } = require('../../middleware/validator');
const { verificarToken, verificarRol } = require('../../middleware/authMiddleware');
const verificarSuscripcion = require('../../middleware/verificarSuscripcion');
const { ROLES } = require('../../config/constants');
const AppError = require('../../utils/AppError');
const GruposTurnoModel = require('./grupos-turno.model');
const ctrl = require('./grupos-turno.controller');

const router = express.Router();

const GESTIONAR = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_TURNOS];
const VER = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_TURNOS, ROLES.JEFE_NOMINA, ROLES.NOMINA];

const idParam = param('id').isInt({ min: 1 }).withMessage('id inválido');

// El lugar es opcional, pero con dirección y coordenadas juntas (el servicio lo verifica
// también para PATCH, donde puede llegar solo una parte). Con `null` se borra.
const reglasLugar = [
  body('lugar').optional({ values: 'null' }).isString().trim().isLength({ min: 1, max: 300 }).withMessage('Lugar inválido (máx. 300 caracteres)'),
  body('latitud').optional({ values: 'null' }).isFloat({ min: -90, max: 90 }).withMessage('Latitud inválida'),
  body('longitud').optional({ values: 'null' }).isFloat({ min: -180, max: 180 }).withMessage('Longitud inválida'),
];
const reglasNombre = body('nombre').isString().trim().isLength({ min: 1, max: 150 }).withMessage('Nombre requerido (máx. 150 caracteres)');
const reglaDescripcion = body('descripcion').optional({ values: 'null' }).isString().trim().isLength({ max: 5000 });

/**
 * Los grupos son una función que el super_admin activa por empresa (`usa_grupos_turno`).
 * Sin ella, las rutas responden 403 y nada cambia para el resto de clientes.
 */
async function requiereGrupos(req, _res, next) {
  try {
    if (await GruposTurnoModel.empresaUsaGrupos(req.empresa_id)) return next();
    return next(new AppError('Los grupos de turnos no están activados para tu empresa.', 403));
  } catch (err) {
    return next(err);
  }
}

router.use(verificarToken);

// GET /api/grupos-turno?estado=activo|cerrado|todos  (por defecto activo)
router.get(
  '/',
  verificarRol(VER),
  requiereGrupos,
  [query('estado').optional().isIn(['activo', 'cerrado', 'todos']).withMessage('estado debe ser activo, cerrado o todos')],
  validar,
  ctrl.listar
);

// GET /api/grupos-turno/:id — resumen + sus turnos por fecha
router.get('/:id', verificarRol(VER), requiereGrupos, [idParam], validar, ctrl.obtener);

// POST /api/grupos-turno
router.post(
  '/',
  verificarRol(GESTIONAR), requiereGrupos, verificarSuscripcion,
  [reglasNombre, reglaDescripcion, ...reglasLugar],
  validar,
  ctrl.crear
);

// PATCH /api/grupos-turno/:id — renombrar o cambiar el lugar por defecto
router.patch(
  '/:id',
  verificarRol(GESTIONAR), requiereGrupos, verificarSuscripcion,
  [idParam, reglasNombre.optional(), reglaDescripcion, ...reglasLugar],
  validar,
  ctrl.actualizar
);

// POST /api/grupos-turno/:id/cerrar | /reabrir
router.post('/:id/cerrar', verificarRol(GESTIONAR), requiereGrupos, verificarSuscripcion, [idParam], validar, ctrl.cerrar);
router.post('/:id/reabrir', verificarRol(GESTIONAR), requiereGrupos, verificarSuscripcion, [idParam], validar, ctrl.reabrir);

module.exports = router;
