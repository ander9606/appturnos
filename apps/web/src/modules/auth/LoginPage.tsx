import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router';
import axios from 'axios';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from './authStore';
import type { Rol } from './authStore';
import { homeForRol } from './roleHome';
import zaturnoLogo from '@/assets/zaturno-logo.png';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});
type Form = z.infer<typeof schema>;

// ponytail: este panel web solo soporta roles de gestión — los roles de trabajador
// (trabajador_turnos, trabajador_nomina) usan la app móvil. Upgrade path: si algún día
// el backend agrega más roles de gestión, sumarlos aquí.
const ROLES_WEB: Rol[] = ['super_admin', 'admin_empresa', 'jefe_nomina', 'jefe_turnos', 'nomina'];

const INPUT =
  'w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3.5 text-sm text-foreground ' +
  'transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40';

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
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-6">
      <div className="w-full max-w-sm">
        {/* Header de marca */}
        <div
          className="relative overflow-hidden rounded-3xl px-6 pb-16 pt-10 text-center"
          style={{ background: 'linear-gradient(160deg, #FF7150 0%, #FF5A3C 50%, #E83E1F 100%)' }}
        >
          <div className="pointer-events-none absolute -top-14 -right-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-10 -left-8 h-28 w-28 rounded-full bg-white/10" />
          <div className="relative flex flex-col items-center gap-2">
            <img src={zaturnoLogo} alt="" className="h-14 w-14 rounded-2xl shadow-lg shadow-black/20" />
            <h1 className="text-xl font-extrabold tracking-tight text-white">Zaturno</h1>
            <p className="text-xs font-medium text-white/75">Panel de administración</p>
          </div>
        </div>

        {/* Card, superpuesta al header */}
        <div className="relative -mt-10 rounded-2xl border border-border bg-card p-6 shadow-xl shadow-black/[0.04]">
          <h2 className="text-lg font-bold text-foreground">Inicia sesión</h2>
          <p className="mb-5 mt-0.5 text-sm text-muted-foreground">Ingresa tus datos para continuar</p>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  {...register('email')}
                  type="email"
                  autoComplete="email"
                  className={INPUT}
                  placeholder="tu@empresa.com"
                />
              </div>
              {errors.email && <p className="mt-1 text-xs text-danger">{errors.email.message}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Contraseña</label>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className={`${INPUT} pr-10`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-danger">{errors.password.message}</p>}
            </div>

            {errors.root && (
              <p className="rounded-xl border border-danger/20 bg-danger-light px-3.5 py-2.5 text-sm text-danger">
                {errors.root.message}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary/25 transition-colors hover:bg-primary-600 disabled:opacity-50"
            >
              {isSubmitting ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            ¿Eres trabajador? Usa la app móvil de Zaturno.
          </p>
        </div>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          ¿Primera vez con tu empresa?{' '}
          <Link to="/registro" className="font-semibold text-primary hover:underline">
            Regístrala aquí
          </Link>
        </p>
      </div>
    </div>
  );
}
