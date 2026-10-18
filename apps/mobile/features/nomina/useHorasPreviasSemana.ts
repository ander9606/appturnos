import { useMemo } from 'react';
import type { RegistroDiario } from '@api-client';
import { useRegistrosHistorial } from './useNomina';
import { tramoSemanaPrevia, sumarHoras } from './trabajador/nominaTrabajadorUtils';

/**
 * Horas que cada trabajador ya llevaba en la semana en que EMPIEZA el período (las del período
 * anterior), para que el resumen semanal no subestime cuánto del tope de 42 h estaba usado.
 * Solo consulta si el período arranca a mitad de semana. `lunes` es la semana a la que se suman.
 */
export function useHorasPreviasSemana(registros: RegistroDiario[]) {
  const tramo = useMemo(() => {
    let min: string | null = null;
    for (const r of registros) if (!min || r.fecha < min) min = r.fecha;
    return min ? tramoSemanaPrevia(min) : null;
  }, [registros]);

  const { data } = useRegistrosHistorial({
    enabled: tramo !== null,
    fechaDesde: tramo?.desde,
    fechaHasta: tramo?.hasta,
  });

  return useMemo(() => {
    const porTrabajador = new Map<number, number>();
    if (tramo && data?.data) {
      const grupos = new Map<number, RegistroDiario[]>();
      for (const r of data.data) {
        const g = grupos.get(r.trabajador_id);
        if (g) g.push(r); else grupos.set(r.trabajador_id, [r]);
      }
      for (const [id, rs] of grupos) porTrabajador.set(id, sumarHoras(rs));
    }
    return { lunes: tramo?.desde ?? null, porTrabajador };
  }, [tramo, data]);
}
