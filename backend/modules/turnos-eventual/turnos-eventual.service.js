'use strict';

const TurnosEventualModel = require('./turnos-eventual.model');
const AppError = require('../../utils/AppError');

/** Returns { anio, trimestre, fecha_inicio, fecha_fin } for the quarter containing today. */
function trimestresActual() {
  const now = new Date();
  const anio = now.getFullYear();
  const mes = now.getMonth() + 1; // 1-12
  const trimestre = Math.ceil(mes / 3); // 1..4
  const inicios = [null, `${anio}-01-01`, `${anio}-04-01`, `${anio}-07-01`, `${anio}-10-01`];
  const fines   = [null, `${anio}-03-31`, `${anio}-06-30`, `${anio}-09-30`, `${anio}-12-31`];
  return { anio, trimestre, fecha_inicio: inicios[trimestre], fecha_fin: fines[trimestre] };
}

const TurnosEventualService = {
  async autoCrear(empresaId) {
    const { anio, trimestre, fecha_inicio, fecha_fin } = trimestresActual();
    const existente = await TurnosEventualModel.obtenerActivo(empresaId, anio, trimestre);
    if (existente) return existente;
    const id = await TurnosEventualModel.crear(empresaId, { anio, trimestre, fecha_inicio, fecha_fin });
    return TurnosEventualModel.obtenerPorId(empresaId, id);
  },

  async liquidacion(empresaId, periodoId) {
    const periodo = await TurnosEventualModel.obtenerPorId(empresaId, periodoId);
    if (!periodo) throw new AppError('Período trimestral no encontrado', 404);
    const lineas = await TurnosEventualModel.liquidacion(empresaId, periodoId);
    const total_general = lineas.reduce((s, l) => s + Number(l.total || 0), 0);
    return { periodo, lineas, total_general };
  },

  async liquidar(empresaId, periodoId) {
    const periodo = await TurnosEventualModel.obtenerPorId(empresaId, periodoId);
    if (!periodo) throw new AppError('Período trimestral no encontrado', 404);
    if (periodo.estado === 'liquidado') throw new AppError('El período ya fue liquidado', 409);
    await TurnosEventualModel.liquidar(empresaId, periodoId);
    return TurnosEventualModel.obtenerPorId(empresaId, periodoId);
  },
};

module.exports = TurnosEventualService;
