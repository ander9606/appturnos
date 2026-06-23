import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard, Users, Calendar, DollarSign, Clock, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/modules/auth/authStore';
import { equipoApi } from '@/modules/equipo/api/equipoApi';
import { turnosApi } from '@/modules/turnos/api/turnosApi';
import { nominaApi } from '@/modules/nomina/api/nominaApi';
import type { Rol } from '@/modules/auth/authStore';

function fmtDate(s: string) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'short' }).format(new Date(s + 'T00:00:00'));
}

function fmtTime(s: string) {
  return s.slice(0, 5);
}

const ESTADO_BADGE: Record<string, string> = {
  publicada: 'bg-primary-100 text-primary-600',
  en_progreso: 'bg-warning-light text-warning',
};

export function DashboardPage() {
  const navigate = useNavigate();
  const usuario = useAuthStore(s => s.usuario);
  const rol = usuario?.rol as Rol;

  const showTurnos = rol === 'admin_empresa' || rol === 'jefe_turnos';
  const showNomina = rol === 'admin_empresa' || rol === 'jefe_nomina' || rol === 'nomina';
  const showEquipo = rol === 'admin_empresa' || rol === 'jefe_turnos' || rol === 'jefe_nomina';

  const { data: trabajadoresData } = useQuery({
    queryKey: ['trabajadores', { activo: true, dashboard: true }],
    queryFn: () => equipoApi.listar({ activo: true, limit: 200 }),
    enabled: showEquipo,
    staleTime: 60_000,
  });

  const { data: ofertasData } = useQuery({
    queryKey: ['turnos', 'ofertas', { dashboard: true }],
    queryFn: () => turnosApi.listarOfertas({ limit: 100 }),
    enabled: showTurnos,
    staleTime: 30_000,
  });

  const { data: asigData } = useQuery({
    queryKey: ['turnos', 'asignaciones', { estado: 'pendiente', dashboard: true }],
    queryFn: () => turnosApi.listarAsignaciones({ estado: 'pendiente', limit: 100 }),
    enabled: showTurnos,
    staleTime: 30_000,
  });

  const { data: periodosData } = useQuery({
    queryKey: ['nomina', 'periodos', 'abierto', 'dashboard'],
    queryFn: () => nominaApi.listarPeriodos({ estado: 'abierto', limit: 5 }),
    enabled: showNomina,
    staleTime: 60_000,
  });

  const trabajadoresCount = trabajadoresData?.data?.length ?? 0;
  const ofertas: Array<{ id: number; titulo: string; fecha: string; hora_inicio: string; estado: string }> =
    ofertasData?.data ?? [];
  const ofertasActivas = ofertas.filter(o => o.estado === 'publicada' || o.estado === 'en_progreso');
  const asigPendientes = asigData?.data?.length ?? 0;
  const periodoAbierto = periodosData?.data?.[0] ?? null;

  const proximas = ofertasActivas.slice(0, 5);

  return (
    <div>
      {/* Welcome */}
      <div className="bg-primary rounded-2xl px-6 py-5 mb-6 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
          <LayoutDashboard size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Bienvenido, {usuario?.nombre}</h1>
          <p className="text-white/70 text-sm">Panel de administración · Zaturno</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {showEquipo && (
          <StatCard
            label="Trabajadores activos"
            value={trabajadoresCount}
            icon={Users}
            onClick={() => navigate('/equipo')}
          />
        )}
        {showTurnos && (
          <>
            <StatCard
              label="Ofertas activas"
              value={ofertasActivas.length}
              icon={Calendar}
              onClick={() => navigate('/turnos')}
            />
            <StatCard
              label="Asignaciones pendientes"
              value={asigPendientes}
              icon={Clock}
              color="warning"
              onClick={() => navigate('/turnos')}
            />
          </>
        )}
        {showNomina && (
          <StatCard
            label="Período abierto"
            value={
              periodoAbierto
                ? `${fmtDate(periodoAbierto.fecha_inicio)} – ${fmtDate(periodoAbierto.fecha_fin)}`
                : 'Ninguno'
            }
            valueSmall={!periodoAbierto}
            icon={DollarSign}
            color={periodoAbierto ? 'success' : undefined}
            onClick={() => navigate('/nomina')}
          />
        )}
      </div>

      {/* Próximas ofertas */}
      {showTurnos && proximas.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Ofertas activas</h2>
            <button
              onClick={() => navigate('/turnos')}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary-600 font-medium transition-colors"
            >
              Ver todas <ChevronRight size={13} />
            </button>
          </div>
          <ul>
            {proximas.map((o, i) => (
              <li
                key={o.id}
                onClick={() => navigate(`/turnos/${o.id}`)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted transition-colors ${i > 0 ? 'border-t border-border/60' : ''}`}
              >
                <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <Calendar size={14} className="text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{o.titulo}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(o.fecha)} · {fmtTime(o.hora_inicio)}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${ESTADO_BADGE[o.estado]}`}>
                  {o.estado === 'en_progreso' ? 'En progreso' : 'Publicada'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

type StatColor = 'default' | 'warning' | 'success';

function StatCard({
  label, value, icon: Icon, color = 'default', valueSmall, onClick,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color?: StatColor;
  valueSmall?: boolean;
  onClick: () => void;
}) {
  const iconBg: Record<StatColor, string> = {
    default: 'bg-primary-50 text-primary-600',
    warning: 'bg-warning-light text-warning',
    success: 'bg-success-light text-success',
  };

  return (
    <button
      onClick={onClick}
      className="bg-card border border-border rounded-2xl p-4 text-left hover:bg-muted transition-colors w-full"
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${iconBg[color]}`}>
        <Icon size={18} />
      </div>
      <p className={`font-bold text-foreground mb-0.5 ${valueSmall ? 'text-sm' : 'text-2xl'}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </button>
  );
}
