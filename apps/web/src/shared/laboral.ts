/**
 * Constantes y cálculo de descuentos de ley colombiana (contrato laboral).
 * Espejo de backend/config/constants.js + backend/utils/laboralUtils.js —
 * mantener sincronizados si cambian las tarifas o el SMMLV.
 */

// Salario mínimo mensual legal vigente. Cambia cada 1-ene por decreto del
// Gobierno — actualizar aquí. Valor 2026 (Decreto 1469 de 2025).
export const SMMLV_COP = 1_750_905;

// Jornada de 42 h/semana (Ley 2101): 42 ÷ 6 días × 30 = 210. Espejo de backend/config/constants.js.
export const JORNADA_SEMANAL_HORAS = 42;
export const HORAS_MES_NOMINA = 210;

// Multiplicadores de ley que no cambian por fecha (espejo de RECARGOS en backend/config/constants.js).
// El del festivo sí cambia por fecha: usar recargoFestivo(fecha), nunca un número fijo.
export const RECARGO_NOCTURNO = 0.35;       // solo el recargo (asalariado: el sueldo ya paga la hora base)
export const RECARGO_EXTRA_DIURNA = 1.25;
export const RECARGO_EXTRA_NOCTURNA = 1.75;

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

// ── Festivos de Colombia ─────────────────────────────────────────────────────
// Espejo de festivosDeAnio() (backend/utils/laboralUtils.js), con el nombre de cada
// festivo. La prueba apps/mobile/lib/__tests__/festivos.test.ts exige que ambas
// listas coincidan: si cambias una, cambia la otra.

const DIA_MS = 86_400_000;
const utc = (anio: number, mes: number, dia: number) => new Date(Date.UTC(anio, mes - 1, dia));
const sumarDias = (f: Date, dias: number) => new Date(f.getTime() + dias * DIA_MS);
const aISO = (f: Date) => f.toISOString().slice(0, 10);
/** Ley Emiliani: pasa al lunes siguiente (si ya es lunes, no cambia). */
const alLunes = (f: Date) => {
  const d = f.getUTCDay();
  return d === 1 ? f : sumarDias(f, d === 0 ? 1 : 8 - d);
};

/** Domingo de Pascua (Meeus/Butcher). */
function pascua(anio: number): Date {
  const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(anio, mes, dia);
}

const cacheFestivos = new Map<number, Record<string, string>>();

/** Festivos de un año: 'YYYY-MM-DD' → nombre. Sirve para cualquier año. */
export function festivosColombia(anio: number): Record<string, string> {
  const cache = cacheFestivos.get(anio);
  if (cache) return cache;
  const lista: [Date, string][] = [
    [utc(anio, 1, 1), 'Año Nuevo'],
    [utc(anio, 5, 1), 'Día del Trabajo'],
    [utc(anio, 7, 20), 'Día de la Independencia'],
    [utc(anio, 8, 7), 'Batalla de Boyacá'],
    [utc(anio, 12, 8), 'Inmaculada Concepción'],
    [utc(anio, 12, 25), 'Navidad'],
    [alLunes(utc(anio, 1, 6)), 'Reyes Magos'],
    [alLunes(utc(anio, 3, 19)), 'San José'],
    [alLunes(utc(anio, 6, 29)), 'San Pedro y San Pablo'],
    [alLunes(utc(anio, 8, 15)), 'Asunción de la Virgen'],
    [alLunes(utc(anio, 10, 12)), 'Día de la Raza'],
    [alLunes(utc(anio, 11, 1)), 'Todos los Santos'],
    [alLunes(utc(anio, 11, 11)), 'Independencia de Cartagena'],
    [sumarDias(pascua(anio), -3), 'Jueves Santo'],
    [sumarDias(pascua(anio), -2), 'Viernes Santo'],
    [alLunes(sumarDias(pascua(anio), 39)), 'Ascensión del Señor'],
    [alLunes(sumarDias(pascua(anio), 60)), 'Corpus Christi'],
    [alLunes(sumarDias(pascua(anio), 68)), 'Sagrado Corazón'],
  ];
  const mapa: Record<string, string> = {};
  // Dos festivos pueden caer el mismo día tras el traslado al lunes: se conserva el primero.
  for (const [fecha, nombre] of lista) mapa[aISO(fecha)] ??= nombre;
  cacheFestivos.set(anio, mapa);
  return mapa;
}

/** Nombre del festivo de una fecha ('YYYY-MM-DD'), o undefined si no es festivo (los domingos no cuentan aquí). */
export function nombreFestivo(fecha: string): string | undefined {
  return festivosColombia(Number(fecha.slice(0, 4)))[fecha.slice(0, 10)];
}
