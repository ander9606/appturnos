'use strict';

const express = require('express');
const { body, param, query } = require('express-validator');

const { validar } = require('../../middleware/validator');
const { verificarToken, verificarRol } = require('../../middleware/authMiddleware');
const { ROLES } = require('../../config/constants');
const ctrl = require('./trabajadores.controller');

const router = express.Router();

// Permisos según la matriz de 06-AUTH.md.
const PUEDEN_VER = [
  ROLES.ADMIN_EMPRESA,
  ROLES.JEFE_TURNOS,
  ROLES.JEFE_NOMINA,
  ROLES.NOMINA,
];
const SOLO_ADMIN = [ROLES.ADMIN_EMPRESA];
const SOLO_TRABAJADOR_TURNOS = [ROLES.TRABAJADOR_TURNOS];
const SOLO_TRABAJADOR_NOMINA = [ROLES.TRABAJADOR_NOMINA];
const CUALQUIER_TRABAJADOR   = [ROLES.TRABAJADOR_TURNOS, ROLES.TRABAJADOR_NOMINA];

const TIPOS = ['nomina', 'turnos', 'ambos'];

// Reglas reutilizables. En crear los campos clave son obligatorios;
// en actualizar todos son opcionales (PUT parcial).
function reglasTrabajador({ parcial }) {
  const texto = (campo) =>
    parcial
      ? body(campo).optional().trim().notEmpty().withMessage(`${campo} no puede ir vacío`)
      : body(campo).trim().notEmpty().withMessage(`El campo ${campo} es obligatorio`);
  return [
    texto('nombre'),
    texto('apellido'),
    body('tipo').optional().isIn(TIPOS).withMessage('Tipo inválido (nomina | turnos | ambos)'),
    body('email').optional({ values: 'falsy' }).isEmail().withMessage('Email inválido'),
    body('tarifa_hora').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('tarifa_hora inválida'),
    body('salario_base').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('salario_base inválido'),
    body('cedula').optional({ values: 'falsy' }).isString().trim(),
    body('telefono').optional({ values: 'falsy' }).isString().trim(),
    body('cargo').optional({ values: 'falsy' }).isString().trim(),
    body('external_ref').optional({ values: 'falsy' }).isString().trim(),
    // Perfil extendido (todos opcionales)
    body('tipo_documento').optional().isIn(['CC', 'CE', 'PAS']).withMessage('tipo_documento inválido'),
    body('fecha_nacimiento').optional({ values: 'falsy' }).isISO8601().withMessage('fecha_nacimiento debe ser YYYY-MM-DD'),
    body('sexo').optional().isIn(['M', 'F', 'otro']).withMessage('sexo inválido'),
    body('contacto_emergencia_nombre').optional({ values: 'falsy' }).isString().trim(),
    body('contacto_emergencia_tel').optional({ values: 'falsy' }).isString().trim(),
    body('eps').optional({ values: 'falsy' }).isString().trim(),
    body('afp').optional({ values: 'falsy' }).isString().trim(),
    body('banco').optional({ values: 'falsy' }).isString().trim(),
    body('tipo_cuenta').optional().isIn(['ahorros', 'corriente']).withMessage('tipo_cuenta inválido'),
    body('numero_cuenta').optional({ values: 'falsy' }).isString().trim(),
    body('ant_judiciales_fecha').optional({ values: 'falsy' }).isISO8601().withMessage('ant_judiciales_fecha debe ser YYYY-MM-DD'),
    body('ant_disciplinarios_fecha').optional({ values: 'falsy' }).isISO8601().withMessage('ant_disciplinarios_fecha debe ser YYYY-MM-DD'),
    body('experiencias').optional().isArray(),
    body('diplomas').optional().isArray(),
    body('cargo_ids').optional().isArray(),
  ];
}

const idParam = param('id').isInt({ min: 1 }).withMessage('id inválido');

// Todas las rutas requieren autenticación.
router.use(verificarToken);

// GET /api/trabajadores/me — el trabajador obtiene su propio perfil completo.
// Debe ir ANTES de /:id para que Express no interprete "me" como un ID numérico.
router.get('/me', verificarRol(CUALQUIER_TRABAJADOR), ctrl.obtenerMe);

