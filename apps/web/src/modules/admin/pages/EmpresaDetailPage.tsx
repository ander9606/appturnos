import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Building2, Users, Briefcase, Calendar, DollarSign, ToggleLeft, ToggleRight } from 'lucide-react';
import { useEmpresa, useCambiarEstadoEmpresa } from '../hooks/useAdmin';
import type { Plan } from '../types';

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
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' }).format(new Date(s));
}

export function EmpresaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useEmpresa(Number(id));
  const empresa = data?.data;
  const cambiarEstado = useCambiarEstadoEmpresa();

  if (isLoading) return <p className="text-muted-foreground text-sm py-12 text-center">Cargando...</p>;
  if (!empresa) return <p className="text-muted-foreground text-sm py-12 text-center">Empresa no encontrada</p>;

  const activo = Boolean(empresa.activo);

  return (
    <div>
      <button
        onClick={() => navigate('/admin/empresas')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft size={16} /> Volver
      </button>

      {/* Header */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
              <Building2 size={22} className="text-primary-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-foreground">{empresa.nombre}</h1>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_BADGE[empresa.plan]}`}>
                  {PLAN_LABEL[empresa.plan]}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${activo ? 'bg-success-light text-success' : 'bg-muted text-muted-foreground'}`}>
                  {activo ? 'Activa' : 'Inactiva'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground font-mono">{empresa.slug}</p>
              {empresa.descripcion && <p className="text-sm text-muted-foreground mt-1">{empresa.descripcion}</p>}
            </div>
          </div>
          <button
            onClick={() => cambiarEstado.mutate({ id: empresa.id, activo: !activo })}
            disabled={cambiarEstado.isPending}
            className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl border transition-colors disabled:opacity-50 ${
              activo
                ? 'border-danger/30 text-danger hover:bg-danger-light'
                : 'border-success/30 text-success hover:bg-success-light'
            }`}
          >
            {activo ? <><ToggleRight size={16} /> Desactivar</> : <><ToggleLeft size={16} /> Activar</>}
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <MetricCard icon={Briefcase} label="Trabajadores" value={empresa.total_trabajadores} />
        <MetricCard icon={Users} label="Usuarios gestores" value={empresa.total_usuarios} />
        <MetricCard icon={Calendar} label="Ofertas de turno" value={empresa.total_ofertas ?? 0} />
        <MetricCard icon={DollarSign} label="Períodos nómina" value={empresa.total_periodos ?? 0} />
      </div>

      {/* Info */}
      <div className="bg-card border border-border rounded-2xl p-5 max-w-lg">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">Datos de la empresa</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <InfoRow label="Nombre" value={empresa.nombre} />
          <InfoRow label="Slug" value={empresa.slug} mono />
          <InfoRow label="NIT" value={empresa.nit ?? '—'} />
          <InfoRow label="Ciudad" value={empresa.ciudad ?? '—'} />
          <InfoRow label="Plan" value={PLAN_LABEL[empresa.plan]} />
          <InfoRow label="Alta" value={fmtDate(empresa.created_at)} />
          <InfoRow
            label="Acepta postulaciones"
            value={empresa.acepta_postulaciones ? 'Sí' : 'No'}
          />
        </dl>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string; value: number;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center mb-3">
        <Icon size={16} className="text-muted-foreground" />
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`font-medium text-foreground ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </>
  );
}
