import { NavLink, useNavigate } from 'react-router';
import { LayoutDashboard, Users, Calendar, Settings, DollarSign, LogOut } from 'lucide-react';
import { useAuthStore } from '@/modules/auth/authStore';
import type { Rol } from '@/modules/auth/authStore';

type NavItem = {
  label: string;
  to: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

const NAV_BY_ROL: Record<Rol, NavItem[]> = {
  admin_empresa: [
    { label: 'Inicio',         to: '/',              icon: LayoutDashboard },
    { label: 'Nómina',         to: '/nomina',         icon: DollarSign },
    { label: 'Equipo',         to: '/equipo',         icon: Users },
    { label: 'Turnos',         to: '/turnos',         icon: Calendar },
    { label: 'Configuración',  to: '/configuracion',  icon: Settings },
  ],
  jefe_nomina: [
    { label: 'Inicio',  to: '/',       icon: LayoutDashboard },
    { label: 'Nómina',  to: '/nomina', icon: DollarSign },
    { label: 'Equipo',  to: '/equipo', icon: Users },
  ],
  jefe_turnos: [
    { label: 'Inicio',        to: '/',             icon: LayoutDashboard },
    { label: 'Turnos',        to: '/turnos',        icon: Calendar },
    { label: 'Equipo',        to: '/equipo',        icon: Users },
    { label: 'Configuración', to: '/configuracion', icon: Settings },
  ],
  nomina: [
    { label: 'Inicio',  to: '/',       icon: LayoutDashboard },
    { label: 'Nómina',  to: '/nomina', icon: DollarSign },
  ],
};

const ROL_LABEL: Record<Rol, string> = {
  admin_empresa: 'Administrador',
  jefe_nomina:   'Jefe Nómina',
  jefe_turnos:   'Jefe Turnos',
  nomina:        'Nómina',
};

export function Sidebar() {
  const { usuario, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const items = usuario ? (NAV_BY_ROL[usuario.rol] ?? []) : [];

  const logout = () => {
    clearAuth();
    navigate('/login', { replace: true });
  };

  const initials = usuario
    ? usuario.nombre.split(' ').map((w: string) => w.charAt(0)).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <aside className="w-60 flex flex-col bg-card border-r border-border">
      {/* Brand header */}
      <div className="px-5 pt-5 pb-4 bg-primary rounded-br-3xl mb-2">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
            <Calendar size={16} className="text-white" />
          </div>
          <span className="font-bold text-white text-base tracking-tight">AppTurnos</span>
        </div>
        {usuario && (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/25 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">{initials}</span>
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate">{usuario.nombre}</p>
              <p className="text-white/60 text-xs">{ROL_LABEL[usuario.rol]}</p>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 flex flex-col gap-0.5">
        {items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-primary-50 text-primary-600'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                  isActive ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                }`}>
                  <item.icon size={14} />
                </div>
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 pb-4">
        <div className="border-t border-border mb-3" />
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-danger-light hover:text-danger transition-all"
        >
          <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
            <LogOut size={14} />
          </div>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
