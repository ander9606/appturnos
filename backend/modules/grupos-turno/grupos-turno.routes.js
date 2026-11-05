'use strict';

const express = require('express');
const { body, param, query } = require('express-validator');
const { validar } = require('../../middleware/validator');
const { verificarToken, verificarRol } = require('../../middleware/authMiddleware');
const verificarSuscripcion = require('../../middleware/verificarSuscripcion');
const requiereGruposTurno = require('../../middleware/requiereGruposTurno');
const { ROLES } = require('../../config/constants');
const ctrl = require('./grupos-turno.controller');

const router = express.Router();

const GESTIONAR = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_TURNOS];
const VER = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_TURNOS, ROLES.JEFE_NOMINA, ROLES.NOMINA];

const idParam = param('id').isInt({ min: 1 }).withMessage('id inválido');

// El lugar es opcional, pero con dirección y coordenadas juntas (el servicio lo verifica
// también para PATCH, donde puede llegar solo una parte). Con `null` se borra.
const reglasLugar = [
  body('lugar').optional({ values: 'null' }).isString().trim().isLength({ min: 1, max: 300 }).withMessage('Lugar inválido (máx. 300 caracteres)'),
  body('lugar_alias').optional({ values: 'null' }).isString().trim().isLength({ max: 80 }).withMessage('El nombre corto del lugar admite hasta 80 caracteres'),
  body('latitud').optional({ values: 'null' }).isFloat({ min: -90, max: 90 }).withMessage('Latitud inválida'),
  body('longitud').optional({ values: 'null' }).isFloat({ min: -180, max: 180 }).withMessage('Longitud inválida'),
];
const reglasNombre = body('nombre').isString().trim().isLength({ min: 1, max: 150 }).withMessage('Nombre requerido (máx. 150 caracteres)');
const reglaDescripcion = body('descripcion').optional({ values: 'null' }).isString().trim().isLength({ max: 5000 });

router.use(verificarToken);

// GET /api/grupos-turno?estado=activo|cerrado|todos  (por defecto activo)
router.get(
  '/',
  verificarRol(VER),
  requiereGruposTurno,
  [query('estado').optional().isIn(['activo', 'cerrado', 'todos']).withMessage('estado debe ser activo, cerrado o todos')],
  validar,
  ctrl.listar
);

// GET /api/grupos-turno/:id — resumen + sus turnos por fecha
router.get('/:id', verificarRol(VER), requiereGruposTurno, [idParam], validar, ctrl.obtener);

// POST /api/grupos-turno
router.post(
  '/',
  verificarRol(GESTIONAR), requiereGruposTurno, verificarSuscripcion,
  [reglasNombre, reglaDescripcion, ...reglasLugar],
  validar,
  ctrl.crear
);

// PATCH /api/grupos-turno/:id — renombrar o cambiar el lugar por defecto
router.patch(
  '/:id',
  verificarRol(GESTIONAR), requiereGruposTurno, verificarSuscripcion,
  [idParam, reglasNombre.optional(), reglaDescripcion, ...reglasLugar],
  validar,
  ctrl.actualizar
);

// POST /api/grupos-turno/:id/cerrar | /reabrir
router.post('/:id/cerrar', verificarRol(GESTIONAR), requiereGruposTurno, verificarSuscripcion,
  [idParam, body('confirmar').optional().isBoolean().withMessage('confirmar debe ser verdadero o falso')], validar, ctrl.cerrar);
router.post('/:id/reabrir', verificarRol(GESTIONAR), requiereGruposTurno, verificarSuscripcion, [idParam], validar, ctrl.reabrir);

module.exports = router;
