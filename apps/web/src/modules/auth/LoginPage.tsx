import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router';
import axios from 'axios';
import { Calendar } from 'lucide-react';
import { useAuthStore } from './authStore';
import type { Rol } from './authStore';
import { homeForRol } from './roleHome';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});
type Form = z.infer<typeof schema>;

// ponytail: este panel web solo soporta roles de gestión — los roles de trabajador
// (trabajador_turnos, trabajador_nomina) usan la app móvil. Upgrade path: si algún día
// el backend agrega más roles de gestión, sumarlos aquí.
const ROLES_WEB: Rol[] = ['super_admin', 'admin_empresa', 'jefe_nomina', 'jefe_turnos', 'nomina'];

interface LoginResponse {
  data: {
    access_token: string;
    refresh_token: string;
    usuario: { id: number; nombre: string; email: string; rol: string; empresa_id: number };
  };
}

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore(s => s.login);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: Form) => {
    try {
      const res = await axios.post<LoginResponse>(
        `${import.meta.env.VITE_API_URL}/auth/login`,
        data
      );
      const { access_token, refresh_token, usuario } = res.data.data;
      if (!ROLES_WEB.includes(usuario.rol as Rol)) {
        setError('root', { message: 'Esta cuenta es de trabajador. Inicia sesión desde la app móvil de Zaturno.' });
        return;
      }
      const rol = usuario.rol as Rol;
      login({ ...usuario, rol }, access_token, refresh_token);
      navigate(homeForRol(rol), { replace: true });
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.message as string | undefined) ?? 'Error al iniciar sesión'
        : 'Error inesperado';
      setError('root', { message: msg });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-3 shadow-lg shadow-primary/30">
            <Calendar size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Zaturno</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Panel de administración</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
              <input
                {...register('email')}
                type="email"
                autoComplete="email"
                className="w-full border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                placeholder="tu@empresa.com"
              />
              {errors.email && <p className="text-danger text-xs mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Contraseña</label>
              <input
                {...register('password')}
                type="password"
                autoComplete="current-password"
                className="w-full border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors"
                placeholder="••••••••"
              />
              {errors.password && <p className="text-danger text-xs mt-1">{errors.password.message}</p>}
            </div>
            {errors.root && (
              <p className="bg-danger-light border border-danger/20 text-danger rounded-xl px-3.5 py-2.5 text-sm">
                {errors.root.message}
              </p>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors shadow-sm shadow-primary/25 mt-1"
            >
              {isSubmitting ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
