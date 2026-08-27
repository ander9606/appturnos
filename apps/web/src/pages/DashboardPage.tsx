import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard, Users, Calendar, DollarSign, Clock, ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/modules/auth/authStore';
import { equipoApi } from '@/modules/equipo/api/equipoApi';
import { turnosApi } from '@/modules/turnos/api/turnosApi';
import { nominaApi } from '@/modules/nomina/api/nominaApi';
import type { Rol } from '@/modules/auth/authStore';
import type { LiquidacionTurnosTrabajador } from '@/modules/turnos/types';
import { StatCard } from '@/shared/components/StatCard';
import { ErrorState } from '@/shared/components/ErrorState';
import { fmtDate, fmtCOP, bogotaToday, inicioMesActual } from '@/shared/lib/format';

function fmtTime(s: string) {
  return s.slice(0, 5);
}

const ESTADO_BADGE: Record<string, string> = {
  abierta: 'bg-primary-100 text-primary-600',
  publicada: 'bg-primary-100 text-primary-600',
  en_proceso: 'bg-warning-light text-warning',
};

export function DashboardPage() {
  const navigate = useNavigate();
  const usuario = useAuthStore(s => s.usuario);
  const rol = usuario?.rol as Rol;

  const showTurnos = rol === 'admin_empresa' || rol === 'jefe_turnos';
  const showNomina = rol === 'admin_empresa' || rol === 'jefe_nomina' || rol === 'nomina';
  const showEquipo = rol === 'admin_empresa' || rol === 'jefe_turnos' || rol === 'jefe_nomina';

  const trabajadoresQ = useQuery({
    queryKey: ['trabajadores', { activo: true, dashboard: true }],
    queryFn: () => equipoApi.listar({ activo: true, limit: 1 }),
    enabled: showEquipo,
    staleTime: 60_000,
  });
  const { data: trabajadoresData } = trabajadoresQ;

  const ofertasQ = useQuery({
    queryKey: ['turnos', 'ofertas', { dashboard: true }],
    queryFn: () => turnosApi.listarOfertas({ limit: 100 }),
    enabled: showTurnos,
    staleTime: 30_000,
  });
  const { data: ofertasData } = ofertasQ;

  const asigQ = useQuery({
    queryKey: ['turnos', 'asignaciones', { estado: 'pendiente', dashboard: true }],
    queryFn: () => turnosApi.listarAsignaciones({ estado: 'pendiente', limit: 1 }),
    enabled: showTurnos,
    staleTime: 30_000,
  });
  const { data: asigData } = asigQ;

  const periodosQ = useQuery({
    queryKey: ['nomina', 'periodos', 'abierto', 'dashboard'],
    queryFn: () => nominaApi.listarPeriodos({ estado: 'abierto', limit: 5, conTotales: true }),
    enabled: showNomina,
    staleTime: 60_000,
  });
  const { data: periodosData } = periodosQ;

  const liqTurnosQ = useQuery({
    queryKey: ['turnos', 'liquidacion', 'dashboard'],
    queryFn: () => turnosApi.liquidacion({ fecha_inicio: inicioMesActual(), fecha_fin: bogotaToday() }),
    enabled: showTurnos,
    staleTime: 60_000,
  });
  const { data: liqTurnosData } = liqTurnosQ;

  const queries = [trabajadoresQ, ofertasQ, asigQ, periodosQ, liqTurnosQ];
  const isError = queries.some(q => q.isError);
  const firstError = queries.find(q => q.isError)?.error;
  const refetchAll = () => queries.forEach(q => q.refetch());

  const trabajadoresCount = trabajadoresData?.data?.pagination?.total ?? 0;
  const ofertas: Array<{ id: number; titulo: string; fecha: string; hora_inicio: string; estado: string }> =
    ofertasData?.data?.data ?? [];
  const ofertasActivas = ofertas.filter(o => o.estado === 'abierta' || o.estado === 'publicada' || o.estado === 'en_proceso');
  const asigPendientes = asigData?.data?.pagination?.total ?? 0;
  const periodoAbierto = periodosData?.data?.data?.[0] ?? null;
  const debeTurnos = ((liqTurnosData?.data ?? []) as LiquidacionTurnosTrabajador[])
    .reduce((s, t) => s + Number(t.pago_total), 0);

  const hoy = bogotaToday();
  const proximasOrdenadas = ofertasActivas
    .filter(o => o.fecha >= hoy)
    .sort((a, b) => (a.fecha === b.fecha ? a.hora_inicio.localeCompare(b.hora_inicio) : a.fecha.localeCompare(b.fecha)));
  const proximoTurno = proximasOrdenadas[0] ?? null;
  const proximas = proximasOrdenadas.slice(0, 5);

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

      {isError ? (
        <ErrorState error={firstError} onRetry={refetchAll} />
      ) : (
      <>
      {/* Cuánto se debe — lo primero que el jefe necesita ver */}
      {(showNomina || showTurnos) && (
        <div className={`grid gap-4 mb-4 ${showNomina && showTurnos ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {showNomina && (
            <StatCard
              label="Debes a Nómina"
              value={periodoAbierto ? fmtCOP(periodoAbierto.total_estimado ?? 0) : 'Sin período abierto'}
              valueSmall={!periodoAbierto}
              icon={DollarSign}
              color="success"
              onClick={() => navigate('/nomina')}
            />
          )}
          {showTurnos && (
            <StatCard
              label="Debes a Turnos (mes en curso)"
              value={fmtCOP(debeTurnos)}
              icon={DollarSign}
              onClick={() => navigate('/turnos')}
            />
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
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
            <StatCard
              label="Próximo turno"
              value={proximoTurno ? `${proximoTurno.titulo} · ${fmtDate(proximoTurno.fecha)} ${fmtTime(proximoTurno.hora_inicio)}` : 'Ninguno'}
              valueSmall
              icon={Calendar}
              onClick={() => proximoTurno ? navigate(`/turnos/${proximoTurno.id}`) : navigate('/turnos')}
            />
          </>
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
                  {o.estado === 'en_proceso' ? 'En progreso' : o.estado === 'abierta' ? 'Abierta' : 'Publicada'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      </>
      )}
    </div>
  );
}
