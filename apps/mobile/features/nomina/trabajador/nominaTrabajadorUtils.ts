/**
 * Utilidades de negocio exclusivas del trabajador_nomina.
 *
 * Reglas de negocio (modelo salario fijo + extras semanales):
 * - El salario base SIEMPRE se paga íntegro — no hay descuentos por jornadas cortas.
 * - Horas nocturnas, extra y festivo se pagan encima del salario base con el
 *   multiplicador COMPLETO de ley (×1.35 / ×1.25 / ×1.75 / ×1.75) — el mismo
 *   que usa la liquidación real (desglosarPagoNomina en el backend), para que
 *   el estimado que ve el trabajador coincida con lo que efectivamente se le paga.
 * - Horas extra se determinan semanalmente (Lun–Dom) contra el límite legal del año
 *   según Ley 2101 (reducción progresiva, corte 15 de julio de cada año):
 *   48h hasta jul-2023, 47h 2023-2024, 46h 2024-2025, 44h 2025-2026, 42h desde jul-2026.
 *   La ley se detiene en 42h — no baja más. Mismo valor que JORNADA_SEMANAL_HORAS
 *   en el backend (constants.js), que ya usa 42 sin escalonar por año.
 * - Domingo o festivo trabajado genera automáticamente 1 día de descanso compensatorio
 *   (Art. 179 CST) — la hora festiva trabajada igual lleva su recargo (×1.75); lo que
 *   el compensatorio no lleva es un pago adicional POR EL DÍA DE DESCANSO en sí.
 */

import type { RegistroDiario, PeriodoNomina, TipoDia, TipoPeriodo } from '@api-client';
import { toISODate, BOGOTA_OFFSET_MS } from '@/lib/formatters';

// ── Constantes ─────────────────────────────────────────────────────────────

const HORAS_MES_NOMINA = 240; // 30 d × 8 h

// Umbral de jornada continua (Art. 167 CST): por debajo de esto no aplica
// descanso obligatorio, así que no tiene sentido preguntar por almuerzo.
// Espejo de JORNADA_CONTINUA_UMBRAL_HORAS en backend/config/constants.js.
export const JORNADA_CONTINUA_UMBRAL_HORAS = 6;

// Tope semanal FIJO que usa calcularHoras() en el backend para clasificar
// ordinaria vs extra (JORNADA_SEMANAL_HORAS en backend/config/constants.js) —
// a diferencia de getJornadaLegalSemanal() más abajo (que sí escalona por año
// y solo se usa para el resumen informativo del límite legal por semana), este
// es el número que realmente decidió el desglose ordinarias/extra de cada día.
const JORNADA_SEMANAL_HORAS = 42;

// Espejo de RECARGOS en backend/config/constants.js — mismo multiplicador
// completo que usa la liquidación real (desglosarPagoNomina), sumado encima
// del salario base (que se paga siempre íntegro, ver calcularSalarioBasePeriodo).
// Antes este estimado usaba "solo el adicional" (+35 %/+75 %) para nocturna y
// festivo, asumiendo que el salario ya cubría su base — eso hacía que el
// trabajador viera un número distinto al de la Liquidación oficial.
const RECARGO_EXTRA = {
  NOCTURNA:        1.35,
  EXTRA_DIURNA:    1.25,
  EXTRA_NOCTURNA:  1.75,
  FESTIVO:         1.75,
} as const;

// Límites semanales según Ley 2101 de 2021 (reducción progresiva, corte cada
// 15 de julio). Se aproxima por año calendario (no por fecha exacta de corte)
// — igual que el backend, que ya no escalona y usa 42h fijo (constants.js).
// ponytail: tope final de la ley es 42h, no baja más — no hace falta seguir
// agregando años — upgrade path: fetch from backend config si la ley cambia otra vez.
const LIMITE_SEMANAL: Record<number, number> = {
  2023: 47,
  2024: 46,
  2025: 44,
};
const LIMITE_SEMANAL_FINAL = 42; // 2026 en adelante — tope final de la ley, no baja más.

/** Límite legal de horas ordinarias semanales según el año (Ley 2101). */
export function getJornadaLegalSemanal(year: number): number {
  return LIMITE_SEMANAL[year] ?? (year >= 2026 ? LIMITE_SEMANAL_FINAL : 48);
}

// ── Tipos públicos ─────────────────────────────────────────────────────────

export type EstadoHoy =
  | 'sin_periodo'
  | 'sin_registro'
  | 'en_jornada'
  | 'jornada_completa'
  | 'reingreso_pendiente'   // solicitud enviada, esperando aprobación del gestor
  | 'reingreso_aprobado';   // aprobado, puede marcar nueva entrada

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

interface SesionSimple {
  hora_entrada: string | null;
  hora_salida: string | null;
}

