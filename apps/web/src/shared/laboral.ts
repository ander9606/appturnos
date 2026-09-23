/**
 * Constantes y cálculo de descuentos de ley colombiana (contrato laboral).
 * Espejo de backend/config/constants.js + backend/utils/laboralUtils.js —
 * mantener sincronizados si cambian las tarifas o el SMMLV.
 */

// Salario mínimo mensual legal vigente. Cambia cada 1-ene por decreto del
// Gobierno — actualizar aquí. Valor 2026 (Decreto 1469 de 2025).
export const SMMLV_COP = 1_750_905;

// Convención laboral colombiana: 30 días × 8 h.
export const HORAS_MES_NOMINA = 240;

// A cargo del trabajador. ARL y caja de compensación no se incluyen: en
// Colombia corren 100% por cuenta del empleador, nunca se descuentan del trabajador.
export const DEDUCCION_SALUD = 0.04;
export const DEDUCCION_PENSION = 0.04;

const FONDO_SOLIDARIDAD_TRAMOS = [
  { desdeSmmlv: 4, tasa: 0.01 },
  { desdeSmmlv: 16, tasa: 0.012 },
  { desdeSmmlv: 17, tasa: 0.014 },
  { desdeSmmlv: 18, tasa: 0.016 },
  { desdeSmmlv: 19, tasa: 0.018 },
  { desdeSmmlv: 20, tasa: 0.02 },
];

export interface Deducciones {
  salud: number;
  pension: number;
  fondoSolidaridadTasa: number;
  total: number;
  neto: number;
}

/**
 * Descuentos de ley sobre el ingreso base de cotización (IBC) de un
 * trabajador con contrato laboral: salud (4%) + pensión (4%, más el aporte
 * al Fondo de Solidaridad Pensional si el IBC ≥ 4 SMMLV).
 */
export function calcularDeducciones(ibc: number): Deducciones {
  const base = Number(ibc) || 0;
  const salud = base * DEDUCCION_SALUD;

  const smmlvDevengados = base / SMMLV_COP;
  const tramo = [...FONDO_SOLIDARIDAD_TRAMOS].reverse().find((t) => smmlvDevengados >= t.desdeSmmlv);
  const fondoSolidaridadTasa = tramo?.tasa ?? 0;
  const pension = base * (DEDUCCION_PENSION + fondoSolidaridadTasa);

  const total = salud + pension;
  return { salud, pension, fondoSolidaridadTasa, total, neto: base - total };
}

// Espejo de RECARGO_FESTIVO_VIGENCIAS (backend/config/constants.js) — Ley 2466
// de 2025: recargo dominical/festivo gradual 80 % → 90 % → 100 %.
const RECARGO_FESTIVO_VIGENCIAS = [
  { desde: '2027-07-01', factor: 2.0 },
  { desde: '2026-07-01', factor: 1.9 },
  { desde: '2025-07-01', factor: 1.8 },
  { desde: '0000-01-01', factor: 1.75 },
];

/** Multiplicador de la hora dominical/festiva trabajada en `fecha` ('YYYY-MM-DD'). */
export function recargoFestivo(fecha: string): number {
  return RECARGO_FESTIVO_VIGENCIAS.find((v) => v.desde <= fecha.slice(0, 10))!.factor;
}
