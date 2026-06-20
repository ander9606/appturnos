/**
 * Utilidades de negocio exclusivas del trabajador_nomina.
 *
 * Reglas de negocio (modelo salario fijo + extras semanales):
 * - El salario base SIEMPRE se paga íntegro — no hay descuentos por jornadas cortas.
 * - Horas nocturnas (21:00–06:00): recargo +35 % sobre cada hora, independiente de extras.
 * - Horas extra se determinan semanalmente (Lun–Dom) contra el límite legal del año
 *   según Ley 2101: 2023→46h, 2024→44h, 2025→42h, 2026+→40h.
 * - Domingo o festivo trabajado genera automáticamente 1 día de descanso compensatorio
 *   (Art. 179 CST) — sin recargo económico adicional.
 */

import type { RegistroDiario, PeriodoNomina, TipoDia } from '@api-client';

// ── Constantes ─────────────────────────────────────────────────────────────

const HORAS_MES_NOMINA = 240; // 30 d × 8 h

// Recargo ADICIONAL sobre el salario base (solo lo que se suma)
const RECARGO_EXTRA = {
  NOCTURNA:        0.35,  // +35 % por hora nocturna
  EXTRA_DIURNA:    1.25,  // pago completo (adicional al salario)
  EXTRA_NOCTURNA:  1.75,  // pago completo (adicional al salario)
  FESTIVO:         0.75,  // +75 % por hora en festivo (salario ya cubre la base)
} as const;

// Límites semanales según Ley 2101 de 2021 (reducción progresiva)
// ponytail: tabla fija hasta 2026+, no se espera nueva ley pronto — upgrade path: fetch from backend config
const LIMITE_SEMANAL: Record<number, number> = {
  2023: 46,
  2024: 44,
  2025: 42,
};
const LIMITE_SEMANAL_MINIMO = 40; // 2026 en adelante

/** Límite legal de horas ordinarias semanales según el año (Ley 2101). */
export function getJornadaLegalSemanal(year: number): number {
  return LIMITE_SEMANAL[year] ?? (year >= 2026 ? LIMITE_SEMANAL_MINIMO : 46);
}

// ── Tipos públicos ─────────────────────────────────────────────────────────

export type EstadoHoy =
  | 'sin_periodo'
  | 'sin_registro'
  | 'en_jornada'
  | 'jornada_completa';

export type TipoAlertaDia = 'sin_salida';

export interface AnalisisDia {
  totalHoras:    number;
  esFestivo:     boolean;
  tieneExtras:   boolean;
  valorExtraCOP: number;
  alertas:       TipoAlertaDia[];
}

export interface ResumenPeriodoNomina {
  totalHoras:          number;
  horasOrdinarias:     number;
  horasExtraDiurnas:   number;
  horasExtraNocturnas: number;
  horasNocturnas:      number;
  horasFestivo:        number;
  diasRegistrados:     number;
  diasConExtras:       number;
  diasEspeciales:      number;
  valorExtraCOP:       number;
  // Semanas en el período con desglose semanal
  semanas:             ResumenSemana[];
}

export interface ResumenSemana {
  /** ISO de lunes de la semana */
  inicioSemana: string;
  horasTotales: number;
  limiteHoras:  number;
  horasExtra:   number;
}

// ── Helpers internos ───────────────────────────────────────────────────────

function totalMinutosRegistro(r: RegistroDiario): number | null {
  if (!r.hora_entrada || !r.hora_salida) return null;
  const [hE, mE] = r.hora_entrada.split(':').map(Number);
  const [hS, mS] = r.hora_salida.split(':').map(Number);
  let diffMin = (hS * 60 + mS) - (hE * 60 + mE);
  if (diffMin < 0) diffMin += 24 * 60;
  return diffMin;
}

