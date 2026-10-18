import type { Registro } from './types';
import { JORNADA_SEMANAL_HORAS } from '@/shared/laboral';

// Espejo de JORNADA_CONTINUA_UMBRAL_HORAS en backend/config/constants.js.
const UMBRAL_JORNADA_CONTINUA_MIN = 6 * 60;

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
 * vigente (hora_entrada/hora_salida) — mismo criterio que usa el detalle de
 * registro en mobile para reconstruir un día con reingreso.
 */
export function sesionesDelRegistro(r: Registro): SesionSimple[] {
  return [...(r.sesiones_detalle ?? []), { hora_entrada: r.hora_entrada, hora_salida: r.hora_salida }];
}

/**
 * Minutos de almuerzo descontados automáticamente (Art. 167 CST) — se derivan
 * comparando la suma del span de CADA sesión (incluye las cerradas por
 * reingreso) contra el total de horas ya clasificadas, en vez de pedirle un
 * campo nuevo al backend. calcularHoras() en el backend aplica el descuento
 * por sesión (cada marcarSalida evalúa solo el span de ESA sesión), así que
 * sumar todas las sesiones reproduce exactamente el mismo total, con o sin
 * reingreso.
 */
export function minutosAlmuerzoDescontados(r: Registro): number {
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
export function esJornadaLarga(r: Registro): boolean {
  return sesionesDelRegistro(r).some((s) => {
    const m = spanMinutosSesion(s);
    return m != null && m > UMBRAL_JORNADA_CONTINUA_MIN;
  });
}

export function fmtDuracionMin(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export interface ResumenSemana {
  /** ISO del lunes de la semana. */
  inicioSemana: string;
  horasTotales: number;
  limiteHoras: number;
  horasExtra: number;
  /** Horas de esta semana que cayeron en el período anterior y ya están sumadas en horasTotales. */
  horasPrevias?: number;
  /** Horas de festivo habitual (3.º en adelante): fuera del cupo de 42 h, con recargo; no están en horasTotales. */
  horasFestivo?: number;
}

/** ISO del lunes de la semana a la que pertenece `fecha`. */
function lunesDeSemana(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00`);
  const dia = d.getDay(); // 0=dom
  const diff = dia === 0 ? -6 : 1 - dia;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Agrupa los registros de un trabajador por semana (lunes-domingo) para que
 * el gestor vea claramente qué cuenta para las horas extra (tope semanal,
 * Ley 2101) frente al total del período de facturación (semanal/quincenal/
 * mensual), que puede abarcar varias semanas. Mismo criterio de agrupación
 * que `calcularResumenPeriodo` en mobile (nominaTrabajadorUtils.ts).
 * ponytail: límite fijo en 42h (ya vigente desde jul-2026) en vez de la
 * tabla escalonada por año que usa mobile — solo afecta la etiqueta
 * informativa de períodos históricos anteriores a 2026, no el pago real
 * (ya congelado por calcularHoras en el backend) — upgrade path: portar
 * getJornadaLegalSemanal() si hace falta exactitud histórica aquí también.
 */
export function agruparPorSemana(
  registros: Registro[],
  /** Horas que el trabajador ya llevaba esa semana en el período anterior (el tope de 42 h cruza períodos). */
  previas?: { lunes: string; horas: number },
): ResumenSemana[] {
  const horasPorSemana = new Map<string, number>();
  const festivoPorSemana = new Map<string, number>();
  for (const r of registros) {
    const lunes = lunesDeSemana(r.fecha);
    horasPorSemana.set(lunes, (horasPorSemana.get(lunes) ?? 0) + horasDeRegistro(r));
    const fest = Number(r.horas_festivo);
    if (fest > 0) festivoPorSemana.set(lunes, (festivoPorSemana.get(lunes) ?? 0) + fest);
  }
  return Array.from(horasPorSemana.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([inicioSemana, horasPeriodo]) => {
      const horasPrevias = previas && previas.lunes === inicioSemana && previas.horas > 0 ? previas.horas : 0;
      const horasTotales = horasPeriodo + horasPrevias;
      return {
        inicioSemana,
        horasTotales,
        limiteHoras: JORNADA_SEMANAL_HORAS,
        horasExtra: Math.max(0, horasTotales - JORNADA_SEMANAL_HORAS),
        ...(horasPrevias > 0 ? { horasPrevias } : {}),
        ...(festivoPorSemana.get(inicioSemana) ? { horasFestivo: festivoPorSemana.get(inicioSemana) } : {}),
      };
    });
}

/**
 * Horas de un registro que cuentan para el cupo semanal: todas menos el festivo habitual (horas_festivo).
 * El festivo ocasional (1.º y 2.º del mes) ya viene como horas normales y sí suma.
 */
export function horasDeRegistro(r: Registro): number {
  return [r.horas_ordinarias, r.horas_extra_diurnas, r.horas_extra_nocturnas, r.horas_nocturnas]
    .reduce((a, b) => a + Number(b), 0);
}

/**
 * Tramo de la primera semana del período que cayó ANTES de `primeraFecha` (la fecha más temprana
 * con registros): [lunes, día anterior]. null si ya es lunes — no hay semana partida.
 */
export function tramoSemanaPrevia(primeraFecha: string): { desde: string; hasta: string } | null {
  const lunes = lunesDeSemana(primeraFecha);
  if (lunes === primeraFecha) return null;
  const d = new Date(`${primeraFecha}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return { desde: lunes, hasta: d.toISOString().slice(0, 10) };
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
  /** ISO del lunes que abre la semana contada; puede caer en el período anterior. */
  lunesSemana: string;
}

/**
 * Explica por qué un día tuvo horas extra: no es que "trabajó más de 8h", es
 * que el cupo ordinario (42h/semana, no por día) ya se agotó antes de ese día.
 * null si el día no tuvo horas extra por tope semanal — nada que explicar.
 */
export function explicarHorasExtra(r: Registro): ExplicacionHorasExtra | null {
  const horasExtra = Number(r.horas_extra_diurnas) + Number(r.horas_extra_nocturnas);
  if (horasExtra <= 0) return null;
  return {
    acumuladoSemana: Number(r.horas_acumuladas_semana),
    cupoUsado: Number(r.horas_ordinarias) + Number(r.horas_nocturnas),
    horasExtra,
    topeSemanal: JORNADA_SEMANAL_HORAS,
    lunesSemana: lunesDeSemana(r.fecha),
  };
}
