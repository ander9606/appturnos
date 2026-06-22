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
    { label: 'Inicio', to: '/', icon: LayoutDashboard },
    { label: 'Nómina', to: '/nomina', icon: DollarSign },
    { label: 'Equipo', to: '/equipo', icon: Users },
    { label: 'Turnos', to: '/turnos', icon: Calendar },
    { label: 'Configuración', to: '/configuracion', icon: Settings },
  ],
  jefe_nomina: [
    { label: 'Inicio', to: '/', icon: LayoutDashboard },
    { label: 'Nómina', to: '/nomina', icon: DollarSign },
    { label: 'Equipo', to: '/equipo', icon: Users },
  ],
  jefe_turnos: [
    { label: 'Inicio', to: '/', icon: LayoutDashboard },
    { label: 'Turnos', to: '/turnos', icon: Calendar },
    { label: 'Equipo', to: '/equipo', icon: Users },
  ],
  nomina: [
    { label: 'Inicio', to: '/', icon: LayoutDashboard },
    { label: 'Nómina', to: '/nomina', icon: DollarSign },
  ],
};

export function Sidebar() {
  const { usuario, clearAuth } = useAuthStore();
  const navigate = useNavigate();
  const items = usuario ? (NAV_BY_ROL[usuario.rol] ?? []) : [];

  const logout = () => {
    clearAuth();
    navigate('/login', { replace: true });
  };

  return (
    <aside className="w-56 flex flex-col bg-white border-r border-gray-200">
      <div className="px-5 py-4 border-b border-gray-200">
        <span className="font-bold text-gray-900">AppTurnos</span>
        {usuario && <p className="text-xs text-gray-500 mt-0.5 truncate">{usuario.nombre}</p>}
      </div>
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            <item.icon size={16} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-3 pb-4">
        <button
          onClick={logout}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
