import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { Calendar, Briefcase } from 'lucide-react';
import { useAuthStore } from '@/modules/auth/authStore';
import type { Rol } from '@/modules/auth/authStore';

const schema = z.object({
  nombre_empresa: z.string().min(2, 'Nombre de empresa requerido'),
  nit:            z.string().optional(),
  nombre:         z.string().min(2, 'Tu nombre es requerido'),
  apellido:       z.string().optional(),
  email:          z.string().email('Email inválido'),
  password:       z.string().min(8, 'Mínimo 8 caracteres'),
  confirmar:      z.string(),
}).refine(d => d.password === d.confirmar, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmar'],
});

type Form = z.infer<typeof schema>;

interface RegistroResponse {
  data: {
    access_token: string;
    refresh_token: string;
    usuario: { id: number; nombre: string; email: string; rol: Rol; empresa_id: number };
  };
}

const INPUT = 'w-full border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors';

export function RegistroEmpresaPage() {
  const navigate = useNavigate();
  const login = useAuthStore(s => s.login);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: Form) => {
    setServerError(null);
    try {
      const res = await axios.post<RegistroResponse>(
        `${import.meta.env.VITE_API_URL}/auth/registro-empresa`,
        { nombre_empresa: data.nombre_empresa, nit: data.nit || undefined, nombre: data.nombre, apellido: data.apellido || undefined, email: data.email, password: data.password }
      );
      const { access_token, refresh_token, usuario } = res.data.data;
      login(usuario, access_token, refresh_token);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.message as string | undefined) ?? 'Error al registrar'
        : 'Error inesperado';
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setError('email', { message: msg });
      } else {
        setServerError(msg);
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-sm shadow-primary/30">
          <Calendar size={20} className="text-white" />
        </div>
        <span className="font-bold text-foreground text-lg">AppTurnos</span>
      </div>

      <div className="w-full max-w-lg bg-card border border-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
            <Briefcase size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Registra tu empresa</h1>
            <p className="text-sm text-muted-foreground">Crea tu cuenta de administrador</p>
          </div>
        </div>

        {serverError && (
          <div className="mb-4 bg-danger-light border border-danger/20 text-danger rounded-xl px-4 py-3 text-sm">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {/* Empresa */}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Datos de la empresa</p>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Nombre de la empresa *</label>
            <input {...register('nombre_empresa')} type="text" placeholder="Ej. Eventos Horizonte S.A.S" className={INPUT} />
            {errors.nombre_empresa && <p className="text-danger text-xs mt-1">{errors.nombre_empresa.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">NIT (opcional)</label>
            <input {...register('nit')} type="text" placeholder="900.123.456-7" className={INPUT} />
          </div>

          {/* Admin */}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-1">Tu cuenta de administrador</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Nombre *</label>
              <input {...register('nombre')} type="text" placeholder="Juan" className={INPUT} />
              {errors.nombre && <p className="text-danger text-xs mt-1">{errors.nombre.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Apellido</label>
              <input {...register('apellido')} type="text" placeholder="Pérez" className={INPUT} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Email *</label>
            <input {...register('email')} type="email" placeholder="admin@tuempresa.com" className={INPUT} />
            {errors.email && <p className="text-danger text-xs mt-1">{errors.email.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Contraseña *</label>
              <input {...register('password')} type="password" placeholder="••••••••" className={INPUT} />
              {errors.password && <p className="text-danger text-xs mt-1">{errors.password.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Confirmar *</label>
              <input {...register('confirmar')} type="password" placeholder="••••••••" className={INPUT} />
              {errors.confirmar && <p className="text-danger text-xs mt-1">{errors.confirmar.message}</p>}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-primary hover:bg-primary-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors shadow-sm shadow-primary/25 mt-1"
          >
            {isSubmitting ? 'Creando empresa...' : 'Crear empresa'}
          </button>

          <p className="text-center text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{' '}
            <button type="button" onClick={() => navigate('/login')} className="font-semibold text-primary hover:text-primary-600 transition-colors">
              Iniciar sesión
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
