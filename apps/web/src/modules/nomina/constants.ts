import type { EstadoPeriodo, TipoDia, TipoDescuento } from './types';

export const TIPO_DIA_LABELS: Record<TipoDia, string> = {
  ordinario: 'Ordinario',
  descanso: 'Descanso',
  compensatorio: 'Compensatorio',
  incapacidad: 'Incapacidad',
  vacacion: 'Vacación',
  licencia: 'Licencia',
};

export const TIPO_DIA_OPTIONS: TipoDia[] = ['ordinario', 'descanso', 'compensatorio', 'incapacidad', 'vacacion', 'licencia'];

export const TIPO_DESCUENTO_LABELS: Record<TipoDescuento, string> = {
  prestamo: 'Préstamo',
  inasistencia: 'Inasistencia',
  dano_equipo: 'Daño a equipo',
  anticipo: 'Anticipo',
  otro: 'Otro',
};

export const ESTADO_DESCUENTO_BADGE: Record<string, string> = {
  pendiente: 'bg-warning-light text-warning',
  aceptado: 'bg-success-light text-success',
  rechazado: 'bg-muted text-muted-foreground',
};

export const ESTADO_BADGE: Record<EstadoPeriodo, string> = {
  abierto: 'bg-success-light text-success',
  cerrado: 'bg-warning-light text-warning',
  liquidado: 'bg-muted text-muted-foreground',
};

/** Art. 180/181 CST — ocasional: sin recargo, solo compensatorio; habitual: recargo + compensatorio. */
export const CLASIFICACION_BADGE: Record<string, string> = {
  ocasional: 'bg-info-light text-info',
  habitual: 'bg-muted text-foreground',
};
export const CLASIFICACION_LABEL: Record<string, string> = {
  ocasional: 'Ocasional',
  habitual: 'Habitual · recargo',
};
