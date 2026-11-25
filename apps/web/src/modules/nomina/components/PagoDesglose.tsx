import { useMemo, useState } from 'react';
import type { LiquidacionLinea } from '../types';
import { desglosePago, type ClaveConcepto } from '../utils';
import { fmtCOP } from '@/shared/lib/format';

/** Mismos colores que las horas (validados para daltonismo): variables CSS, no hex (DISENO §2.4). */
const COLOR_CONCEPTO: Record<ClaveConcepto, string> = {
  base: 'var(--color-hora-ordinaria)',
  nocturno: 'var(--color-hora-nocturna)',
  extraDiurna: 'var(--color-hora-extra)',
  extraNocturna: 'var(--color-hora-extra-nocturna)',
  festivo: 'var(--color-hora-festivo)',
};

/**
 * De dónde sale el pago de un período, sin párrafos: una barra apilada en pesos, una fila corta por concepto y,
 * debajo, bruto → descuentos → auxilio → neto. La cuenta ("horas × valor × factor") queda un clic más abajo en
 * cada fila. Lee los montos de la liquidación, no los recalcula. Espejo de mobile (PagoDesglose.tsx).
 */
export function PagoDesglose({ linea }: { linea: LiquidacionLinea }) {
  const d = useMemo(() => desglosePago(linea), [linea]);
  const [abierto, setAbierto] = useState<string | null>(null);
  const hayAjustes = d.descuentos.length > 0 || d.auxilio > 0;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5" aria-hidden="true">
        {d.conceptos.map(c => (
          <div key={c.clave} style={{ flex: c.monto, backgroundColor: COLOR_CONCEPTO[c.clave] }} />
        ))}
      </div>

      <ul className="flex flex-col">
        {d.conceptos.map(c => (
          <li key={c.clave}>
            <button
              type="button"
              onClick={() => setAbierto(a => (a === c.clave ? null : c.clave))}
              aria-expanded={abierto === c.clave}
              title="Ver cómo se calcula"
              className="w-full flex items-center gap-2.5 py-1.5 text-left hover:bg-muted/50 rounded-md px-1 -mx-1 transition-colors"
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLOR_CONCEPTO[c.clave] }} />
              <span className="flex-1 text-foreground">{c.label}</span>
              <span className="font-semibold text-foreground tabular-nums">{fmtCOP(c.monto)}</span>
            </button>
            {abierto === c.clave && <p className="text-xs text-muted-foreground pl-5 pb-1">{c.formula}</p>}
          </li>
        ))}
      </ul>

      {hayAjustes ? (
        <div className="flex flex-col gap-1 pt-2 border-t border-border">
          <Fila label="Bruto" valor={fmtCOP(d.bruto)} fuerte />
          {d.descuentos.map(x => (
            <Fila key={x.clave} label={x.label} valor={`-${fmtCOP(x.monto)}`} clase="text-danger-text" />
          ))}
          {d.auxilio > 0 && <Fila label="Auxilio de transporte" valor={`+${fmtCOP(d.auxilio)}`} />}
          <div className="flex items-center justify-between pt-2 mt-1 border-t border-border">
            <span className="font-semibold text-foreground">Neto a pagar</span>
            <span className="text-xl font-extrabold text-success tabular-nums">{fmtCOP(d.neto)}</span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="font-semibold text-foreground">Total a pagar</span>
          <span className="text-xl font-extrabold text-success tabular-nums">{fmtCOP(d.neto)}</span>
        </div>
      )}
    </div>
  );
}

function Fila({ label, valor, fuerte, clase = 'text-foreground' }: { label: string; valor: string; fuerte?: boolean; clase?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={fuerte ? 'font-semibold text-foreground' : 'text-muted-foreground'}>{label}</span>
      <span className={`tabular-nums ${fuerte ? 'font-semibold' : 'font-medium'} ${clase}`}>{valor}</span>
    </div>
  );
}
