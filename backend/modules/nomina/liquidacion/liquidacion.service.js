'use strict';

const LiquidacionModel = require('./liquidacion.model');
const PeriodosModel = require('../periodos/periodos.model');
const EmpresasModel = require('../../empresas/empresas.model');
const TrabajadoresModel = require('../../trabajadores/trabajadores.model');
const DescuentosModel = require('../descuentos/descuentos.model');
const RegistrosModel = require('../registros/registros.model');
const PuntosMarcajeModel = require('../../puntos-marcaje/puntos-marcaje.model');
const GeocodingService = require('../../geocoding/geocoding.service');
const AppError = require('../../../utils/AppError');
const { ROLES, HORAS_MES_NOMINA } = require('../../../config/constants');
const { valorHora, desglosarPagoNomina, calcularSalarioBasePeriodo, calcularDeducciones, calcularSubsidioTransporte } = require('../../../utils/laboralUtils');
const { estaEnAlgunPunto } = require('../../../utils/geoUtils');

function redondear(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Nombra una coordenada de marcaje sin llamar a un servicio externo cuando es
 * posible:
 * 1. Si el trabajador es 'fijo' y tiene punto asignado, es ese punto (ya
 *    validado por geofence al marcar) — no hace falta ni comparar distancia.
 * 2. Si no, pero la coordenada cae dentro del radio de CUALQUIER punto de
 *    marcaje de la empresa (zonal, fijo de otro trabajador, etc.), usamos su
 *    nombre — más barato y más útil que una dirección, incluso para 'libre'.
 * 3. Solo si no hay ningún punto conocido cerca cae a Nominatim (con caché y
 *    límite de 1 req/s ya resueltos por GeocodingService).
 */
async function nombrarUbicacion(latRaw, lngRaw, trabajador, puntosPorId, puntos) {
  if (latRaw == null || lngRaw == null) return null;
  const lat = Number(latRaw);
  const lng = Number(lngRaw);

  if (trabajador.tipo_marcacion === 'fijo' && trabajador.punto_marcaje_id) {
    const punto = puntosPorId.get(trabajador.punto_marcaje_id);
    if (punto) return punto.nombre;
  }

  const { ok, punto } = estaEnAlgunPunto(lat, lng, puntos);
  if (ok) return punto.nombre;

  try {
    const data = await GeocodingService.reverse(lat, lng);
    return data?.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

const LiquidacionService = {
  /**
   * Resumen de liquidación de un período: una línea por trabajador con sus
   * horas acumuladas y el total a pagar según los recargos de ley.
   *
   * `usuario` es opcional: si es un trabajador_nomina, el resultado se filtra
   * a su propia línea únicamente — nunca ve la liquidación de sus compañeros.
   */
  async generar(empresaId, periodoId, usuario) {
    const periodo = await PeriodosModel.obtenerPorId(empresaId, periodoId);
    if (!periodo) throw new AppError('Período no encontrado', 404);

    let trabajadorId;
    if (usuario?.rol === ROLES.TRABAJADOR_NOMINA) {
      const trabajador = await TrabajadoresModel.obtenerPorUsuarioId(empresaId, usuario.sub);
      if (!trabajador) throw new AppError('Tu usuario no está vinculado a un trabajador activo', 403);
      trabajadorId = trabajador.id;
    }

    const tipoContrato = await EmpresasModel.obtenerTipoContrato(empresaId);
    const filas = await LiquidacionModel.resumenPorPeriodo(empresaId, periodoId, trabajadorId);

    // Descuentos manuales ya aceptados por el trabajador (préstamos, inasistencias, etc.)
    // — los pendientes/rechazados no afectan el neto, se gestionan aparte.
    const descuentosAceptados = await DescuentosModel.aceptadosPorPeriodo(empresaId, periodoId);
    const descuentosPorTrabajador = new Map();
    for (const d of descuentosAceptados) {
      const lista = descuentosPorTrabajador.get(d.trabajador_id) ?? [];
      lista.push({ id: d.id, tipo: d.tipo, motivo: d.motivo, monto: Number(d.monto) });
      descuentosPorTrabajador.set(d.trabajador_id, lista);
    }

    // Días del período — usado para prorratear el salario mensual (salario_base / 30 días conv.)
    const diasPeriodo = Math.round(
      (new Date(periodo.fecha_fin + 'T12:00:00Z') - new Date(periodo.fecha_inicio + 'T12:00:00Z')) / 86_400_000
    ) + 1;

    let totalGeneral = 0;
    let totalNetoGeneral = 0;
    const lineas = filas.map((f) => {
      const desglose = {
        horas_ordinarias: Number(f.horas_ordinarias) || 0,
        horas_extra_diurnas: Number(f.horas_extra_diurnas) || 0,
        horas_extra_nocturnas: Number(f.horas_extra_nocturnas) || 0,
        horas_nocturnas: Number(f.horas_nocturnas) || 0,
        horas_festivo: Number(f.horas_festivo) || 0,
      };
      const vh = f.valor_hora_snapshot != null
        ? Number(f.valor_hora_snapshot)
        : valorHora(f);
      const desglosePago = desglosarPagoNomina(desglose, vh);

      // Asalariado (salario_base): el sueldo fijo se paga íntegro, prorrateado
      // por días del período — no depende de horas_ordinarias registradas.
      // Por tarifa_hora: sigue siendo horas_ordinarias × valor_hora.
      // Si el período ya cerró, usa el salario congelado (igual que vh arriba)
      // — un cambio de sueldo posterior no debe recalcular períodos pasados.
      const salarioBase = f.salario_base_snapshot != null
        ? Number(f.salario_base_snapshot)
        : f.salario_base;
      const pagoOrdinario = redondear(calcularSalarioBasePeriodo({
        tarifaHora: f.tarifa_hora,
        salarioBase,
        horasOrdinarias: desglose.horas_ordinarias,
        valorHoraTrabajador: vh,
        diasPeriodo,
      }));
      const pagoNocturno      = redondear(desglosePago.pago_nocturno);
      const pagoExtraDiurno   = redondear(desglosePago.pago_extra_diurno);
      const pagoExtraNocturno = redondear(desglosePago.pago_extra_nocturno);
      const pagoFestivo       = redondear(desglosePago.pago_festivo);
      const total = redondear(pagoOrdinario + pagoNocturno + pagoExtraDiurno + pagoExtraNocturno + pagoFestivo);

      // Descuentos de ley: solo si la empresa contrata por nómina laboral.
      // Prestación de servicios se autoliquida — no calculamos ese descuento aquí.
      const deducciones = tipoContrato === 'laboral'
        ? calcularDeducciones(total)
        : { salud: 0, pension: 0, total: 0, neto: total };

      const otrosDescuentos = descuentosPorTrabajador.get(f.trabajador_id) ?? [];
      const otrosDescuentosTotal = redondear(otrosDescuentos.reduce((s, d) => s + d.monto, 0));
      const sueldo = redondear(deducciones.neto - otrosDescuentosTotal);

      // Auxilio de transporte: solo contrato laboral, no es IBC (no lleva descuentos).
      const subsidioTransporte = tipoContrato === 'laboral'
        ? redondear(calcularSubsidioTransporte(vh * HORAS_MES_NOMINA, diasPeriodo))
        : 0;
      const neto = redondear(sueldo + subsidioTransporte);

      totalGeneral += total;
      totalNetoGeneral += neto;

      return {
        trabajador_id: f.trabajador_id,
        nombre: f.nombre,
        apellido: f.apellido,
        cedula: f.cedula,
        banco: f.banco,
        tipo_cuenta: f.tipo_cuenta,
        numero_cuenta: f.numero_cuenta,
        dias_registrados: f.dias_registrados,
        ...desglose,
        valor_hora: redondear(vh),
        pago_ordinario: pagoOrdinario,
        pago_nocturno: pagoNocturno,
        pago_extra_diurno: pagoExtraDiurno,
        pago_extra_nocturno: pagoExtraNocturno,
        pago_festivo: pagoFestivo,
        total,
        descuento_salud: redondear(deducciones.salud),
        descuento_pension: redondear(deducciones.pension),
        otros_descuentos: otrosDescuentos,
        otros_descuentos_total: otrosDescuentosTotal,
        sueldo,
        subsidio_transporte: subsidioTransporte,
        neto,
      };
    });

    return {
      periodo,
      tipo_contrato: tipoContrato,
      lineas,
      totales: {
        trabajadores: lineas.length,
        total_general: redondear(totalGeneral),
        total_neto_general: redondear(totalNetoGeneral),
      },
    };
  },

  /**
   * Registros diarios del período con su ubicación de entrada/salida ya
   * resuelta a un nombre legible (para el Excel exportable). Ordenados por
   * trabajador y fecha, a diferencia de RegistrosModel.listar (fecha DESC).
   */
  async marcajesConUbicacion(empresaId, periodoId) {
    const [{ data: registros }, puntos] = await Promise.all([
      RegistrosModel.listar(empresaId, { periodoId, limit: 5000, offset: 0 }),
      PuntosMarcajeModel.listar(empresaId),
    ]);
    const puntosPorId = new Map(puntos.map((p) => [p.id, p]));

    const conUbicacion = await Promise.all(registros.map(async (r) => ({
      ...r,
      ubicacion_entrada: await nombrarUbicacion(r.latitud_entrada, r.longitud_entrada, r, puntosPorId, puntos),
      ubicacion_salida: await nombrarUbicacion(r.latitud_salida, r.longitud_salida, r, puntosPorId, puntos),
    })));

    return conUbicacion.sort((a, b) =>
      `${a.trabajador_apellido}${a.trabajador_nombre}${a.fecha}`
        .localeCompare(`${b.trabajador_apellido}${b.trabajador_nombre}${b.fecha}`)
    );
  },
};

module.exports = LiquidacionService;
