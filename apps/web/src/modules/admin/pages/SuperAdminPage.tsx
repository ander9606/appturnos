import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Building2, Users, Briefcase, Calendar, DollarSign,
  Plus, Search, ToggleLeft, ToggleRight, ChevronRight, Webhook, Link2,
} from 'lucide-react';
import { useReportesGlobales, useEmpresas, useCrearEmpresa, useCambiarEstadoEmpresa } from '../hooks/useAdmin';
import type { EmpresaAdmin, Plan } from '../types';
import { ErrorState } from '@/shared/components/ErrorState';

const PLAN_BADGE: Record<Plan, string> = {
  basico: 'bg-muted text-muted-foreground',
  profesional: 'bg-primary-100 text-primary-600',
  empresarial: 'bg-warning-light text-warning',
};

const PLAN_LABEL: Record<Plan, string> = {
  basico: 'Básico',
  profesional: 'Profesional',
  empresarial: 'Empresarial',
};

function fmtDate(s: string) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'short' }).format(new Date(s));
}

export function SuperAdminPage() {
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState('');
  const [planFiltro, setPlanFiltro] = useState<Plan | undefined>(undefined);
  const [activoFiltro, setActivoFiltro] = useState<boolean | undefined>(undefined);
  const [showCrear, setShowCrear] = useState(false);

  const { data: reportesData } = useReportesGlobales();
  const reportes = reportesData?.data;

  const { data: empresasData, isLoading, isError, error, refetch } = useEmpresas({
    busqueda: busqueda || undefined,
    plan: planFiltro,
    activo: activoFiltro,
  });
  const empresas: EmpresaAdmin[] = empresasData?.data ?? [];
  const total: number = empresasData?.total ?? 0;

  const cambiarEstado = useCambiarEstadoEmpresa();

  return (
    <div className="flex gap-6 h-full">

      {/* LEFT: KPIs */}
      <div className="w-64 flex-shrink-0 flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Panel global</h1>
          <p className="text-sm text-muted-foreground">Zaturno · super admin</p>
          <button
            onClick={() => navigate('/admin/wompi-eventos')}
            className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Webhook size={13} />
            Eventos Wompi
          </button>
        </div>

        {reportes && (
          <>
            <KpiCard
              icon={Building2}
              label="Empresas activas"
              value={reportes.empresas.activas}
              sub={`${reportes.empresas.total} en total · ${reportes.empresas.inactivas} inactivas`}
              color="primary"
            />
            <KpiCard
              icon={Users}
              label="Usuarios gestores"
              value={reportes.usuarios.total}
              color="default"
            />
            <KpiCard
              icon={Briefcase}
              label="Trabajadores activos"
              value={reportes.trabajadores.activos}
              sub={`${reportes.trabajadores.total} registrados`}
              color="default"
            />
            <KpiCard
              icon={Calendar}
              label="Turnos (últimos 30d)"
              value={reportes.turnos.ultimo_mes}
              color="default"
            />
            <KpiCard
              icon={DollarSign}
              label="Períodos nómina abiertos"
              value={reportes.nomina.periodos_abiertos}
              color={reportes.nomina.periodos_abiertos > 0 ? 'warning' : 'default'}
            />

            {/* Plan distribution */}
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground uppercase font-medium mb-3">Distribución de planes</p>
              {(['basico', 'profesional', 'empresarial'] as Plan[]).map(plan => {
                const count = reportes.distribucion_planes[plan] ?? 0;
                const pct = reportes.empresas.total > 0
                  ? Math.round((count / reportes.empresas.total) * 100)
                  : 0;
                return (
                  <div key={plan} className="mb-2.5">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{PLAN_LABEL[plan]}</span>
                      <span className="font-medium text-foreground">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* RIGHT: Companies list */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar empresa, slug, NIT..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <select
            value={planFiltro ?? ''}
            onChange={e => setPlanFiltro((e.target.value as Plan) || undefined)}
            className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">Todos los planes</option>
            <option value="basico">Básico</option>
            <option value="profesional">Profesional</option>
            <option value="empresarial">Empresarial</option>
          </select>
          <select
            value={activoFiltro === undefined ? '' : String(activoFiltro)}
            onChange={e => setActivoFiltro(e.target.value === '' ? undefined : e.target.value === 'true')}
            className="border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">Todas</option>
            <option value="true">Activas</option>
            <option value="false">Inactivas</option>
          </select>
          <button
            onClick={() => setShowCrear(true)}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary-600 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus size={16} /> Nueva empresa
          </button>
        </div>

        <p className="text-xs text-muted-foreground -mt-1">{total} empresa{total !== 1 ? 's' : ''}</p>

        {isLoading ? (
          <p className="text-muted-foreground text-sm py-8 text-center">Cargando...</p>
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : empresas.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">Sin resultados</p>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden flex-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted text-muted-foreground text-xs uppercase">
                  <th className="text-left px-4 py-3 font-medium">Empresa</th>
                  <th className="text-left px-4 py-3 font-medium">Plan</th>
                  <th className="text-right px-4 py-3 font-medium">Trabajadores</th>
                  <th className="text-right px-4 py-3 font-medium">Usuarios</th>
                  <th className="text-left px-4 py-3 font-medium">Alta</th>
                  <th className="text-left px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {empresas.map(e => (
                  <tr key={e.id} className="border-t border-border/60 hover:bg-muted transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{e.nombre}</p>
                      <p className="text-xs text-muted-foreground">{e.slug}{e.nit ? ` · ${e.nit}` : ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_BADGE[e.plan]}`}>
                        {PLAN_LABEL[e.plan]}
                      </span>
                      {e.logiq360_conectado && (
                        <span
                          className="inline-block ml-1.5 align-text-bottom"
                          title="Conectada a logiq360 — no paga suscripción"
                        >
                          <Link2 size={13} className="text-success" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{e.total_trabajadores}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{e.total_usuarios}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(e.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        e.activo ? 'bg-success-light text-success' : 'bg-muted text-muted-foreground'
                      }`}>
                        {e.activo ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => {
                            const msg = e.activo
                              ? `¿Desactivar ${e.nombre}? Todos sus usuarios y trabajadores perderán acceso.`
                              : `¿Activar ${e.nombre}?`;
                            if (window.confirm(msg)) cambiarEstado.mutate({ id: e.id, activo: !e.activo });
                          }}
                          disabled={cambiarEstado.isPending}
                          className="text-muted-foreground/50 hover:text-primary transition-colors disabled:opacity-50"
                          title={e.activo ? 'Desactivar' : 'Activar'}
                        >
                          {e.activo
                            ? <ToggleRight size={20} className="text-success" />
                            : <ToggleLeft size={20} />
                          }
                        </button>
                        <button
                          onClick={() => navigate(`/admin/empresas/${e.id}`)}
                          className="flex items-center gap-1 text-xs text-primary hover:text-primary-600 font-medium px-2 py-1 rounded-lg hover:bg-primary-50 transition-colors"
                        >
                          Ver <ChevronRight size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCrear && <CrearEmpresaModal onClose={() => setShowCrear(false)} />}
    </div>
  );
}

/* ── KPI Card ── */
type KpiColor = 'primary' | 'warning' | 'default';

function KpiCard({ icon: Icon, label, value, sub, color = 'default' }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string; value: number; sub?: string; color?: KpiColor;
}) {
  const iconCls: Record<KpiColor, string> = {
    primary: 'bg-primary-50 text-primary-600',
    warning: 'bg-warning-light text-warning',
    default: 'bg-muted text-muted-foreground',
  };
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-start justify-between mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconCls[color]}`}>
          <Icon size={16} />
        </div>
        <span className="text-2xl font-bold text-foreground">{value}</span>
      </div>
      <p className="text-xs font-medium text-foreground">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

/* ── Crear empresa modal ── */
function CrearEmpresaModal({ onClose }: { onClose: () => void }) {
  const crear = useCrearEmpresa();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nombre: '', slug: '', nit: '', ciudad: '', plan: 'basico' as Plan, descripcion: '',
  });

  const slugify = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await crear.mutateAsync({
      nombre: form.nombre,
      slug: form.slug,
      nit: form.nit || undefined,
      ciudad: form.ciudad || undefined,
      plan: form.plan,
      descripcion: form.descripcion || undefined,
    });
    onClose();
    if (res?.data?.id) navigate(`/admin/empresas/${res.data.id as number}`);
  };

  const f = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const val = e.target.value;
      setForm(prev => ({
        ...prev,
        [key]: val,
        ...(key === 'nombre' && !prev.slug ? { slug: slugify(val) } : {}),
      }));
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold text-foreground mb-4">Nueva empresa</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Nombre *</label>
            <input required type="text" {...f('nombre')} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Slug * <span className="text-muted-foreground font-normal">(solo a-z, 0-9, guiones)</span></label>
            <input required type="text" pattern="[a-z0-9-]+" {...f('slug')} className="w-full border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">NIT</label>
              <input type="text" {...f('nit')} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Ciudad</label>
              <input type="text" {...f('ciudad')} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Plan</label>
            <select {...f('plan')} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
              <option value="basico">Básico</option>
              <option value="profesional">Profesional</option>
              <option value="empresarial">Empresarial</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Descripción</label>
            <textarea rows={2} {...f('descripcion')} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-border hover:bg-muted text-sm font-medium py-2 rounded-lg transition-colors">Cancelar</button>
            <button type="submit" disabled={crear.isPending} className="flex-1 bg-primary hover:bg-primary-600 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors">
              {crear.isPending ? 'Creando...' : 'Crear empresa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
