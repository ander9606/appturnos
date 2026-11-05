import type { FaseGrupo } from '../types';
import { FASE_INFO } from '../grupoUtils';

/** Píldora con el momento en que está el grupo: Próximo, En curso, Terminado… */
export function FaseChip({ fase }: { fase: FaseGrupo }) {
  const { label, clase } = FASE_INFO[fase];
  return <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold flex-shrink-0 ${clase}`}>{label}</span>;
}
