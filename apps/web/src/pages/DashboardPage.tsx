import { LayoutDashboard } from 'lucide-react';
import { useAuthStore } from '@/modules/auth/authStore';

export function DashboardPage() {
  const usuario = useAuthStore(s => s.usuario);
  return (
    <div>
      <div className="bg-primary rounded-2xl px-6 py-5 mb-6 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
          <LayoutDashboard size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Bienvenido, {usuario?.nombre}</h1>
          <p className="text-white/70 text-sm">Panel de administración · AppTurnos</p>
        </div>
      </div>
    </div>
  );
}
