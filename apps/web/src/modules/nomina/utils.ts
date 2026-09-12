import type { Registro } from './types';

// Espejo de JORNADA_CONTINUA_UMBRAL_HORAS en backend/config/constants.js.
const UMBRAL_JORNADA_CONTINUA_MIN = 6 * 60;

// Tope semanal FIJO que usa calcularHoras() en el backend para clasificar
// ordinaria vs extra (JORNADA_SEMANAL_HORAS en backend/config/constants.js).
const JORNADA_SEMANAL_HORAS = 42;

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
function sesionesDelRegistro(r: Registro): SesionSimple[] {
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
  };
}
