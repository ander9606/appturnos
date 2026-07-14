'use strict';

const TurnosEventualModel = require('./turnos-eventual.model');
const EmpresasModel = require('../empresas/empresas.model');
const AppError = require('../../utils/AppError');
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
    paraQuien: ['nomina', 'ambos'],
  },
  turnos: {
    tipo: (empresa) => empresa?.tipo_liquidacion || 'mensual',
    paraQuien: ['turnos', 'ambos'],
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

  async liquidacion(empresaId, periodoId) {
    const periodo = await TurnosEventualModel.obtenerPorId(empresaId, periodoId);
    if (!periodo) throw new AppError('Período no encontrado', 404);
    const { paraQuien } = SEGMENTOS[periodo.segmento];
    const lineas = await TurnosEventualModel.liquidacion(empresaId, periodoId, paraQuien);
    const total_general = lineas.reduce((s, l) => s + Number(l.total || 0), 0);
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
