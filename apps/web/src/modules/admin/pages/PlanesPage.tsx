import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Save } from 'lucide-react';
import { usePlanes, useActualizarPlan } from '../hooks/useAdmin';
import { ErrorState } from '@/shared/components/ErrorState';
import { fmtCOP } from '@/shared/lib/format';
import { precioPlan, type PlanConfig } from '../types';

// Tamaños de empresa para la vista previa de "cuánto pagaría".
const EJEMPLOS_TRABAJADORES = [5, 25, 100];

/** '' → null (campo opcional vacío); cualquier otro valor → entero. */
function aEnteroONull(v: string): number | null {
  return v.trim() === '' ? null : Math.round(Number(v));
}

function Campo({ id, label, hint, value, onChange }: {
  id: string; label: string; hint?: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input
        id={id}
        type="number"
        min={0}
        inputMode="numeric"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function PlanCard({ plan }: { plan: PlanConfig }) {
  const actualizar = useActualizarPlan();
  const [precio, setPrecio] = useState(String(plan.precio_cop));
  const [max, setMax] = useState(plan.max_trabajadores == null ? '' : String(plan.max_trabajadores));
  const [incluidos, setIncluidos] = useState(plan.incluidos == null ? '' : String(plan.incluidos));
  const [adicional, setAdicional] = useState(plan.precio_adicional_cop == null ? '' : String(plan.precio_adicional_cop));

  const borrador: PlanConfig = {
    ...plan,
    precio_cop: aEnteroONull(precio) ?? 0,
    max_trabajadores: aEnteroONull(max),
    incluidos: aEnteroONull(incluidos),
    precio_adicional_cop: aEnteroONull(adicional),
  };
  const adicionalesIncompletos = (borrador.incluidos == null) !== (borrador.precio_adicional_cop == null);
  const precioInvalido = precio.trim() === '' || borrador.precio_cop < 0;
  const cambio =
    borrador.precio_cop !== plan.precio_cop ||
    borrador.max_trabajadores !== plan.max_trabajadores ||
    borrador.incluidos !== plan.incluidos ||
    borrador.precio_adicional_cop !== plan.precio_adicional_cop;

  const guardar = () => actualizar.mutate({
    codigo: plan.codigo,
    data: {
      precio_cop: borrador.precio_cop,
      max_trabajadores: borrador.max_trabajadores,
      incluidos: borrador.incluidos,
      precio_adicional_cop: borrador.precio_adicional_cop,
    },
  });

  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold text-foreground">{plan.nombre}</h2>
        <span className="text-lg font-bold text-foreground">{fmtCOP(borrador.precio_cop)}<span className="text-xs font-normal text-muted-foreground">/mes</span></span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Campo id={`${plan.codigo}-precio`} label="Precio base (COP/mes)" value={precio} onChange={setPrecio} />
        <Campo id={`${plan.codigo}-max`} label="Máx. trabajadores" hint="Vacío = sin tope" value={max} onChange={setMax} />
        <Campo id={`${plan.codigo}-incluidos`} label="Trabajadores incluidos" hint="Vacío = sin cobro adicional" value={incluidos} onChange={setIncluidos} />
        <Campo id={`${plan.codigo}-adicional`} label="Precio por adicional (COP)" value={adicional} onChange={setAdicional} />
      </div>

      {adicionalesIncompletos && (
        <p role="alert" className="text-xs text-danger">
          "Trabajadores incluidos" y "Precio por adicional" van juntos: llena ambos o deja ambos vacíos.
        </p>
      )}

      <div className="bg-muted/40 rounded-xl px-3 py-2">
        <p className="text-[11px] font-medium text-muted-foreground uppercase mb-1">Una empresa pagaría</p>
        <ul className="text-xs text-foreground flex flex-col gap-0.5">
          {EJEMPLOS_TRABAJADORES.map(n => {
            const excede = borrador.max_trabajadores != null && n > borrador.max_trabajadores;
            return (
              <li key={n} className="flex justify-between">
                <span>{n} trabajadores</span>
                <span className={excede ? 'text-muted-foreground' : 'font-medium'}>
                  {excede ? 'excede el tope' : fmtCOP(precioPlan(borrador, n))}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <button
        onClick={guardar}
        disabled={!cambio || adicionalesIncompletos || precioInvalido || actualizar.isPending}
        className="self-end inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
      >
        <Save size={14} />
        {actualizar.isPending ? 'Guardando…' : 'Guardar'}
      </button>
    </div>
  );
}

export function PlanesPage() {
  const { data, isLoading, isError, error, refetch } = usePlanes();
  const planes = data?.data ?? [];

  return (
    <div className="flex flex-col gap-5 max-w-5xl">
      <div>
        <Link to="/admin/empresas" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft size={13} /> Panel global
        </Link>
        <h1 className="text-xl font-bold text-foreground">Planes y precios</h1>
        <p className="text-sm text-muted-foreground">
          Los cambios aplican a los próximos links de pago y renovaciones. Lo que una empresa ya pagó no cambia.
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground py-8 text-center">Cargando...</p>}
      {isError && <ErrorState error={error} onRetry={refetch} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* key incluye updated_at: tras guardar, la tarjeta se reinicia con los valores del servidor. */}
        {planes.map(p => <PlanCard key={`${p.codigo}-${p.updated_at}`} plan={p} />)}
      </div>
    </div>
  );
}
