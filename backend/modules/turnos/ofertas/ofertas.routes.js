'use strict';

const express = require('express');
const { body, param, query } = require('express-validator');

const { validar } = require('../../../middleware/validator');
const { verificarToken, verificarRol } = require('../../../middleware/authMiddleware');
const { ROLES, ESTADOS_OFERTA } = require('../../../config/constants');
const ctrl = require('./ofertas.controller');

const router = express.Router();

// Permisos según la matriz de 06-AUTH.md.
const PUEDEN_VER = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_TURNOS, ROLES.TRABAJADOR_TURNOS];
const GESTIONAR = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_TURNOS];
const TRABAJADOR = [ROLES.TRABAJADOR_TURNOS];

const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const idParam = param('id').isInt({ min: 1 }).withMessage('id inválido');

// Reglas de oferta. En crear los campos clave son obligatorios; en
// actualizar todos son opcionales (PUT parcial).
function reglasOferta({ parcial }) {
  const obligatorio = (regla) => (parcial ? regla.optional() : regla);
  return [
    obligatorio(body('titulo').trim().notEmpty().withMessage('El título es obligatorio')),
    obligatorio(body('fecha').isISO8601().withMessage('fecha inválida (YYYY-MM-DD)')),
    obligatorio(
      body('hora_inicio').matches(RE_HORA).withMessage('hora_inicio inválida (HH:MM)')
    ),
    obligatorio(body('tarifa_dia').isFloat({ min: 0 }).withMessage('tarifa_dia inválida')),
    body('hora_fin_estimada')
      .optional({ values: 'falsy' })
      .matches(RE_HORA)
      .withMessage('hora_fin_estimada inválida (HH:MM)'),
    body('plazas_disponibles')
      .optional()
      .isInt({ min: 1 })
      .withMessage('plazas_disponibles debe ser un entero ≥ 1'),
    body('descripcion').optional({ values: 'falsy' }).isString(),
    body('lugar').optional({ values: 'falsy' }).isString(),
    body('latitud')
      .optional({ values: 'falsy' })
      .isFloat({ min: -90, max: 90 })
      .withMessage('latitud inválida'),
    body('longitud')
      .optional({ values: 'falsy' })
      .isFloat({ min: -180, max: 180 })
      .withMessage('longitud inválida'),
  ];
}

router.use(verificarToken);

// GET /api/turnos/ofertas
router.get(
  '/',
  verificarRol(PUEDEN_VER),
  [
    query('estado').optional().isIn(ESTADOS_OFERTA).withMessage('estado inválido'),
    query('fecha').optional().isISO8601().withMessage('fecha inválida'),
    query('page').optional().isInt({ min: 1 }).withMessage('page inválido'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit inválido'),
  ],
  validar,
  ctrl.listar
);

// GET /api/turnos/ofertas/:id
router.get('/:id', verificarRol(PUEDEN_VER), [idParam], validar, ctrl.obtener);

// POST /api/turnos/ofertas
router.post('/', verificarRol(GESTIONAR), reglasOferta({ parcial: false }), validar, ctrl.crear);

// PUT /api/turnos/ofertas/:id
router.put(
  '/:id',
  verificarRol(GESTIONAR),
  [idParam, ...reglasOferta({ parcial: true })],
  validar,
  ctrl.actualizar
);

// DELETE /api/turnos/ofertas/:id  (cancelar)
router.delete('/:id', verificarRol(GESTIONAR), [idParam], validar, ctrl.cancelar);

// POST /api/turnos/ofertas/:id/aplicar
router.post('/:id/aplicar', verificarRol(TRABAJADOR), [idParam], validar, ctrl.aplicar);

// DELETE /api/turnos/ofertas/:id/aplicar
router.delete('/:id/aplicar', verificarRol(TRABAJADOR), [idParam], validar, ctrl.retirar);

module.exports = router;
