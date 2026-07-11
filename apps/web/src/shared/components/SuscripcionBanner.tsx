import { Link, useLocation } from 'react-router';
import { AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/modules/auth/authStore';
import { useSuscripcion } from '@/modules/configuracion/hooks/useConfiguracion';

const DIAS_AVISO = 7;

/** Aviso persistente de vencimiento — solo admin_empresa, único rol que puede renovar. */
export function SuscripcionBanner() {
  const usuario = useAuthStore(s => s.usuario);
  const { pathname } = useLocation();
  const { data } = useSuscripcion(usuario?.rol === 'admin_empresa');
  const s = data?.data;

  if (!s || s.origen === 'logiq360') return null;
  if (pathname === '/configuracion') return null; // ya está viendo el detalle ahí
  if (s.activa && (s.dias_restantes === null || s.dias_restantes > DIAS_AVISO)) return null;

  const vencida = !s.activa;

  return (
    <div className={`flex items-center gap-2 px-4 py-2 text-sm ${vencida ? 'bg-danger-light text-danger' : 'bg-warning-light text-warning'}`}>
      <AlertTriangle size={16} className="flex-shrink-0" />
      <span className="flex-1">
        {vencida
          ? 'Tu suscripción venció — renueva para seguir creando períodos de nómina, turnos y trabajadores nuevos.'
          : `Tu suscripción vence en ${s.dias_restantes} día${s.dias_restantes === 1 ? '' : 's'}.`}
      </span>
      <Link to="/configuracion?tab=plan" className="font-semibold underline hover:no-underline flex-shrink-0">
        Renovar
      </Link>
    </div>
  );
}
