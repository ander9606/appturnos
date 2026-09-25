import { NavLink, useNavigate } from 'react-router';
import { LayoutDashboard, Users, Calendar, CalendarDays, Settings, DollarSign, LogOut, Plug, Building2 } from 'lucide-react';
import { useAuthStore } from '@/modules/auth/authStore';
import type { Rol } from '@/modules/auth/authStore';

type NavItem = {
  label: string;
  to: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  /** Acento del módulo — Nómina usa verde, el resto (Turnos incluido) usa el naranja de marca. Igual que THEME_COLORS en mobile. */
  accent?: 'success';
  /** Ítems de soporte (config, integraciones) van anclados abajo, separados de la navegación principal. */
  bottom?: boolean;
};

const NAV_BY_ROL: Record<Rol, NavItem[]> = {
  super_admin: [
    { label: 'Empresas', to: '/admin/empresas', icon: Building2 },
  ],
  admin_empresa: [
    { label: 'Inicio',         to: '/dashboard',     icon: LayoutDashboard },
    { label: 'Calendario',     to: '/calendario',     icon: CalendarDays },
    { label: 'Turnos',         to: '/turnos',         icon: Calendar },
    { label: 'Nómina',         to: '/nomina',         icon: DollarSign, accent: 'success' },
    { label: 'Equipo',         to: '/equipo',         icon: Users },
    { label: 'Configuración',  to: '/configuracion',  icon: Settings, bottom: true },
    { label: 'logiq360',       to: '/integracion',    icon: Plug, bottom: true },
  ],
  jefe_nomina: [
    { label: 'Inicio',      to: '/dashboard',   icon: LayoutDashboard },
    { label: 'Calendario',  to: '/calendario',  icon: CalendarDays },
    { label: 'Nómina',      to: '/nomina',      icon: DollarSign, accent: 'success' },
    { label: 'Equipo',      to: '/equipo',      icon: Users },
  ],
  jefe_turnos: [
    { label: 'Inicio',        to: '/dashboard',     icon: LayoutDashboard },
    { label: 'Calendario',    to: '/calendario',    icon: CalendarDays },
    { label: 'Turnos',        to: '/turnos',        icon: Calendar },
    { label: 'Equipo',        to: '/equipo',        icon: Users },
    { label: 'Configuración', to: '/configuracion', icon: Settings, bottom: true },
  ],
  nomina: [
    { label: 'Inicio',      to: '/dashboard',  icon: LayoutDashboard },
    { label: 'Calendario',  to: '/calendario', icon: CalendarDays },
    { label: 'Nómina',      to: '/nomina',     icon: DollarSign, accent: 'success' },
  ],
};

const ROL_LABEL: Record<Rol, string> = {
  super_admin:   'Super Admin',
  admin_empresa: 'Administrador',
  jefe_nomina:   'Jefe Nómina',
  jefe_turnos:   'Jefe Turnos',
  nomina:        'Nómina',
};

export function Sidebar() {
  const { usuario, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const items = usuario ? (NAV_BY_ROL[usuario.rol] ?? []) : [];
  const mainItems = items.filter(item => !item.bottom);
  const bottomItems = items.filter(item => item.bottom);

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
          <span className="font-bold text-white text-base tracking-tight">Zaturno</span>
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
        {mainItems.map(item => <NavItemLink key={item.to} item={item} />)}
      </nav>

      {/* Soporte (config, integraciones) — ancladas abajo, separadas de la navegación principal */}
      {bottomItems.length > 0 && (
        <nav className="px-3 py-2 flex flex-col gap-0.5">
          {bottomItems.map(item => <NavItemLink key={item.to} item={item} />)}
        </nav>
      )}

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

function NavItemLink({ item }: { item: NavItem }) {
  const isNomina = item.accent === 'success';
  return (
    <NavLink
      to={item.to}
      end={item.to === '/dashboard'}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
          isActive
            ? isNomina ? 'bg-success-light text-success-600' : 'bg-primary-50 text-primary-600'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
            isActive ? `${isNomina ? 'bg-success' : 'bg-primary'} text-white` : 'bg-muted text-muted-foreground'
          }`}>
            <item.icon size={14} />
          </div>
          {item.label}
        </>
      )}
    </NavLink>
  );
}
