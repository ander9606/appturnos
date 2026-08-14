import React from 'react';
import { Badge } from '@/components/ui/Badge';
import type { TipoPeriodo } from '@api-client';
import { TIPO_PERIODO_LABEL } from './trabajador/nominaTrabajadorUtils';

export function TipoPeriodoBadge({ tipo }: { tipo: TipoPeriodo }) {
  return <Badge label={TIPO_PERIODO_LABEL[tipo]} variant="info" size="sm" />;
}
