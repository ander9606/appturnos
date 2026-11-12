import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { Calendar, Briefcase } from 'lucide-react';
import { api } from '@/shared/api/axios';
import { useAuthStore } from '@/modules/auth/authStore';
import type { Rol } from '@/modules/auth/authStore';

const schema = z.object({
  nombre_empresa:  z.string().min(2, 'Nombre de empresa requerido'),
  nit:             z.string().optional(),
  descripcion:     z.string().max(500).optional(),
  actividad:       z.string().max(200).optional(),
  telefono:        z.string().max(30).optional(),
  email_empresa:   z.string().email('Email de empresa inválido').optional().or(z.literal('')),
  direccion:       z.string().max(300).optional(),
  ciudad:          z.string().max(100).optional(),
  nombre:          z.string().min(2, 'Tu nombre es requerido'),
  apellido:        z.string().optional(),
  email:           z.string().email('Email inválido'),
  password:        z.string().min(8, 'Mínimo 8 caracteres'),
  confirmar:       z.string(),
}).refine(d => d.password === d.confirmar, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmar'],
});

type Form = z.infer<typeof schema>;

interface RegistroResponse {
  data: {
    access_token: string;
    refresh_token: string;
    usuario: { id: number; nombre: string; email: string; rol: Rol; empresa_id: number; terminos_aceptados_at: string | null };
  };
}

const INPUT = 'w-full border border-border rounded-xl px-3.5 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors';
const LABEL = 'block text-sm font-medium text-foreground mb-1.5';
const SECTION = 'text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-1';

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) ? ((err.response?.data?.message as string | undefined) ?? fallback) : fallback;
}

