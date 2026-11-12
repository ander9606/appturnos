import { Link } from 'react-router';
import { fmtDate } from '@/shared/lib/format';
import type { TurnoDeGrupo } from '../types';

/**
 * Un turno de un grupo: fecha, título, horario y cuántas plazas están cubiertas (los cancelados salen tachados). En el
 * detalle del grupo va como tarjeta; `compacta` es la versión de lista que se despliega dentro de la tarjeta del grupo.
 */
export function FilaTurno({ turno: t, compacta = false }: { turno: TurnoDeGrupo; compacta?: boolean }) {
  const cancelado = t.estado === 'cancelada';
  // Cancelado por fuerza mayor con compensación: no es un cancelado a secas, tiene un costo.
  const fallidos = cancelado ? (t.fallidos ?? 0) : 0;
  return (
    <Link
      to={`/turnos/${t.id}`}
      className={compacta
        ? 'block px-4 py-2.5 border-t border-border hover:bg-muted/60 transition-colors'
        : 'block bg-card border border-border rounded-xl px-4 py-3 hover:border-primary/50 transition-colors'}
    >
      <p className="text-xs font-semibold text-muted-foreground uppercase">{fmtDate(t.fecha)}</p>
      <p className={`${compacta ? 'text-sm' : ''} font-semibold ${cancelado && fallidos === 0 ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{t.titulo}</p>
      <p className={`${compacta ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
        {t.hora_inicio.slice(0, 5)}{t.hora_fin_estimada ? ` – ${t.hora_fin_estimada.slice(0, 5)}` : ''}{t.fin_dia_siguiente ? ' (día sig.)' : ''}
        {fallidos > 0 ? ' · ' : cancelado ? ' · Cancelado' : ` · ${t.plazas_cubiertas} de ${t.plazas} plazas cubiertas`}
        {fallidos > 0 && (
          <span className="font-semibold text-warning">Turno fallido · {fallidos} {fallidos === 1 ? 'compensado' : 'compensados'}</span>
        )}
      </p>
    </Link>
  );
}
