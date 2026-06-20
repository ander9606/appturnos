/**
 * Utilidades de negocio exclusivas del trabajador_nomina.
 *
 * Reglas de negocio:
 * - El salario base cubre las horas ordinarias (8 h/día × 30 d = 240 h/mes).
 * - "Extra en pesos" = ADICIONAL al salario: recargos nocturnos + extras + festivos.
 * - Un día se considera "corto" si las horas registradas están >30 min por debajo
 *   de la jornada ordinaria (puede implicar descuento salarial).
 * - Los días con tipo_dia != 'ordinario' se excluyen del conteo de días cortos.
 */

import type { RegistroDiario, PeriodoNomina, TipoDia } from '@api-client';

// ── Constantes (espejo de backend/config/constants.js) ─────────────────────

const HORAS_MES_NOMINA  = 240;   // 30 d × 8 h
const JORNADA_HORAS     = 8;
const JORNADA_MIN       = JORNADA_HORAS * 60;
const MARGEN_DIA_CORTO  = 30;    // minutos de gracia

// Recargo ADICIONAL sobre el salario base (lo que se suma, no el multiplicador total)
const RECARGO_EXTRA = {
  NOCTURNA:        0.35,   // +35 % sobre h. ordinaria nocturna
  EXTRA_DIURNA:    1.25,   // pago completo (adicional al salario)
  EXTRA_NOCTURNA:  1.75,   // pago completo (adicional al salario)
  FESTIVO:         0.75,   // +75 % sobre h. festiva (sueldo ya cubre la base)
} as const;

// ── Tipos públicos ─────────────────────────────────────────────────────────

export type EstadoHoy =
  | 'sin_periodo'       // no hay período abierto
  | 'sin_registro'      // hay período pero aún no marcó entrada
  | 'en_jornada'        // marcó entrada, sin salida
  | 'jornada_completa'; // marcó entrada y salida

export type TipoAlertaDia = 'dia_corto' | 'sin_salida';

export interface AnalisisDia {
  totalHoras:     number;
  esOrdinario:    boolean;  // 8 h sin extras/festivos
  esDiaCorto:     boolean;  // < jornada - margen
  esFestivo:      boolean;
  tieneExtras:    boolean;
  valorExtraCOP:  number;   // pesos adicionales al salario base
  alertas:        TipoAlertaDia[];
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
  diasCortos:          number;  // días con posible descuento
  horasFaltantes:      number;  // horas por debajo de la jornada en días cortos
  diasEspeciales:      number;  // tipo_dia != 'ordinario'
  valorExtraCOP:       number;  // total adicional acumulado en el período
}

// ── Helpers internos ───────────────────────────────────────────────────────

function totalMinutosRegistro(r: RegistroDiario): number | null {
  if (!r.hora_entrada || !r.hora_salida) return null;
  const [hE, mE] = r.hora_entrada.split(':').map(Number);
  const [hS, mS] = r.hora_salida.split(':').map(Number);
  let diffMin = (hS * 60 + mS) - (hE * 60 + mE);
  if (diffMin < 0) diffMin += 24 * 60; // cruza medianoche
  return diffMin;
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

/** Análisis completo de un registro para la UI del día. */
export function analizarDia(r: RegistroDiario, valorHora: number): AnalisisDia {
  const exd  = Number(r.horas_extra_diurnas);
  const exn  = Number(r.horas_extra_nocturnas);
  const noc  = Number(r.horas_nocturnas);
  const fest = Number(r.horas_festivo);
  const ord  = Number(r.horas_ordinarias);
  const totalHoras = ord + exd + exn + noc + fest;

  const tieneExtras  = exd > 0 || exn > 0 || noc > 0 || fest > 0;
  const esFestivo    = r.es_festivo === 1;
  const valorExtraCOP = calcularValorExtraDia(r, valorHora);

  const alertas: TipoAlertaDia[] = [];
  const esEspecial = r.tipo_dia !== 'ordinario';

  const minutos = totalMinutosRegistro(r);
  const esDiaCorto =
    !esEspecial &&
    r.hora_entrada !== null &&
    r.hora_salida !== null &&
    minutos !== null &&
    minutos < JORNADA_MIN - MARGEN_DIA_CORTO;

  if (esDiaCorto) alertas.push('dia_corto');
  if (r.hora_entrada && !r.hora_salida) alertas.push('sin_salida');

  return {
    totalHoras,
    esOrdinario: !tieneExtras && !esFestivo && !esDiaCorto && !esEspecial,
    esDiaCorto,
    esFestivo,
    tieneExtras,
    valorExtraCOP,
    alertas,
  };
}

/** Resumen acumulado del período para los cards de estadísticas. */
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
  let diasCortos          = 0;
  let horasFaltantes      = 0;
  let diasEspeciales      = 0;
  let valorExtraCOP       = 0;

  for (const r of registros) {
    const exd  = Number(r.horas_extra_diurnas);
    const exn  = Number(r.horas_extra_nocturnas);
    const noc  = Number(r.horas_nocturnas);
    const fest = Number(r.horas_festivo);

    horasOrdinarias     += Number(r.horas_ordinarias);
    horasExtraDiurnas   += exd;
    horasExtraNocturnas += exn;
    horasNocturnas      += noc;
    horasFestivo        += fest;

    if (exd > 0 || exn > 0 || noc > 0 || fest > 0) diasConExtras++;
    if (r.tipo_dia !== 'ordinario') diasEspeciales++;

    const analisis = analizarDia(r, valorHora);
    if (analisis.esDiaCorto) {
      diasCortos++;
      // Horas por debajo de la jornada ordinaria (sin contar el margen de gracia)
      const minutos = totalMinutosRegistro(r) ?? 0;
      horasFaltantes += Math.max(0, (JORNADA_MIN - minutos) / 60);
    }
    valorExtraCOP += analisis.valorExtraCOP;
  }

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
    diasCortos,
    horasFaltantes:      round(horasFaltantes),
    diasEspeciales,
    valorExtraCOP,
  };
}

/** Estado del día actual según el registro de hoy. */
export function getEstadoHoy(
  registroHoy: RegistroDiario | null,
  hayPeriodoAbierto: boolean,
): EstadoHoy {
  if (!hayPeriodoAbierto)        return 'sin_periodo';
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

// ── Formatters locales (reutilizables en los componentes del módulo) ────────

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