/** Minutos entre entrada y salida de UNA sesión (cruza medianoche si sale < entra). */
function spanMinutosSesion(s: SesionSimple): number | null {
  if (!s.hora_entrada || !s.hora_salida) return null;
  const [hE, mE] = s.hora_entrada.split(':').map(Number);
  const [hS, mS] = s.hora_salida.split(':').map(Number);
  let diffMin = (hS * 60 + mS) - (hE * 60 + mE);
  if (diffMin < 0) diffMin += 24 * 60;
  return diffMin;
}

/**
 * Todas las sesiones del día en orden: las cerradas (sesiones_detalle) + la
 * vigente (hora_entrada/hora_salida) — mismo criterio que usa
 * registro-detalle/[id].tsx para reconstruir un día con reingreso.
 */
function sesionesDelRegistro(r: RegistroDiario): SesionSimple[] {
  return [...(r.sesiones_detalle ?? []), { hora_entrada: r.hora_entrada, hora_salida: r.hora_salida }];
}

/** ISO string de la fecha del lunes de la semana a la que pertenece `fecha`. */
function lunesDeSemana(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00`);
  const dia = d.getDay(); // 0=Dom
  const diff = dia === 0 ? -6 : 1 - dia;
  d.setDate(d.getDate() + diff);
  return toISODate(d);
}

// ── Funciones públicas ─────────────────────────────────────────────────────

/** Valor de la hora ordinaria a partir del salario base. */
export function getValorHora(salarioBase: number | null): number {
  if (!salarioBase) return 0;
  return salarioBase / HORAS_MES_NOMINA;
}

/** Pesos ADICIONALES al salario base generados por un registro. */
export function calcularValorExtraDia(r: RegistroDiario, valorHora: number): number {
  // Períodos cerrados congelan el valor/hora vigente al cierre (migración 010b) —
  // usarlo evita que un cambio posterior de salario distorsione el historial.
  const vh = r.valor_hora_snapshot ?? valorHora;
  if (vh <= 0) return 0;
  return Math.round(
    vh * (
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

/** Estado del día actual según el registro de hoy y la solicitud de reingreso activa. */
export function getEstadoHoy(
  registroHoy: RegistroDiario | null,
  hayPeriodoAbierto: boolean,
): EstadoHoy {
  if (!hayPeriodoAbierto)         return 'sin_periodo';
  if (!registroHoy?.hora_entrada) return 'sin_registro';
  if (!registroHoy.hora_salida)   return 'en_jornada';
  if (registroHoy.reingreso_estado === 'aprobado')  return 'reingreso_aprobado';
  if (registroHoy.reingreso_estado === 'pendiente') return 'reingreso_pendiente';
  return 'jornada_completa';
}

/**
 * Minutos transcurridos desde hora_entrada ("HH:MM" u "HH:MM:SS", hora Bogotá
 * — así la guarda el backend) hasta ahora. Ancla ambos lados a hora Bogotá vía
 * aritmética UTC (mismo truco que bogotaToday()) en vez de new Date(y,m,d,hh,mm),
 * que se interpreta en el timezone del DISPOSITIVO — si el celular no tiene
 * configurado America/Bogota, esa construcción reintroduce el desfase de 5h.
 */
function minutosTranscurridosDesde(horaEntrada: string): number {
  const parts = horaEntrada.split(':').map(Number);
  const hh = parts[0];
  const mm = parts[1] ?? 0;
  if (isNaN(hh) || isNaN(mm)) return NaN;

  const nowBogota = new Date(Date.now() - BOGOTA_OFFSET_MS); // getUTC* == hora Bogotá
  const entradaBogota = Date.UTC(
    nowBogota.getUTCFullYear(), nowBogota.getUTCMonth(), nowBogota.getUTCDate(),
    hh, mm, 0, 0,
  );
  let diffMs = nowBogota.getTime() - entradaBogota;
  // Clamp a [0, 24h) — cruce de medianoche.
  if (diffMs < 0) diffMs += 24 * 3_600_000;
  if (diffMs >= 24 * 3_600_000) diffMs -= 24 * 3_600_000;
  return Math.floor(diffMs / 60_000);
}

/** Formatea minutos totales como "1h 23m" / "45m" / "2h". */
export function fmtDuracionMin(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Tiempo transcurrido desde hora_entrada hasta ahora, formateado ("1h 23m", "45m"). */
export function calcularElapsedLabel(horaEntrada: string): string {
  const totalMin = minutosTranscurridosDesde(horaEntrada);
  return isNaN(totalMin) ? '—' : fmtDuracionMin(totalMin);
}

/** Minutos transcurridos desde hora_entrada hasta ahora (para lógica de descanso). */
export function calcularElapsedMinutes(horaEntrada: string): number {
  const totalMin = minutosTranscurridosDesde(horaEntrada);
  return isNaN(totalMin) ? 0 : totalMin;
}

/**
 * True si la jornada en curso ya superó el umbral de jornada continua — punto
 * en el que backend (calcularHoras) empezaría a descontar 1h de almuerzo por
 * defecto. Se usa para decidir si vale la pena ofrecer la ventana de "jornada
 * continua" al marcar salida (por debajo del umbral el descuento no aplicaría
 * de todas formas).
 */
export function debePreguntarJornadaContinua(horaEntrada: string): boolean {
  return calcularElapsedMinutes(horaEntrada) > JORNADA_CONTINUA_UMBRAL_HORAS * 60;
}

/**
 * Minutos de almuerzo descontados automáticamente en un registro ya cerrado
 * (Art. 167 CST) — se derivan comparando la suma del span de CADA sesión
 * (entrada→salida, incluye las cerradas por reingreso vía sesiones_detalle)
 * contra el total de horas ya clasificadas, en vez de pedirle un campo nuevo
 * al backend. calcularHoras() en el backend aplica el descuento por sesión
 * (cada marcarSalida evalúa solo el span de ESA sesión), así que sumar todas
 * las sesiones reproduce exactamente el mismo total, con o sin reingreso.
 */
export function minutosAlmuerzoDescontados(r: RegistroDiario): number {
  const sesiones = sesionesDelRegistro(r);
  let span = 0;
  let huboSesionCerrada = false;
  for (const s of sesiones) {
    const m = spanMinutosSesion(s);
    if (m != null) { span += m; huboSesionCerrada = true; }
  }
  if (!huboSesionCerrada) return 0;

  const trabajado = Math.round(
    (Number(r.horas_ordinarias) + Number(r.horas_extra_diurnas) + Number(r.horas_extra_nocturnas)
      + Number(r.horas_nocturnas) + Number(r.horas_festivo)) * 60
  );
  const almuerzo = span - trabajado;
  return almuerzo > 0 ? almuerzo : 0;
}

/**
 * True si ALGUNA sesión del día superó el umbral de jornada continua — el
 * punto exacto en el que esa sesión, individualmente, habría disparado el
 * descuento de almuerzo en el backend (que evalúa sesión por sesión, no el
 * día completo).
 */
export function esJornadaLarga(r: RegistroDiario): boolean {
  return sesionesDelRegistro(r).some((s) => {
    const m = spanMinutosSesion(s);
    return m != null && m > JORNADA_CONTINUA_UMBRAL_HORAS * 60;
  });
}

export interface ExplicacionHorasExtra {
  /** Horas ordinarias+nocturnas que ya llevaba esta semana antes de hoy. */
  acumuladoSemana: number;
  /** Cuánto de la jornada de hoy sí cupo en el tope semanal (42h). */
  cupoUsado: number;
  /** Cuánto de la jornada de hoy quedó fuera del cupo y pasó a extra. */
  horasExtra: number;
  /** Tope semanal usado (JORNADA_SEMANAL_HORAS) — para el texto. */
  topeSemanal: number;
}

/**
 * Explica por qué un día tuvo horas extra: no es que "trabajaste más de 8h",
 * es que el cupo ordinario (42h/semana, no por día) ya se agotó antes de hoy.
 * null si el día no tuvo horas extra por tope semanal — nada que explicar
 * (un día festivo también puede tener horas "extra" en el sentido coloquial,
 * pero esas van a horas_festivo, no a horas_extra_*, así que no aplica aquí).
 */
export function explicarHorasExtra(r: RegistroDiario): ExplicacionHorasExtra | null {
  const horasExtra = Number(r.horas_extra_diurnas) + Number(r.horas_extra_nocturnas);
  if (horasExtra <= 0) return null;
  return {
    acumuladoSemana: Number(r.horas_acumuladas_semana),
    cupoUsado: Number(r.horas_ordinarias) + Number(r.horas_nocturnas),
    horasExtra,
    topeSemanal: JORNADA_SEMANAL_HORAS,
  };
}

// ── Formatters ──────────────────────────────────────────────────────────────

const SHORT_MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const SHORT_DAYS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

export function fmtHora(t: string | null | undefined): string {
  if (!t) return '—';
  return t.slice(0, 5);
}

/**
 * Hora de entrada a mostrar en UI: la primera apertura del día
 * (hora_entrada_inicial), no la sesión actual — que tras un reingreso
 * aprobado sobreescribe hora_entrada con la nueva hora de entrada.
 */
export function horaEntradaMostrada(r: RegistroDiario | null | undefined): string | null {
  return r?.hora_entrada_inicial ?? r?.hora_entrada ?? null;
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

export const TIPO_PERIODO_LABEL: Record<TipoPeriodo, string> = {
  semanal:   'Semanal',
  quincenal: 'Quincenal',
  mensual:   'Mensual',
};

export const TIPO_DIA_LABEL: Partial<Record<TipoDia, string>> = {
  descanso:      'Descanso',
  compensatorio: 'Compensatorio',
  incapacidad:   'Incapacidad',
  vacacion:      'Vacación',
  licencia:      'Licencia',
};
