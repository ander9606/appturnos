'use strict';

const ReportesModel = require('./reportes.model');
const TrabajadoresModel = require('../trabajadores/trabajadores.model');
const AppError = require('../../utils/AppError');
const { valorHora, desglosarPagoNomina, calcularSalarioBasePeriodo } = require('../../utils/laboralUtils');

function redondear(n) {
  return Math.round(n * 100) / 100;
}

/** Convierte a número los campos indicados de una fila. */
function aNumeros(fila, campos) {
  const copia = { ...fila };
  for (const campo of campos) copia[campo] = Number(copia[campo]) || 0;
  return copia;
}

const ReportesService = {
  /** Asistencia por período: turnos (por estado) y días de nómina. */
  async asistencia(empresaId, { desde, hasta }) {
    const turnos = (await ReportesModel.asistenciaTurnos(empresaId, desde, hasta)).map((f) =>
      aNumeros(f, ['total_turnos', 'completados', 'no_presentados', 'en_progreso', 'confirmados'])
    );
    const nomina = (await ReportesModel.asistenciaNomina(empresaId, desde, hasta)).map((f) =>
      aNumeros(f, ['dias_registrados'])
    );
    return { rango: { desde, hasta }, turnos, nomina };
  },

  /** Costo de mano de obra por período: turnos + nómina. */
  async costos(empresaId, { desde, hasta }) {
    const turnos = await ReportesModel.costoTurnos(empresaId, desde, hasta);
    const filasNomina = await ReportesModel.horasNominaPorTrabajador(empresaId, desde, hasta);

    // Mismo criterio que liquidacion.service.js: un asalariado cuesta su
    // sueldo prorrateado al rango completo, no lo que sumen sus horas_ordinarias
    // — si no, este reporte subestima el costo real de un asalariado con pocas
    // horas registradas en el rango.
    const diasRango = Math.round(
      (new Date(hasta + 'T12:00:00Z') - new Date(desde + 'T12:00:00Z')) / 86_400_000
    ) + 1;

    let costoNomina = 0;
    const detalleNomina = filasNomina.map((f) => {
      const vh = valorHora(f);
      const desglosePago = desglosarPagoNomina(f, vh);
      const pagoOrdinario = calcularSalarioBasePeriodo({
        tarifaHora: f.tarifa_hora,
        salarioBase: f.salario_base,
        horasOrdinarias: f.horas_ordinarias,
        valorHoraTrabajador: vh,
        diasPeriodo: diasRango,
      });
      const total = redondear(
        pagoOrdinario + desglosePago.pago_nocturno + desglosePago.pago_extra_diurno +
        desglosePago.pago_extra_nocturno + desglosePago.pago_festivo
      );
      costoNomina += total;
      return { trabajador_id: f.trabajador_id, nombre: f.nombre, apellido: f.apellido, total };
    });

    const costoTurnos = Number(turnos.costo) || 0;
    return {
      rango: { desde, hasta },
      turnos: {
        turnos_completados: Number(turnos.turnos_completados) || 0,
        costo: redondear(costoTurnos),
      },
      nomina: {
        trabajadores: detalleNomina.length,
        costo: redondear(costoNomina),
        detalle: detalleNomina,
      },
      costo_total: redondear(costoTurnos + costoNomina),
    };
  },

  /** Historial individual de un trabajador: turnos + registros de nómina. */
  async historialTrabajador(empresaId, trabajadorId, { desde, hasta }) {
    const trabajador = await TrabajadoresModel.obtenerPorId(empresaId, trabajadorId);
    if (!trabajador) throw new AppError('Trabajador no encontrado', 404);

    const turnos = await ReportesModel.turnosDeTrabajador(empresaId, trabajadorId, desde, hasta);
    const registros = await ReportesModel.registrosDeTrabajador(
      empresaId,
      trabajadorId,
      desde,
      hasta
    );
    const pagoTurnos = turnos.reduce((suma, t) => suma + (Number(t.pago_total) || 0), 0);

    return {
      trabajador: {
        id: trabajador.id,
        nombre: trabajador.nombre,
        apellido: trabajador.apellido,
        cedula: trabajador.cedula,
        tipo: trabajador.tipo,
        cargo: trabajador.cargo,
      },
      rango: { desde, hasta },
      turnos,
      registros_nomina: registros,
      resumen: {
        total_turnos: turnos.length,
        pago_turnos: redondear(pagoTurnos),
        dias_nomina: registros.length,
      },
    };
  },
};

module.exports = ReportesService;