/** ISO string de la fecha del lunes de la semana a la que pertenece `fecha`. */
function lunesDeSemana(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00`);
  const dia = d.getDay(); // 0=Dom
  const diff = dia === 0 ? -6 : 1 - dia;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

// ── Funciones públicas ─────────────────────────────────────────────────────

/** Valor de la hora ordinaria a partir del salario base. */
export function getValorHora(salarioBase: number | null): number {
  if (!salarioBase) return 0;
  return salarioBase / HORAS_MES_NOMINA;
}

/** Pesos ADICIONALES al salario base generados por un registro. */
export function calcularValorExtraDia(r: RegistroDiario, valorHora: number): number {
  if (valorHora <= 0) return 0;
  return Math.round(
    valorHora * (
      RECARGO_EXTRA.NOCTURNA       * Number(r.horas_nocturnas)      +
      RECARGO_EXTRA.EXTRA_DIURNA   * Number(r.horas_extra_diurnas)  +
      RECARGO_EXTRA.EXTRA_NOCTURNA * Number(r.horas_extra_nocturnas) +
      RECARGO_EXTRA.FESTIVO        * Number(r.horas_festivo)
    )
  );
}

/** Análisis de un registro para la UI del día. Sin concepto de día corto. */
export function analizarDia(r: RegistroDiario, valorHora: number): AnalisisDia {
  const exd  = Number(r.horas_extra_diurnas);
  const exn  = Number(r.horas_extra_nocturnas);
  const noc  = Number(r.horas_nocturnas);
  const fest = Number(r.horas_festivo);
  const ord  = Number(r.horas_ordinarias);
  const totalHoras = ord + exd + exn + noc + fest;

  const tieneExtras   = exd > 0 || exn > 0 || noc > 0 || fest > 0;
  const esFestivo     = r.es_festivo === 1;
  const valorExtraCOP = calcularValorExtraDia(r, valorHora);

  const alertas: TipoAlertaDia[] = [];
  if (r.hora_entrada && !r.hora_salida) alertas.push('sin_salida');

  return { totalHoras, esFestivo, tieneExtras, valorExtraCOP, alertas };
}

/** Resumen acumulado del período. Extras calculados semanalmente vs límite legal. */
export function calcularResumenPeriodo(
  registros: RegistroDiario[],
  valorHora: number,
): ResumenPeriodoNomina {
  let horasOrdinarias     = 0;
  let horasExtraDiurnas   = 0;
  let horasExtraNocturnas = 0;
  let horasNocturnas      = 0;
  let horasFestivo        = 0;
  let diasConExtras       = 0;
  let diasEspeciales      = 0;
  let valorExtraCOP       = 0;

  // Acumulado de horas totales por semana (lunes ISO → horas)
  const horasPorSemana = new Map<string, number>();

  for (const r of registros) {
    const exd  = Number(r.horas_extra_diurnas);
    const exn  = Number(r.horas_extra_nocturnas);
    const noc  = Number(r.horas_nocturnas);
    const fest = Number(r.horas_festivo);
    const ord  = Number(r.horas_ordinarias);

    horasOrdinarias     += ord;
    horasExtraDiurnas   += exd;
    horasExtraNocturnas += exn;
    horasNocturnas      += noc;
    horasFestivo        += fest;

    if (exd > 0 || exn > 0 || noc > 0 || fest > 0) diasConExtras++;
    if (r.tipo_dia !== 'ordinario') diasEspeciales++;

    const analisis = analizarDia(r, valorHora);
    valorExtraCOP += analisis.valorExtraCOP;

    // Acumular horas totales por semana para desglose semanal
    const lunes = lunesDeSemana(r.fecha);
    horasPorSemana.set(lunes, (horasPorSemana.get(lunes) ?? 0) + analisis.totalHoras);
  }

  // Construir resumen por semana
  const semanas: ResumenSemana[] = Array.from(horasPorSemana.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([inicioSemana, horasTotales]) => {
      const year = Number(inicioSemana.slice(0, 4));
      const limiteHoras = getJornadaLegalSemanal(year);
      const horasExtra = Math.max(0, horasTotales - limiteHoras);
      return { inicioSemana, horasTotales, limiteHoras, horasExtra };
    });

  const round = (n: number) => Math.round(n * 100) / 100;

  return {
    totalHoras:          round(horasOrdinarias + horasExtraDiurnas + horasExtraNocturnas + horasNocturnas + horasFestivo),
    horasOrdinarias:     round(horasOrdinarias),
    horasExtraDiurnas:   round(horasExtraDiurnas),
    horasExtraNocturnas: round(horasExtraNocturnas),
    horasNocturnas:      round(horasNocturnas),
    horasFestivo:        round(horasFestivo),
    diasRegistrados:     registros.length,
    diasConExtras,
    diasEspeciales,
    valorExtraCOP,
    semanas,
  };
}

/** Estado del día actual según el registro de hoy. */
export function getEstadoHoy(
  registroHoy: RegistroDiario | null,
  hayPeriodoAbierto: boolean,
): EstadoHoy {
  if (!hayPeriodoAbierto)         return 'sin_periodo';
  if (!registroHoy?.hora_entrada) return 'sin_registro';
  if (!registroHoy.hora_salida)   return 'en_jornada';
  return 'jornada_completa';
}

/** Tiempo transcurrido desde hora_entrada hasta ahora como "2h 35m". */
export function calcularElapsedLabel(horaEntrada: string): string {
  const [hh, mm] = horaEntrada.split(':').map(Number);
  const now = new Date();
  const entradaMs = (hh * 60 + mm) * 60_000;
  const ahoraMs   = (now.getHours() * 60 + now.getMinutes()) * 60_000;
  let diffMs = ahoraMs - entradaMs;
  if (diffMs < 0) diffMs += 24 * 3_600_000;
  const totalMin = Math.floor(diffMs / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ── Formatters ──────────────────────────────────────────────────────────────

const SHORT_MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const SHORT_DAYS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

export function fmtHora(t: string | null | undefined): string {
  if (!t) return '—';
  return t.slice(0, 5);
}

export function fmtPeriodo(p: PeriodoNomina): string {
  const [, ms, ds] = p.fecha_inicio.split('-');
  const [, me, de] = p.fecha_fin.split('-');
  const mi = Number(ms) - 1;
  const mf = Number(me) - 1;
  return mi === mf
    ? `${Number(ds)}–${Number(de)} ${SHORT_MONTHS[mi]}`
    : `${Number(ds)} ${SHORT_MONTHS[mi]} – ${Number(de)} ${SHORT_MONTHS[mf]}`;
}

export function fmtFechaCorta(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${SHORT_DAYS[d.getDay()]} ${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
}

export const TIPO_DIA_LABEL: Partial<Record<TipoDia, string>> = {
  descanso:      'Descanso',
  compensatorio: 'Compensatorio',
  incapacidad:   'Incapacidad',
  vacacion:      'Vacación',
  licencia:      'Licencia',
};
