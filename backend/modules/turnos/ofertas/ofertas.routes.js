'use strict';

const express = require('express');
const { body, param, query } = require('express-validator');

const { validar } = require('../../../middleware/validator');
const { verificarToken, verificarRol, resolverEmpresasActivas } = require('../../../middleware/authMiddleware');
const verificarSuscripcion = require('../../../middleware/verificarSuscripcion');
const { ROLES, ESTADOS_OFERTA } = require('../../../config/constants');
const ctrl = require('./ofertas.controller');
const puestosRouter = require('./puestos/puestos.routes');

const router = express.Router();

const PUEDEN_VER = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_TURNOS, ROLES.JEFE_NOMINA, ROLES.TRABAJADOR_TURNOS, ROLES.TRABAJADOR_NOMINA];
const GESTIONAR  = [ROLES.ADMIN_EMPRESA, ROLES.JEFE_TURNOS, ROLES.JEFE_NOMINA];
const TRABAJADOR = [ROLES.TRABAJADOR_TURNOS, ROLES.TRABAJADOR_NOMINA];

const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const idParam = param('id').isInt({ min: 1 }).withMessage('id inválido');

// Reglas de oferta. En crear los campos clave son obligatorios; en
// actualizar todos son opcionales (PUT parcial). Los puestos van en su
// propio array y se validan adicionalmente en el service.
function reglasOferta({ parcial }) {
  const obligatorio = (regla) => (parcial ? regla.optional() : regla);
  return [
    obligatorio(body('titulo').trim().notEmpty().withMessage('El título es obligatorio')),
    obligatorio(body('fecha').isISO8601().withMessage('fecha inválida (YYYY-MM-DD)')),
    obligatorio(
      body('hora_inicio').matches(RE_HORA).withMessage('hora_inicio inválida (HH:MM)')
    ),
    body('hora_fin_estimada')
      .optional({ values: 'falsy' })
      .matches(RE_HORA)
      .withMessage('hora_fin_estimada inválida (HH:MM)'),
    body('para_quien').optional().isIn(['turnos','nomina','ambos']).withMessage('para_quien inválido'),
    body('descripcion').optional({ values: 'falsy' }).isString(),
    body('lugar').optional({ values: 'falsy' }).isString(),
    body('encargado_nombre').optional({ values: 'falsy' }).isString().trim().isLength({ max: 150 }),
    body('encargado_telefono').optional({ values: 'falsy' }).isString().trim().isLength({ max: 20 }),
    body('latitud')
      .optional({ values: 'falsy' })
      .isFloat({ min: -90, max: 90 })
      .withMessage('latitud inválida'),
    body('longitud')
      .optional({ values: 'falsy' })
      .isFloat({ min: -180, max: 180 })
      .withMessage('longitud inválida'),
    // Puestos solo se aceptan en crear (no en PUT de actualizar).
    ...(parcial
      ? []
      : [
          body('puestos')
            .optional()
            .isArray()
            .withMessage('puestos debe ser un array'),
          body('puestos.*.cargo_id').isInt({ min: 1 }).withMessage('cargo_id requerido'),
          body('puestos.*.plazas').optional().isInt({ min: 1 }),
          body('puestos.*.tarifa_dia').isFloat({ min: 0 }).withMessage('tarifa_dia inválida'),
          body('puestos.*.notas').optional().isString().trim().isLength({ max: 255 }),
        ]),
  ];
}

router.use(verificarToken);
router.use(resolverEmpresasActivas);

// GET /api/turnos/ofertas
router.get(
  '/',
  verificarRol(PUEDEN_VER),
  [
    query('estado').optional().isIn(ESTADOS_OFERTA).withMessage('estado inválido'),
    query('fecha').optional().isISO8601().withMessage('fecha inválida'),
    query('para_quien').optional().isIn(['turnos','nomina','ambos']).withMessage('para_quien inválido'),
    query('page').optional().isInt({ min: 1 }).withMessage('page inválido'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit inválido'),
  ],
  validar,
  ctrl.listar
);

// GET /api/turnos/ofertas/:id
router.get('/:id', verificarRol(PUEDEN_VER), [idParam], validar, ctrl.obtener);

// POST /api/turnos/ofertas
router.post('/', verificarRol(GESTIONAR), verificarSuscripcion, reglasOferta({ parcial: false }), validar, ctrl.crear);

// PUT /api/turnos/ofertas/:id
router.put(
  '/:id',
  verificarRol(GESTIONAR),
  [idParam, ...reglasOferta({ parcial: true })],
  validar,
  ctrl.actualizar
);

// POST /api/turnos/ofertas/:id/publicar  — pasa una oferta de 'borrador' a 'publicada'
router.post('/:id/publicar', verificarRol(GESTIONAR), [idParam], validar, ctrl.publicar);

// DELETE /api/turnos/ofertas/:id  (cancelar)
router.delete('/:id', verificarRol(GESTIONAR), [idParam], validar, ctrl.cancelar);

// DELETE /api/turnos/ofertas/:id/definitivo  (borrar oferta cancelada sin postulantes)
router.delete('/:id/definitivo', verificarRol(GESTIONAR), [idParam], validar, ctrl.eliminarDefinitivo);

// POST /api/turnos/ofertas/:id/aplicar  — body: { puesto_id }
router.post(
  '/:id/aplicar',
  verificarRol(TRABAJADOR),
  [idParam, body('puesto_id').isInt({ min: 1 }).withMessage('puesto_id requerido')],
  validar,
  ctrl.aplicar
);

// DELETE /api/turnos/ofertas/:id/aplicar  — body: { puesto_id }
router.delete(
  '/:id/aplicar',
  verificarRol(TRABAJADOR),
  [idParam, body('puesto_id').isInt({ min: 1 }).withMessage('puesto_id requerido')],
  validar,
  ctrl.retirar
);

// POST /api/turnos/ofertas/:id/asignar  — gestores asignan directamente sin postulación
router.post(
  '/:id/asignar',
  verificarRol(GESTIONAR),
  [
    idParam,
    body('puesto_id').isInt({ min: 1 }).withMessage('puesto_id requerido'),
    body('trabajador_id').isInt({ min: 1 }).withMessage('trabajador_id requerido'),
  ],
  validar,
  ctrl.asignar
);

// POST /api/turnos/ofertas/:id/cerrar  — cierre masivo de jornada con excepciones opcionales
router.post(
  '/:id/cerrar',
  verificarRol(GESTIONAR),
  [
    idParam,
    body('excepciones').optional().isArray().withMessage('excepciones debe ser un array'),
    body('excepciones.*').isInt({ min: 1 }).withMessage('cada excepción debe ser un trabajador_id entero'),
  ],
  validar,
  ctrl.cerrar
);

// POST /api/turnos/ofertas/:id/duplicar  — copia la oferta a una nueva fecha
router.post(
  '/:id/duplicar',
  verificarRol(GESTIONAR),
  [idParam, body('fecha').isISO8601().withMessage('fecha inválida (YYYY-MM-DD)')],
  validar,
  ctrl.duplicar
);

// Sub-router de puestos: /api/turnos/ofertas/:id/puestos/...
router.use('/:id/puestos', puestosRouter);

module.exports = router;
