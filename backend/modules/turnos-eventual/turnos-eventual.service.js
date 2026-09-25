'use strict';

const TurnosEventualModel = require('./turnos-eventual.model');
const EmpresasModel = require('../empresas/empresas.model');
const TrabajadoresModel = require('../trabajadores/trabajadores.model');
const AppError = require('../../utils/AppError');
const { ROLES } = require('../../config/constants');
const { calcularPeriodoActual } = require('../../utils/periodoCiclo');

/**
 * Cadencia y alcance de cada segmento de turnos eventuales.
 *   nomina  → trabajadores de nómina que además toman turnos recurrentes
 *             ocasionales; se acumulan y liquidan trimestralmente.
 *   turnos  → personal de apoyo 100% turnos, sin salario base; se les paga
 *             en el mismo ciclo que la nómina regular de la empresa.
 */
const SEGMENTOS = {
  nomina: {
    tipo: () => 'trimestral',
    // trabajadores.tipo, no ofertas_turno.para_quien: una oferta 'ambos' la
    // puede completar un trabajador_turnos, y eso no lo vuelve nómina.
    tiposTrabajador: ['nomina'],
  },
  turnos: {
    tipo: (empresa) => empresa?.tipo_liquidacion || 'mensual',
    tiposTrabajador: ['turnos', 'ambos'],
  },
};

async function autoCrearSegmento(empresaId, segmento, empresa) {
  const tipo = SEGMENTOS[segmento].tipo(empresa);
  const periodo = calcularPeriodoActual(tipo);
  const existente = await TurnosEventualModel.obtenerActivo(empresaId, segmento, periodo.fecha_inicio);
  if (existente) return existente;
  const id = await TurnosEventualModel.crear(empresaId, { segmento, ...periodo });
  return TurnosEventualModel.obtenerPorId(empresaId, id);
}

const TurnosEventualService = {
  /** Auto-crea (si hace falta) el período activo de cada segmento. */
  async autoCrear(empresaId) {
    const empresa = await EmpresasModel.obtenerParaAdmin(empresaId);
    const [nomina, turnos] = await Promise.all([
      autoCrearSegmento(empresaId, 'nomina', empresa),
      autoCrearSegmento(empresaId, 'turnos', empresa),
    ]);
    return { nomina, turnos };
  },

  async liquidacion(empresaId, periodoId, usuario) {
    const periodo = await TurnosEventualModel.obtenerPorId(empresaId, periodoId);
    if (!periodo) throw new AppError('Período no encontrado', 404);
    const { tiposTrabajador } = SEGMENTOS[periodo.segmento];

    // trabajador_nomina solo ve su propia línea — nunca la de sus compañeros
    // (mismo patrón que liquidacion.service.js#generar para nómina regular).
    let trabajadorId;
    if (usuario?.rol === ROLES.TRABAJADOR_NOMINA) {
      const trabajador = await TrabajadoresModel.obtenerPorUsuarioId(empresaId, usuario.sub);
      if (!trabajador) throw new AppError('Tu usuario no está vinculado a un trabajador activo', 403);
      trabajadorId = trabajador.id;
    }

    const filas = await TurnosEventualModel.liquidacion(empresaId, periodoId, tiposTrabajador, trabajadorId);
    // ponytail: SUM() sobre columnas DECIMAL vuelve como string en mysql2 (sin decimalNumbers) — castear antes de responder al cliente.
    const lineas = filas.map((l) => ({ ...l, horas: Number(l.horas) || 0, total: Number(l.total) || 0 }));
    const total_general = lineas.reduce((s, l) => s + l.total, 0);
    return { periodo, lineas, total_general };
  },

  async liquidar(empresaId, periodoId) {
    const periodo = await TurnosEventualModel.obtenerPorId(empresaId, periodoId);
    if (!periodo) throw new AppError('Período no encontrado', 404);
    if (periodo.estado === 'liquidado') throw new AppError('El período ya fue liquidado', 409);
    await TurnosEventualModel.liquidar(empresaId, periodoId);
    return TurnosEventualModel.obtenerPorId(empresaId, periodoId);
  },
};

module.exports = TurnosEventualService;
