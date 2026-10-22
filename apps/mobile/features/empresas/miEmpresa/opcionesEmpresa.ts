import type { TipoLiquidacion, TipoContrato } from '@api-client';

export const TIPO_LIQUIDACION_OPTIONS: { value: TipoLiquidacion; label: string; sub: string }[] = [
  { value: 'mensual',    label: 'Mensual',    sub: 'Ej. 1–30 Jun' },
  { value: 'quincenal',  label: 'Quincenal',  sub: 'Ej. 1–15 / 16–30' },
  { value: 'semanal',    label: 'Semanal',    sub: 'Lun–Dom' },
];

export const TIPO_CONTRATO_OPTIONS: { value: TipoContrato; label: string; sub: string }[] = [
  { value: 'laboral',              label: 'Contrato laboral',        sub: 'Descuenta salud y pensión' },
  { value: 'prestacion_servicios', label: 'Prestación de servicios', sub: 'El independiente se autoliquida' },
];

export const RECARGOS_OPTIONS: { value: boolean; label: string; sub: string }[] = [
  { value: true,  label: 'Con recargos', sub: 'Recargo nocturno y festivo según la ley' },
  { value: false, label: 'Sin recargos', sub: 'Normales hasta 42 h; después, extra diurna' },
];

export const DOMINGO_HABITUAL_OPTIONS: { value: 'ley' | 'dos_meses'; label: string }[] = [
  { value: 'ley',       label: '3 o más domingos en el mes (ley)' },
  { value: 'dos_meses', label: '2 meses seguidos trabajando domingos' },
];
