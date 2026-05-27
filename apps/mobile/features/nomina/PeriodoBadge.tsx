import React from 'react';
import { Badge } from '@/components/ui/Badge';
import type { EstadoPeriodo } from '@api-client';
import type { BadgeVariant } from '../turnos/turnosUtils';

const CONFIG: Record<EstadoPeriodo, { label: string; variant: BadgeVariant }> = {
  abierto:    { label: 'Abierto',    variant: 'success' },
  cerrado:    { label: 'Cerrado',    variant: 'warning' },
  liquidado:  { label: 'Liquidado',  variant: 'default' },
};

export function PeriodoBadge({ estado }: { estado: EstadoPeriodo }) {
  const { label, variant } = CONFIG[estado] ?? CONFIG.cerrado;
  return <Badge label={label} variant={variant} size="sm" />;
}
