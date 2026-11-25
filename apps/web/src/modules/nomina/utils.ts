import type { Registro, DescansoCompensatorio, LiquidacionLinea } from './types';
import { fmtCOP } from '@/shared/lib/format';
import { TIPO_DESCUENTO_LABELS } from './constants';
import { JORNADA_SEMANAL_HORAS, RECARGO_EXTRA_DIURNA, RECARGO_EXTRA_NOCTURNA } from '@/shared/laboral';

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
  /** Horas de festivo habitual acreditadas a esta semana por un compensatorio tomado en ella (ya están en horasTotales). */
  horasCompensatorio?: number;
  /** Día(s) de la semana en que se toma el compensatorio que acredita esas horas (fecha_asignada). */
  fechasCompensatorio?: string[];
  /** Fecha del festivo trabajado que originó cada crédito (otra semana u otro período). */
  origenesCompensatorio?: string[];
}

export interface CreditoCompensatorio { fecha_asignada: string; origen_fecha: string; horas: number }

/**
 * Créditos al tope semanal de los compensatorios de un trabajador — mismo criterio que
 * `sumarOrdinariasEnSemana` del backend: asignados/tomados, con horas de festivo habitual > 0 y ya
 * llegados (`fecha_asignada <= hastaISO`). Espejo de mobile (nominaTrabajadorUtils.ts).
 */
export function creditosDeCompensatorios(
  compensatorios: DescansoCompensatorio[],
  trabajadorId: number,
  hastaISO: string,
): CreditoCompensatorio[] {
  const out: CreditoCompensatorio[] = [];
  for (const c of compensatorios) {
    const horas = Number(c.horas_festivo_origen ?? 0);
    if (c.trabajador_id !== trabajadorId || (c.estado !== 'asignado' && c.estado !== 'tomado')) continue;
    if (!c.fecha_asignada || c.fecha_asignada > hastaISO || horas <= 0) continue;
    out.push({ fecha_asignada: c.fecha_asignada, origen_fecha: c.origen_fecha, horas });
  }
  return out;
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
  /** Horas que acreditan los compensatorios tomados en cada semana (ver creditosDeCompensatorios). */
  creditos: CreditoCompensatorio[] = [],
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
      const delSemana = creditos.filter(c => lunesDeSemana(c.fecha_asignada) === inicioSemana);
      const horasComp = delSemana.reduce((a, c) => a + c.horas, 0);
      const horasTotales = horasPeriodo + horasPrevias + horasComp;
      return {
        inicioSemana,
        horasTotales,
        limiteHoras: JORNADA_SEMANAL_HORAS,
        horasExtra: Math.max(0, horasTotales - JORNADA_SEMANAL_HORAS),
        ...(horasPrevias > 0 ? { horasPrevias } : {}),
        ...(horasComp > 0 ? { horasCompensatorio: horasComp, origenesCompensatorio: delSemana.map(c => c.origen_fecha), fechasCompensatorio: delSemana.map(c => c.fecha_asignada) } : {}),
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

export interface Tramo { desde: string; hasta: string }

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function sumarDias(fecha: string, n: number): string {
  const d = new Date(`${fecha}T00:00:00`);
  d.setDate(d.getDate() + n);
  return iso(d);
}

/**
 * Parte una semana (lun–dom) según un período: días de ESTE período, los que quedaron en el ANTERIOR
 * y los que seguirán en el SIGUIENTE. Mismo criterio que mobile (nominaTrabajadorUtils.ts).
 */
export function tramosSemana(lunes: string, periodoInicio: string, periodoFin: string): {
  enPeriodo: Tramo; anterior: Tramo | null; siguiente: Tramo | null;
} {
  const domingo = sumarDias(lunes, 6);
  return {
    enPeriodo: { desde: lunes > periodoInicio ? lunes : periodoInicio, hasta: domingo < periodoFin ? domingo : periodoFin },
    anterior:  lunes < periodoInicio ? { desde: lunes, hasta: sumarDias(periodoInicio, -1) } : null,
    siguiente: domingo > periodoFin ? { desde: sumarDias(periodoFin, 1), hasta: domingo } : null,
  };
}

export type ZonaDia = 'anterior' | 'este' | 'siguiente';

/** Los 7 días de una semana (lun–dom) con su zona respecto del período. Espejo de mobile (diasSemanaEnPeriodo). */
export function diasSemanaEnPeriodo(lunes: string, periodoInicio: string, periodoFin: string): { fecha: string; zona: ZonaDia }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const fecha = sumarDias(lunes, i);
    return { fecha, zona: fecha < periodoInicio ? 'anterior' : fecha > periodoFin ? 'siguiente' : 'este' };
  });
}

/** Agrupa días consecutivos de la misma zona. */
export function tramosContiguos(dias: { zona: ZonaDia }[]): { zona: ZonaDia; n: number }[] {
  const out: { zona: ZonaDia; n: number }[] = [];
  for (const d of dias) {
    const ultimo = out[out.length - 1];
    if (ultimo && ultimo.zona === d.zona) ultimo.n++;
    else out.push({ zona: d.zona, n: 1 });
  }
  return out;
}

