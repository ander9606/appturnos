import { useState } from 'react';
import { Link } from 'react-router';
import { RefreshCw, AlertCircle, CheckCircle2, Clock, MinusCircle, XCircle } from 'lucide-react';
import { useWompiEventos, useReintentarWompiEvento } from '../hooks/useAdmin';
import type { EstadoWompiEvento, WompiEvento } from '../types';

const ESTADO_CONFIG: Record<EstadoWompiEvento, { label: string; icon: React.ReactNode; cls: string }> = {
  procesado: { label: 'Procesado', icon: <CheckCircle2 size={14} />, cls: 'text-success bg-success-light' },
  error:     { label: 'Error',     icon: <AlertCircle size={14} />,  cls: 'text-danger bg-danger-light' },
  rechazado: { label: 'Rechazado', icon: <XCircle size={14} />,      cls: 'text-danger bg-danger-light' },
  recibido:  { label: 'Recibido',  icon: <Clock size={14} />,        cls: 'text-warning bg-warning-light' },
  ignorado:  { label: 'Ignorado',  icon: <MinusCircle size={14} />,  cls: 'text-muted-foreground bg-muted' },
};

function fmtDate(s: string | null) {
  if (!s) return '—';
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(s));
}

function EstadoBadge({ estado }: { estado: EstadoWompiEvento }) {
  const cfg = ESTADO_CONFIG[estado];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function EventoRow({ ev, onReintentar, isPending }: { ev: WompiEvento; onReintentar: () => void; isPending: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr
        className="border-b border-border hover:bg-muted/30 cursor-pointer"
        onClick={() => setOpen(o => !o)}
      >
        <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{ev.id}</td>
        <td className="px-4 py-3"><EstadoBadge estado={ev.estado} /></td>
        <td className="px-4 py-3 text-sm">
          {ev.empresa_id ? (
            <Link
              to={`/admin/empresas/${ev.empresa_id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-primary hover:text-primary-600 font-medium"
            >
              {ev.empresa_nombre ?? `Empresa #${ev.empresa_id}`}
            </Link>
          ) : '—'}
        </td>
        <td className="px-4 py-3 text-sm font-mono truncate max-w-[160px]" title={ev.transaction_id}>{ev.transaction_id}</td>
        <td className="px-4 py-3 text-sm">{ev.referencia ?? '—'}</td>
        <td className="px-4 py-3 text-sm text-center">{ev.intentos}</td>
        <td className="px-4 py-3 text-sm text-muted-foreground">{fmtDate(ev.created_at)}</td>
        <td className="px-4 py-3 text-sm text-muted-foreground">{fmtDate(ev.procesado_at)}</td>
        <td className="px-4 py-3 text-right">
          {ev.estado === 'error' && (
            <button
              onClick={(e) => { e.stopPropagation(); onReintentar(); }}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
            >
              <RefreshCw size={12} className={isPending ? 'animate-spin' : ''} />
              Reintentar
            </button>
          )}
        </td>
      </tr>
      {open && ev.error_detalle && (
        <tr className="border-b border-border bg-danger-light/30">
          <td colSpan={9} className="px-4 py-2">
            <p className="text-xs font-mono text-danger">{ev.error_detalle}</p>
          </td>
        </tr>
      )}
    </>
  );
}

const ESTADOS: Array<{ value: EstadoWompiEvento | ''; label: string }> = [
  { value: '', label: 'Todos' },
  { value: 'error', label: 'Error' },
  { value: 'rechazado', label: 'Rechazado' },
  { value: 'procesado', label: 'Procesado' },
  { value: 'ignorado', label: 'Ignorado' },
  { value: 'recibido', label: 'Recibido' },
];

export function WompiEventosPage() {
  const [estado, setEstado] = useState<EstadoWompiEvento | ''>('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useWompiEventos({ estado: estado || undefined, page });
  const reintentar = useReintentarWompiEvento();

  const eventos: WompiEvento[] = data?.data?.data ?? [];
  const total: number = data?.data?.total ?? 0;
  const pages: number = data?.data?.pages ?? 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Eventos Wompi</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} evento(s) en total</p>
        </div>
        <div className="flex gap-2">
          {ESTADOS.map(e => (
            <button
              key={e.value}
              onClick={() => { setEstado(e.value); setPage(1); }}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                estado === e.value
                  ? 'bg-primary text-white border-primary'
                  : 'border-border text-muted-foreground hover:border-foreground'
              }`}
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">ID</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Empresa</th>
              <th className="px-4 py-3 text-left">Transaction ID</th>
              <th className="px-4 py-3 text-left">Referencia</th>
              <th className="px-4 py-3 text-center">Intentos</th>
              <th className="px-4 py-3 text-left">Recibido</th>
              <th className="px-4 py-3 text-left">Procesado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Cargando...</td></tr>
            ) : eventos.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Sin eventos</td></tr>
            ) : (
              eventos.map(ev => (
                <EventoRow
                  key={ev.id}
                  ev={ev}
                  onReintentar={() => reintentar.mutate(ev.id)}
                  isPending={reintentar.isPending}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm rounded-lg border border-border disabled:opacity-40 hover:bg-muted"
          >
            Anterior
          </button>
          <span className="px-3 py-1.5 text-sm text-muted-foreground">
            {page} / {pages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(pages, p + 1))}
            disabled={page === pages}
            className="px-3 py-1.5 text-sm rounded-lg border border-border disabled:opacity-40 hover:bg-muted"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}