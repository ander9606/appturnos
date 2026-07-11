import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Building2, Users, Briefcase, Calendar, DollarSign, ToggleLeft, ToggleRight, Copy, Check, CreditCard, Zap } from 'lucide-react';
import { useEmpresa, useCambiarEstadoEmpresa, useGestionarSuscripcion, useGenerarLinkPago } from '../hooks/useAdmin';
import type { Plan, OrigenSuscripcion } from '../types';

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

const ORIGEN_BADGE: Record<OrigenSuscripcion, string> = {
  manual:   'bg-muted text-muted-foreground',
  wompi:    'bg-primary-100 text-primary-600',
  logiq360: 'bg-success-light text-success',
};

// Precio único mensual (COP) para empresas sin integración logiq360 activa —
// ver backend/config/constants.js PRECIO_MENSUAL_COP. El plan ya no afecta el precio,
// solo límites de features (max_trabajadores).
const PRECIO_MENSUAL_COP = 129000;

function fmtDate(s: string) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' }).format(new Date(s));
}

function fmtCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

function suscripcionActiva(vigente_hasta: string | null): boolean {
  if (vigente_hasta === null) return true;
  return new Date(vigente_hasta) >= new Date();
}

export function EmpresaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const empresaId = Number(id);

  const { data, isLoading } = useEmpresa(empresaId);
  const empresa = data?.data;

  const cambiarEstado      = useCambiarEstadoEmpresa();
  const gestionarSusc      = useGestionarSuscripcion(empresaId);
  const generarLink        = useGenerarLinkPago(empresaId);

  // Link de pago
  const [linkPlan, setLinkPlan]   = useState<Plan>('basico');
  const [linkMeses, setLinkMeses] = useState(1);
  const [linkUrl, setLinkUrl]     = useState('');
  const [copied, setCopied]       = useState(false);

  // Activación manual
  const [manualPlan,  setManualPlan]  = useState<Plan>('basico');
  const [manualFecha, setManualFecha] = useState('');

  if (isLoading) return <p className="text-muted-foreground text-sm py-12 text-center">Cargando...</p>;
  if (!empresa)  return <p className="text-muted-foreground text-sm py-12 text-center">Empresa no encontrada</p>;

  const activo  = Boolean(empresa.activo);
  const activa  = suscripcionActiva(empresa.suscripcion_vigente_hasta);

  async function handleGenerarLink() {
    const res = await generarLink.mutateAsync({ plan: linkPlan, meses: linkMeses });
    setLinkUrl(res.data?.url ?? '');
  }

  function handleCopiar() {
    navigator.clipboard.writeText(linkUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleActivarManual() {
    gestionarSusc.mutate({
      plan: manualPlan,
      vigente_hasta: manualFecha || null,
      origen: 'manual',
    });
  }

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
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PLAN_BADGE[empresa.plan as Plan]}`}>
                  {PLAN_LABEL[empresa.plan as Plan]}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${activo ? 'bg-success-light text-success' : 'bg-muted text-muted-foreground'}`}>
                  {activo ? 'Activa' : 'Inactiva'}
                </span>
                {empresa.logiq360_conectado && (
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-medium bg-success-light text-success"
                    title="Integración activa con logiq360 — no paga suscripción"
                  >
                    Conectada a logiq360
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground font-mono">{empresa.slug}</p>
              {empresa.descripcion && <p className="text-sm text-muted-foreground mt-1">{empresa.descripcion}</p>}
            </div>
          </div>
          <button
            onClick={() => {
              const msg = activo
                ? `¿Desactivar ${empresa.nombre}? Todos sus usuarios y trabajadores perderán acceso.`
                : `¿Activar ${empresa.nombre}?`;
              if (window.confirm(msg)) cambiarEstado.mutate({ id: empresa.id, activo: !activo });
            }}
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
        <MetricCard icon={Briefcase} label="Trabajadores"     value={empresa.total_trabajadores} />
        <MetricCard icon={Users}     label="Usuarios gestores" value={empresa.total_usuarios} />
        <MetricCard icon={Calendar}  label="Ofertas de turno"  value={empresa.total_ofertas ?? 0} />
        <MetricCard icon={DollarSign} label="Períodos nómina"  value={empresa.total_periodos ?? 0} />
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Info */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">Datos de la empresa</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <InfoRow label="Nombre" value={empresa.nombre} />
            <InfoRow label="Slug"   value={empresa.slug} mono />
            <InfoRow label="NIT"    value={empresa.nit ?? '—'} />
            <InfoRow label="Ciudad" value={empresa.ciudad ?? '—'} />
            <InfoRow label="Plan"   value={PLAN_LABEL[empresa.plan as Plan]} />
            <InfoRow label="Alta"   value={fmtDate(empresa.created_at)} />
            <InfoRow label="Acepta postulaciones" value={empresa.acepta_postulaciones ? 'Sí' : 'No'} />
          </dl>
        </div>

        {/* Suscripción — estado actual */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">Suscripción</h2>
          <div className="flex items-center gap-2 mb-4">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${activa ? 'bg-success-light text-success' : 'bg-danger-light text-danger'}`}>
              {activa ? 'Activa' : 'Vencida'}
            </span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${ORIGEN_BADGE[empresa.suscripcion_origen ?? 'manual']}`}>
              {empresa.suscripcion_origen ?? 'manual'}
            </span>
          </div>
          {empresa.logiq360_conectado && (
            <p className="text-xs text-muted-foreground mb-3">
              Gratis por integración activa con logiq360 — no depende de "Vence" abajo.
            </p>
          )}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm mb-0">
            <InfoRow label="Plan"  value={PLAN_LABEL[empresa.plan as Plan]} />
            <InfoRow
              label="Vence"
              value={empresa.suscripcion_vigente_hasta ? fmtDate(empresa.suscripcion_vigente_hasta) : 'Indefinido'}
            />
          </dl>
        </div>
      </div>

      {/* Acciones de suscripción */}
      <div className="grid grid-cols-2 gap-6">
        {/* Generar link de pago */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard size={16} className="text-primary-600" />
            <h2 className="text-sm font-semibold text-foreground">Generar link de pago</h2>
          </div>

          <div className="flex gap-3 mb-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Plan</label>
              <select
                value={linkPlan}
                onChange={e => { setLinkPlan(e.target.value as Plan); setLinkUrl(''); }}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground"
              >
                <option value="basico">Básico — {fmtCOP(PRECIO_MENSUAL_COP)}/mes</option>
                <option value="profesional">Profesional — {fmtCOP(PRECIO_MENSUAL_COP)}/mes</option>
                <option value="empresarial">Empresarial — {fmtCOP(PRECIO_MENSUAL_COP)}/mes</option>
              </select>
            </div>
            <div className="w-24">
              <label className="text-xs text-muted-foreground mb-1 block">Meses</label>
              <select
                value={linkMeses}
                onChange={e => { setLinkMeses(Number(e.target.value)); setLinkUrl(''); }}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground"
              >
                {[1, 3, 6, 12].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mb-3">
            Total: <span className="font-semibold text-foreground">{fmtCOP(PRECIO_MENSUAL_COP * linkMeses)}</span>
          </p>

          {linkUrl ? (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  readOnly
                  value={linkUrl}
                  className="flex-1 text-xs border border-border rounded-lg px-3 py-2 bg-muted font-mono truncate"
                />
                <button
                  onClick={handleCopiar}
                  className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
                >
                  {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                </button>
              </div>
              <button
                onClick={() => setLinkUrl('')}
                className="text-xs text-muted-foreground hover:text-foreground self-start transition-colors"
              >
                Generar nuevo link
              </button>
            </div>
          ) : (
            <button
              onClick={handleGenerarLink}
              disabled={generarLink.isPending}
              className="w-full text-sm font-medium px-4 py-2 rounded-xl bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {generarLink.isPending ? 'Generando...' : 'Generar link'}
            </button>
          )}
        </div>

        {/* Activación manual */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={16} className="text-warning" />
            <h2 className="text-sm font-semibold text-foreground">Activar manualmente</h2>
          </div>

          <div className="flex gap-3 mb-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Plan</label>
              <select
                value={manualPlan}
                onChange={e => setManualPlan(e.target.value as Plan)}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground"
              >
                <option value="basico">Básico</option>
                <option value="profesional">Profesional</option>
                <option value="empresarial">Empresarial</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Vence el (dejar vacío = indefinido)</label>
              <input
                type="date"
                value={manualFecha}
                onChange={e => setManualFecha(e.target.value)}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground"
              />
            </div>
          </div>

          <button
            onClick={handleActivarManual}
            disabled={gestionarSusc.isPending}
            className="w-full text-sm font-medium px-4 py-2 rounded-xl border border-warning/40 text-warning hover:bg-warning-light disabled:opacity-50 transition-colors"
          >
            {gestionarSusc.isPending ? 'Guardando...' : 'Activar suscripción'}
          </button>
        </div>
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