const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** "Lun 12 – Dom 18 Oct" (mismo mes) o "Lun 26 Oct – Dom 1 Nov". Un solo día: "Vie 16 Oct". */
export function fmtRangoDias(desde: string, hasta: string): string {
  const a = new Date(`${desde}T00:00:00`);
  const b = new Date(`${hasta}T00:00:00`);
  const dm = (d: Date) => `${DIAS_CORTOS[d.getDay()]} ${d.getDate()}`;
  if (desde === hasta) return `${dm(a)} ${MESES_CORTOS[a.getMonth()]}`;
  return a.getMonth() === b.getMonth()
    ? `${dm(a)} – ${dm(b)} ${MESES_CORTOS[b.getMonth()]}`
    : `${dm(a)} ${MESES_CORTOS[a.getMonth()]} – ${dm(b)} ${MESES_CORTOS[b.getMonth()]}`;
}

/** Espejo de COMPENSATORIO_PLAZO_DIAS (backend/config/constants.js): días para tomar el descanso. */
export const COMPENSATORIO_PLAZO_DIAS = 28;

/** Último día en que se puede tomar un descanso por el festivo trabajado en `origenFecha`. */
export function vencimientoCompensatorio(origenFecha: string): string {
  return sumarDias(origenFecha, COMPENSATORIO_PLAZO_DIAS);
}

/**
 * Compensatorios pendientes de un trabajador que se pueden tomar el día `fecha`: dentro de los 28 días
 * siguientes al festivo trabajado. El más antiguo primero — es el que se preselecciona. Mismo criterio que
 * `elegirPendienteParaDia` del backend, que es quien decide de verdad. Espejo de mobile (disponibles.ts).
 */
export function compensatoriosDisponibles(
  lista: DescansoCompensatorio[],
  trabajadorId: number,
  fecha: string,
): DescansoCompensatorio[] {
  return lista
    .filter(c => c.trabajador_id === trabajadorId && c.estado === 'pendiente'
      && fecha > c.origen_fecha && fecha <= vencimientoCompensatorio(c.origen_fecha))
    .sort((a, b) => a.origen_fecha.localeCompare(b.origen_fecha) || a.id - b.id);
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

// ── Desglose del pago (espejo de mobile: features/nomina/pagoDesglose.ts) ───────────────

export type ClaveConcepto = 'base' | 'nocturno' | 'extraDiurna' | 'extraNocturna' | 'festivo';
export interface ConceptoPago { clave: ClaveConcepto; label: string; monto: number; formula: string }
export interface DescuentoPago { clave: string; label: string; monto: number }
export interface DesglosePago {
  /** Lo que suma el bruto; solo los conceptos con monto > 0 (la base siempre va). */
  conceptos: ConceptoPago[];
  bruto: number;
  descuentos: DescuentoPago[];
  /** El auxilio de transporte se suma al neto, NO al bruto (no es base de aportes). */
  auxilio: number;
  neto: number;
}

/** Horas y factores con punto decimal, como el resto de la app (`fmtHrs`). */
const hrs = (n: number) => `${Number(n).toFixed(1)}h`;
const factor = (n: number) => String(Number(n));

/**
 * Convierte una línea de la liquidación en lo que se dibuja. Lee los montos de la liquidación (la misma que ve el
 * trabajador): no recalcula nada, así la pantalla no puede diverger de lo que se paga.
 */
export function desglosePago(l: LiquidacionLinea): DesglosePago {
  const vh = fmtCOP(Number(l.valor_hora));
  const conceptos: ConceptoPago[] = [
    {
      clave: 'base',
      label: l.salario_base != null ? 'Salario base' : `Horas ordinarias · ${hrs(l.horas_ordinarias)}`,
      monto: Number(l.pago_ordinario),
      formula: l.salario_base != null
        ? `${fmtCOP(Number(l.salario_base))} ÷ 30 × ${l.dias_periodo} días (no depende de las horas)`
        : `${hrs(l.horas_ordinarias)} × ${vh}`,
    },
    { clave: 'nocturno', label: `Recargo nocturno · ${hrs(l.horas_nocturnas)}`, monto: Number(l.pago_nocturno),
      formula: `${hrs(l.horas_nocturnas)} × ${vh} × ${factor(l.recargo_nocturno)}` },
    { clave: 'extraDiurna', label: `Extra diurna · ${hrs(l.horas_extra_diurnas)}`, monto: Number(l.pago_extra_diurno),
      formula: `${hrs(l.horas_extra_diurnas)} × ${vh} × ${factor(RECARGO_EXTRA_DIURNA)}` },
    { clave: 'extraNocturna', label: `Extra nocturna · ${hrs(l.horas_extra_nocturnas)}`, monto: Number(l.pago_extra_nocturno),
      formula: `${hrs(l.horas_extra_nocturnas)} × ${vh} × ${factor(RECARGO_EXTRA_NOCTURNA)}` },
    { clave: 'festivo', label: `Festivo y dominical · ${hrs(l.horas_festivo)}`, monto: Number(l.pago_festivo),
      formula: `${hrs(l.horas_festivo)} × ${vh} × ${factor(l.recargo_festivo)}` },
  ].filter(c => c.clave === 'base' || c.monto > 0) as ConceptoPago[];

  const descuentos: DescuentoPago[] = [
    { clave: 'salud', label: 'Salud (4%)', monto: Number(l.descuento_salud) },
    { clave: 'pension', label: 'Pensión', monto: Number(l.descuento_pension) },
    ...l.otros_descuentos.map(d => ({
      clave: `d${d.id}`, label: d.motivo ? `${TIPO_DESCUENTO_LABELS[d.tipo]} · ${d.motivo}` : TIPO_DESCUENTO_LABELS[d.tipo], monto: Number(d.monto),
    })),
  ].filter(d => d.monto > 0);

  return { conceptos, bruto: Number(l.total), descuentos, auxilio: Number(l.subsidio_transporte), neto: Number(l.neto) };
}