export function RegistroEmpresaPage() {
  const navigate = useNavigate();
  const login = useAuthStore(s => s.login);
  const [serverError, setServerError] = useState<string | null>(null);

  // El backend exige email_token (ver auth.routes.js) — se obtiene verificando
  // un OTP enviado al correo, igual que en mobile y en RecuperarPasswordPage.
  const [step, setStep] = useState<'datos' | 'otp'>('datos');
  const [datos, setDatos] = useState<Form | null>(null);
  const [codigo, setCodigo] = useState('');
  const [codigoError, setCodigoError] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [resending, setResending] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const onSubmitDatos = async (data: Form) => {
    setServerError(null);
    try {
      await api.post('/auth/enviar-otp', { tipo: 'email', destino: data.email });
      setDatos(data);
      setStep('otp');
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setError('email', { message: 'El email ya está registrado.' });
      } else {
        setServerError(errorMessage(err, 'No se pudo enviar el código. Intenta de nuevo.'));
      }
    }
  };

  const reenviarCodigo = async () => {
    if (!datos) return;
    setResending(true);
    try {
      await api.post('/auth/enviar-otp', { tipo: 'email', destino: datos.email });
      setCodigo('');
      setCodigoError(null);
    } finally {
      setResending(false);
    }
  };

  const verificarYCrear = async () => {
    if (!datos) return;
    if (codigo.length !== 6) { setCodigoError('El código debe tener 6 dígitos'); return; }
    setCodigoError(null);
    setServerError(null);
    setVerificando(true);
    try {
      const verif = await api.post<{ data: { token: string } }>('/auth/verificar-otp', {
        tipo: 'email', destino: datos.email, codigo,
      });
      const res = await api.post<RegistroResponse>('/auth/registro-empresa', {
        nombre_empresa: datos.nombre_empresa,
        nit:            datos.nit            || undefined,
        descripcion:    datos.descripcion    || undefined,
        actividad:      datos.actividad      || undefined,
        telefono:       datos.telefono       || undefined,
        email_empresa:  datos.email_empresa  || undefined,
        direccion:      datos.direccion      || undefined,
        ciudad:         datos.ciudad         || undefined,
        nombre:         datos.nombre,
        apellido:       datos.apellido       || undefined,
        email:          datos.email,
        password:       datos.password,
        email_token:    verif.data.data.token,
      });
      const { access_token, refresh_token, usuario } = res.data.data;
      login(usuario, access_token, refresh_token);
      navigate('/', { replace: true });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setServerError('El email ya está registrado.');
        setStep('datos');
      } else {
        setCodigoError(errorMessage(err, 'Código incorrecto. Intenta de nuevo.'));
        setCodigo('');
      }
    } finally {
      setVerificando(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-sm shadow-primary/30">
          <Calendar size={20} className="text-white" />
        </div>
        <span className="font-bold text-foreground text-lg">Zaturno</span>
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

        {step === 'datos' ? (
          <form onSubmit={handleSubmit(onSubmitDatos)} className="flex flex-col gap-4">
            {/* Empresa básica */}
            <p className={SECTION}>Datos de la empresa</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={LABEL}>Nombre de la empresa *</label>
                <input {...register('nombre_empresa')} type="text" placeholder="Eventos Horizonte S.A.S" className={INPUT} />
                {errors.nombre_empresa && <p className="text-danger text-xs mt-1">{errors.nombre_empresa.message}</p>}
              </div>
              <div>
                <label className={LABEL}>NIT</label>
                <input {...register('nit')} type="text" placeholder="900.123.456-7" className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Ciudad</label>
                <input {...register('ciudad')} type="text" placeholder="Bogotá" className={INPUT} />
              </div>
            </div>

            <div>
              <label className={LABEL}>Actividad económica</label>
              <input {...register('actividad')} type="text" placeholder="Ej. Organización de eventos" className={INPUT} />
            </div>

            <div>
              <label className={LABEL}>Descripción</label>
              <textarea
                {...register('descripcion')}
                rows={2}
                placeholder="Breve descripción de tu empresa..."
                className={INPUT + ' resize-none'}
              />
            </div>

            {/* Contacto */}
            <p className={SECTION}>Contacto</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Teléfono</label>
                <input {...register('telefono')} type="tel" placeholder="+57 300 000 0000" className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Email de la empresa</label>
                <input {...register('email_empresa')} type="email" placeholder="info@empresa.com" className={INPUT} />
                {errors.email_empresa && <p className="text-danger text-xs mt-1">{errors.email_empresa.message}</p>}
              </div>
            </div>
            <div>
              <label className={LABEL}>Dirección</label>
              <input {...register('direccion')} type="text" placeholder="Calle 123 # 45-67" className={INPUT} />
            </div>

            {/* Admin */}
            <p className={SECTION}>Tu cuenta de administrador</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Nombre *</label>
                <input {...register('nombre')} type="text" placeholder="Juan" className={INPUT} />
                {errors.nombre && <p className="text-danger text-xs mt-1">{errors.nombre.message}</p>}
              </div>
              <div>
                <label className={LABEL}>Apellido</label>
                <input {...register('apellido')} type="text" placeholder="Pérez" className={INPUT} />
              </div>
            </div>
            <div>
              <label className={LABEL}>Email *</label>
              <input {...register('email')} type="email" placeholder="admin@tuempresa.com" className={INPUT} />
              {errors.email && <p className="text-danger text-xs mt-1">{errors.email.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Contraseña *</label>
                <input {...register('password')} type="password" placeholder="••••••••" className={INPUT} />
                {errors.password && <p className="text-danger text-xs mt-1">{errors.password.message}</p>}
              </div>
              <div>
                <label className={LABEL}>Confirmar *</label>
                <input {...register('confirmar')} type="password" placeholder="••••••••" className={INPUT} />
                {errors.confirmar && <p className="text-danger text-xs mt-1">{errors.confirmar.message}</p>}
              </div>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Al continuar aceptas los{' '}
              <Link to="/terminos" target="_blank" className="font-medium text-primary hover:underline">Términos y condiciones</Link>
              {' '}y la{' '}
              <Link to="/privacidad" target="_blank" className="font-medium text-primary hover:underline">Política de privacidad</Link>.
            </p>

            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors shadow-sm shadow-primary/25 mt-1"
            >
              {isSubmitting ? 'Enviando código...' : 'Continuar'}
            </button>

            <p className="text-center text-sm text-muted-foreground">
              ¿Ya tienes cuenta?{' '}
              <button type="button" onClick={() => navigate('/login')} className="font-semibold text-primary hover:text-primary-600 transition-colors">
                Iniciar sesión
              </button>
            </p>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Enviamos un código de 6 dígitos a <span className="font-semibold text-foreground">{datos?.email}</span>
            </p>

            <div>
              <label className={LABEL}>Código de verificación</label>
              <input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                placeholder="000000"
                className={INPUT}
              />
              {codigoError && <p className="text-danger text-xs mt-1">{codigoError}</p>}
            </div>

            <button
              type="button"
              onClick={verificarYCrear}
              disabled={verificando}
              className="bg-primary hover:bg-primary-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors shadow-sm shadow-primary/25 mt-1"
            >
              {verificando ? 'Verificando...' : 'Verificar y crear empresa'}
            </button>

            <div className="flex items-center justify-between text-xs">
              <button type="button" onClick={() => setStep('datos')} className="text-muted-foreground hover:text-foreground">
                ← Editar datos
              </button>
              <button
                type="button"
                onClick={reenviarCodigo}
                disabled={resending}
                className="font-medium text-primary hover:underline disabled:opacity-50"
              >
                {resending ? 'Reenviando…' : 'Reenviar código'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
