import type { LiquidacionLinea, TipoDescuento } from '@api-client';
import { formatCOP } from '@/lib/formatters';
import { RECARGO_EXTRA } from './trabajador/nominaTrabajadorUtils';

export type ClaveConcepto = 'base' | 'nocturno' | 'extraDiurna' | 'extraNocturna' | 'festivo';

export interface ConceptoPago {
  clave: ClaveConcepto;
  /** Etiqueta corta de una línea; la cuenta completa va en `formula` (se muestra al tocar). */
  label: string;
  monto: number;
  formula: string;
}

export interface DescuentoPago {
  clave: string;
  label: string;
  monto: number;
}

export interface DesglosePago {
  /** Lo que suma el bruto; solo los conceptos con monto > 0 (la base siempre va). */
  conceptos: ConceptoPago[];
  bruto: number;
  descuentos: DescuentoPago[];
  /** El auxilio de transporte se suma al neto, NO al bruto (no es base de aportes). */
  auxilio: number;
  neto: number;
}

const TIPO_DESCUENTO: Record<TipoDescuento, string> = {
  prestamo: 'Préstamo', inasistencia: 'Inasistencia', dano_equipo: 'Daño a equipo', anticipo: 'Anticipo', otro: 'Otro',
};

const h = (n: number) => `${Number(n).toFixed(1).replace('.', ',')}h`;
/** Factor con coma decimal, como el resto de los números de la pantalla: 1.9 → "1,9". */
const x = (n: number) => String(Number(n)).replace('.', ',');

/**
 * Convierte una línea de la liquidación en lo que se dibuja: conceptos que suman el bruto, descuentos, auxilio y
 * neto. Lee los montos de la liquidación (la misma que ve el gestor) — no recalcula nada, así la pantalla no puede
 * diverger de lo que se paga.
 */
export function desglosePago(l: LiquidacionLinea): DesglosePago {
  const vh = formatCOP(Number(l.valor_hora));
  const conceptos: ConceptoPago[] = [
    {
      clave: 'base',
      label: l.salario_base != null ? 'Salario base' : `Horas ordinarias · ${h(l.horas_ordinarias)}`,
      monto: Number(l.pago_ordinario),
      formula: l.salario_base != null
        ? `${formatCOP(Number(l.salario_base))} ÷ 30 × ${l.dias_periodo} días (no depende de las horas)`
        : `${h(l.horas_ordinarias)} × ${vh}`,
    },
    {
      clave: 'nocturno', label: `Recargo nocturno · ${h(l.horas_nocturnas)}`, monto: Number(l.pago_nocturno),
      formula: `${h(l.horas_nocturnas)} × ${vh} × ${x(l.recargo_nocturno)}`,
    },
    {
      clave: 'extraDiurna', label: `Extra diurna · ${h(l.horas_extra_diurnas)}`, monto: Number(l.pago_extra_diurno),
      formula: `${h(l.horas_extra_diurnas)} × ${vh} × ${x(RECARGO_EXTRA.EXTRA_DIURNA)}`,
    },
    {
      clave: 'extraNocturna', label: `Extra nocturna · ${h(l.horas_extra_nocturnas)}`, monto: Number(l.pago_extra_nocturno),
      formula: `${h(l.horas_extra_nocturnas)} × ${vh} × ${x(RECARGO_EXTRA.EXTRA_NOCTURNA)}`,
    },
    {
      clave: 'festivo', label: `Festivo y dominical · ${h(l.horas_festivo)}`, monto: Number(l.pago_festivo),
      formula: `${h(l.horas_festivo)} × ${vh} × ${x(l.recargo_festivo)}`,
    },
  ].filter((c) => c.clave === 'base' || c.monto > 0) as ConceptoPago[];

  const descuentos: DescuentoPago[] = [
    { clave: 'salud', label: 'Salud (4%)', monto: Number(l.descuento_salud) },
    { clave: 'pension', label: 'Pensión', monto: Number(l.descuento_pension) },
    ...l.otros_descuentos.map((d) => ({
      clave: `d${d.id}`, label: d.motivo ? `${TIPO_DESCUENTO[d.tipo]} · ${d.motivo}` : TIPO_DESCUENTO[d.tipo], monto: Number(d.monto),
    })),
  ].filter((d) => d.monto > 0);

  return { conceptos, bruto: Number(l.total), descuentos, auxilio: Number(l.subsidio_transporte), neto: Number(l.neto) };
}
