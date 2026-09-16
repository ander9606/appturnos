'use strict';

const express = require('express');
const { verificarToken, verificarRol } = require('../../../middleware/authMiddleware');
const PeriodosTurnosController = require('./periodos-turnos.controller');

const router = express.Router();

/**
 * GET /turnos/periodos
 * Listar períodos de pago de turnos de una empresa.
 *
 * Query:
 *   - page (default 1)
 *   - limit (default 50)
 *   - estado: abierto|cerrado|liquidado
 *   - esExtraNomina: true|false (filtrar por tipo de período)
 *   - fechaDesde, fechaHasta: rango de fechas
 */
router.get('/', verificarToken, verificarRol(['admin_empresa', 'jefe_turnos', 'jefe_nomina', 'nomina']),
  PeriodosTurnosController.listar
);

/**
 * GET /turnos/periodos/:id
 * Obtener detalles de un período específico.
 */
router.get('/:id', verificarToken, verificarRol(['admin_empresa', 'jefe_turnos', 'jefe_nomina', 'nomina']),
  PeriodosTurnosController.obtener
);

/**
 * POST /turnos/periodos/:id/cerrar
 * Cerrar un período (abierto → cerrado).
 * Asigna todas las asignaciones completadas en el rango a este período.
 */
router.post('/:id/cerrar', verificarToken, verificarRol(['admin_empresa', 'jefe_turnos']),
  PeriodosTurnosController.cerrar
);

/**
 * POST /turnos/periodos/:id/liquidar
 * Liquidar un período (cerrado → liquidado).
 * Marca que el período fue pagado.
 */
router.post('/:id/liquidar', verificarToken, verificarRol(['admin_empresa', 'jefe_turnos', 'jefe_nomina']),
  PeriodosTurnosController.liquidar
);

module.exports = router;
