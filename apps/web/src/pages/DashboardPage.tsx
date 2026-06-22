import { useAuthStore } from '@/modules/auth/authStore';

export function DashboardPage() {
  const usuario = useAuthStore(s => s.usuario);
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Bienvenido, {usuario?.nombre}</h1>
      <p className="text-gray-500 text-sm">Panel de administración · AppTurnos</p>
    </div>
  );
}
