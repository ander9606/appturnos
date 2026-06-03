'use strict';

const express = require('express');
const { body, param, query } = require('express-validator');

const { validar } = require('../../../middleware/validator');
const { verificarToken, verificarRol } = require('../../../middleware/authMiddleware');
const { ROLES } = require('../../../config/constants');
const ctrl = require('./asignaciones.controller');

const router = express.Router();

// Permisos según la matriz de 06-AUTH.md.
const GESTIONAR = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_TURNOS];
const TRABAJADOR = [ROLES.TRABAJADOR_TURNOS];

const idParam = param('id').isInt({ min: 1 }).withMessage('id inválido');

// Coordenadas GPS obligatorias para el marcaje de ingreso.
const reglasCoordenadas = [
  body('latitud').isFloat({ min: -90, max: 90 }).withMessage('latitud requerida y válida'),
  body('longitud').isFloat({ min: -180, max: 180 }).withMessage('longitud requerida y válida'),
];

router.use(verificarToken);

// GET /api/turnos/asignaciones/liquidacion
// Debe ir antes de /:id para que Express no trate "liquidacion" como ID.
router.get(
  '/liquidacion',
  verificarRol(GESTIONAR),
  [
    query('fecha_inicio').optional().isISO8601().withMessage('fecha_inicio inválida'),
    query('fecha_fin').optional().isISO8601().withMessage('fecha_fin inválida'),
  ],
  validar,
  ctrl.liquidacion
);

// GET /api/turnos/asignaciones
router.get(
  '/',
  verificarRol(GESTIONAR),
  [
    query('fecha').optional().isISO8601().withMessage('fecha inválida'),
    query('oferta_id').optional().isInt({ min: 1 }).withMessage('oferta_id inválido'),
    query('trabajador_id').optional().isInt({ min: 1 }).withMessage('trabajador_id inválido'),
    query('estado').optional().isIn(['pendiente','confirmado','en_progreso','completado','no_presentado','cancelado']).withMessage('estado inválido'),
    query('page').optional().isInt({ min: 1 }).withMessage('page inválido'),
    query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('limit inválido'),
  ],
  validar,
  ctrl.listar
);

// GET /api/turnos/asignaciones/:id  (gestores ven cualquiera; trabajador solo las propias)
router.get('/:id', verificarRol([...GESTIONAR, ...TRABAJADOR]), [idParam], validar, ctrl.obtener);

// POST /api/turnos/asignaciones/:id/confirmar
router.post('/:id/confirmar', verificarRol(GESTIONAR), [idParam], validar, ctrl.confirmar);

// POST /api/turnos/asignaciones/:id/rechazar
router.post('/:id/rechazar', verificarRol(GESTIONAR), [idParam], validar, ctrl.rechazar);

// POST /api/turnos/asignaciones/:id/cancelar  (confirmado → cancelado, devuelve plaza)
router.post('/:id/cancelar', verificarRol(GESTIONAR), [idParam], validar, ctrl.cancelar);

// POST /api/turnos/asignaciones/:id/ingreso
router.post(
  '/:id/ingreso',
  verificarRol(TRABAJADOR),
  [idParam, ...reglasCoordenadas],
  validar,
  ctrl.ingreso
);

// POST /api/turnos/asignaciones/:id/egreso
router.post(
  '/:id/egreso',
  verificarRol(TRABAJADOR),
  [idParam, body('firma_b64').isString().notEmpty().withMessage('firma_b64 requerida')],
  validar,
  ctrl.egreso
);

// POST /api/turnos/asignaciones/:id/calificar  (jefe/admin califica el turno)
router.post(
  '/:id/calificar',
  verificarRol(GESTIONAR),
  [
    idParam,
    body('calificacion')
      .isInt({ min: 1, max: 5 })
      .withMessage('calificacion debe ser un entero entre 1 y 5'),
    body('comentario').optional({ values: 'falsy' }).isString().isLength({ max: 500 }),
  ],
  validar,
  ctrl.calificar
);

module.exports = router;