// PATCH /api/trabajadores/me — el trabajador actualiza sus datos de perfil
router.patch(
  '/me',
  verificarRol(CUALQUIER_TRABAJADOR),
  [
    body('tipo_documento').optional().isIn(['CC', 'CE', 'PAS']).withMessage('tipo_documento inválido'),
    body('cedula').optional({ values: 'falsy' }).isString().trim(),
    body('fecha_nacimiento').optional({ values: 'falsy' }).isISO8601().withMessage('fecha_nacimiento debe ser YYYY-MM-DD'),
    body('sexo').optional().isIn(['M', 'F', 'otro']).withMessage('sexo inválido'),
    body('telefono').optional({ values: 'falsy' }).isString().trim(),
    body('contacto_emergencia_nombre').optional({ values: 'falsy' }).isString().trim(),
    body('contacto_emergencia_tel').optional({ values: 'falsy' }).isString().trim(),
    body('eps').optional({ values: 'falsy' }).isString().trim(),
    body('afp').optional({ values: 'falsy' }).isString().trim(),
    body('banco').optional({ values: 'falsy' }).isString().trim(),
    body('tipo_cuenta').optional().isIn(['ahorros', 'corriente']).withMessage('tipo_cuenta inválido'),
    body('numero_cuenta').optional({ values: 'falsy' }).isString().trim(),
    body('ant_judiciales_fecha').optional({ values: 'falsy' }).isISO8601().withMessage('fecha inválida'),
    body('ant_disciplinarios_fecha').optional({ values: 'falsy' }).isISO8601().withMessage('fecha inválida'),
  ],
  validar,
  ctrl.actualizarMe
);

// PATCH /api/trabajadores/me/extras — el trabajador_nomina activa/desactiva extras
router.patch(
  '/me/extras',
  verificarRol(SOLO_TRABAJADOR_NOMINA),
  [body('acepta_extras').isBoolean().withMessage('acepta_extras debe ser booleano')],
  validar,
  ctrl.actualizarExtras
);

// POST /api/trabajadores/me/experiencias
router.post(
  '/me/experiencias',
  verificarRol(SOLO_TRABAJADOR_TURNOS),
  [
    body('empresa_nombre').isString().trim().notEmpty().withMessage('empresa_nombre requerido'),
    body('cargo').isString().trim().notEmpty().withMessage('cargo requerido'),
    body('fecha_inicio').isISO8601().withMessage('fecha_inicio debe ser YYYY-MM-DD'),
    body('fecha_fin').optional({ values: 'falsy' }).isISO8601().withMessage('fecha_fin debe ser YYYY-MM-DD'),
  ],
  validar,
  ctrl.crearExperiencia
);

// DELETE /api/trabajadores/me/experiencias/:expId
router.delete(
  '/me/experiencias/:expId',
  verificarRol(SOLO_TRABAJADOR_TURNOS),
  [param('expId').isInt({ min: 1 }).withMessage('expId inválido')],
  validar,
  ctrl.eliminarExperiencia
);

// POST /api/trabajadores/me/diplomas
router.post(
  '/me/diplomas',
  verificarRol(SOLO_TRABAJADOR_TURNOS),
  [
    body('titulo').isString().trim().notEmpty().withMessage('titulo requerido'),
    body('institucion').isString().trim().notEmpty().withMessage('institucion requerido'),
    body('anio').optional({ values: 'falsy' }).isInt({ min: 1900, max: 2100 }).withMessage('anio inválido'),
  ],
  validar,
  ctrl.crearDiploma
);

// DELETE /api/trabajadores/me/diplomas/:dipId
router.delete(
  '/me/diplomas/:dipId',
  verificarRol(SOLO_TRABAJADOR_TURNOS),
  [param('dipId').isInt({ min: 1 }).withMessage('dipId inválido')],
  validar,
  ctrl.eliminarDiploma
);

// GET /api/trabajadores/buscar?cedula=X — búsqueda cross-empresa por cédula (solo marketplace workers)
// Debe ir ANTES de /:id
router.get(
  '/buscar',
  verificarRol([ROLES.ADMIN_EMPRESA, ROLES.JEFE_TURNOS]),
  [query('cedula').isString().trim().notEmpty().withMessage('cedula requerida')],
  validar,
  ctrl.buscarPorCedula
);

// GET /api/trabajadores
router.get(
  '/',
  verificarRol(PUEDEN_VER),
  [
    query('tipo').optional().isIn(TIPOS).withMessage('Tipo inválido'),
    query('page').optional().isInt({ min: 1 }).withMessage('page inválido'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit inválido'),
  ],
  validar,
  ctrl.listar
);

// GET /api/trabajadores/:id
router.get('/:id', verificarRol(PUEDEN_VER), [idParam], validar, ctrl.obtener);

// POST /api/trabajadores
router.post('/', verificarRol(SOLO_ADMIN), reglasTrabajador({ parcial: false }), validar, ctrl.crear);

// PUT /api/trabajadores/:id
router.put(
  '/:id',
  verificarRol(SOLO_ADMIN),
  [idParam, ...reglasTrabajador({ parcial: true })],
  validar,
  ctrl.actualizar
);

// DELETE /api/trabajadores/:id  (soft delete)
router.delete('/:id', verificarRol(SOLO_ADMIN), [idParam], validar, ctrl.eliminar);

module.exports = router;
