import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router';
import axios from 'axios';
import { Mail, KeyRound, Lock, Eye, EyeOff } from 'lucide-react';
import { api } from '@/shared/api/axios';
import zaturnoLogo from '@/assets/zaturno-logo.png';

const emailSchema = z.object({
  email: z.string().email('Email inválido'),
});
type EmailForm = z.infer<typeof emailSchema>;

const resetSchema = z
  .object({
    codigo: z.string().length(6, 'El código debe tener 6 dígitos'),
    password: z.string().min(8, 'Mínimo 8 caracteres'),
    confirmar: z.string(),
  })
  .refine((d) => d.password === d.confirmar, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmar'],
  });
type ResetForm = z.infer<typeof resetSchema>;

const INPUT =
  'w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3.5 text-sm text-foreground ' +
  'transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40';

function errorMessage(err: unknown, fallback: string) {
  return axios.isAxiosError(err) ? ((err.response?.data?.message as string | undefined) ?? fallback) : fallback;
}

export function RecuperarPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resending, setResending] = useState(false);

  const form1 = useForm<EmailForm>({ resolver: zodResolver(emailSchema) });
  const onSubmitEmail = async (data: EmailForm) => {
    try {
      await api.post('/auth/enviar-otp', { tipo: 'email', destino: data.email });
      setEmail(data.email);
      setStep('reset');
    } catch (err) {
      form1.setError('root', { message: errorMessage(err, 'No se pudo enviar el código. Intenta de nuevo.') });
    }
  };

  const form2 = useForm<ResetForm>({ resolver: zodResolver(resetSchema) });
  const onSubmitReset = async (data: ResetForm) => {
    try {
      const verif = await api.post<{ data: { token: string } }>('/auth/verificar-otp', {
        tipo: 'email',
        destino: email,
        codigo: data.codigo,
      });
      await api.post('/auth/reset-password', {
        email,
        password: data.password,
        email_token: verif.data.data.token,
      });
      navigate('/login', { replace: true });
    } catch (err) {
      form2.setError('root', { message: errorMessage(err, 'No se pudo restablecer la contraseña. Intenta de nuevo.') });
    }
  };

  const reenviarCodigo = async () => {
    setResending(true);
    try {
      await api.post('/auth/enviar-otp', { tipo: 'email', destino: email });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-6">
      <div className="w-full max-w-sm">
        <div
          className="relative overflow-hidden rounded-3xl px-6 pb-16 pt-10 text-center"
          style={{ background: 'linear-gradient(160deg, #FF7150 0%, #FF5A3C 50%, #E83E1F 100%)' }}
        >
          <div className="pointer-events-none absolute -top-14 -right-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-10 -left-8 h-28 w-28 rounded-full bg-white/10" />
          <div className="relative flex flex-col items-center gap-2">
            <img src={zaturnoLogo} alt="" className="h-14 w-14 rounded-2xl shadow-lg shadow-black/20" />
            <h1 className="text-xl font-extrabold tracking-tight text-white">Zaturno</h1>
            <p className="text-xs font-medium text-white/75">Recuperar contraseña</p>
          </div>
        </div>

        <div className="relative -mt-10 rounded-2xl border border-border bg-card p-6 shadow-xl shadow-black/[0.04]">
          {step === 'email' ? (
            <>
              <h2 className="text-lg font-bold text-foreground">¿Olvidaste tu contraseña?</h2>
              <p className="mb-5 mt-0.5 text-sm text-muted-foreground">
                Ingresa tu correo y te enviaremos un código para restablecerla.
              </p>

              <form onSubmit={form1.handleSubmit(onSubmitEmail)} className="flex flex-col gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
                  <div className="relative">
                    <Mail size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      {...form1.register('email')}
                      type="email"
                      autoComplete="email"
                      autoFocus
                      className={INPUT}
                      placeholder="tu@correo.com"
                    />
                  </div>
                  {form1.formState.errors.email && (
                    <p className="mt-1 text-xs text-danger">{form1.formState.errors.email.message}</p>
                  )}
                </div>

                {form1.formState.errors.root && (
                  <p className="rounded-xl border border-danger/20 bg-danger-light px-3.5 py-2.5 text-sm text-danger">
                    {form1.formState.errors.root.message}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={form1.formState.isSubmitting}
                  className="mt-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary/25 transition-colors hover:bg-primary-600 disabled:opacity-50"
                >
                  {form1.formState.isSubmitting ? 'Enviando…' : 'Enviar código'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold text-foreground">Restablecer contraseña</h2>
              <p className="mb-5 mt-0.5 text-sm text-muted-foreground">Ingresa el código enviado a {email}</p>

              <form onSubmit={form2.handleSubmit(onSubmitReset)} className="flex flex-col gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Código de verificación</label>
                  <div className="relative">
                    <KeyRound size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      {...form2.register('codigo')}
                      inputMode="numeric"
                      maxLength={6}
                      autoFocus
                      className={INPUT}
                      placeholder="000000"
                    />
                  </div>
                  {form2.formState.errors.codigo && (
                    <p className="mt-1 text-xs text-danger">{form2.formState.errors.codigo.message}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Nueva contraseña</label>
                  <div className="relative">
                    <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      {...form2.register('password')}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      className={`${INPUT} pr-10`}
                      placeholder="Mínimo 8 caracteres"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {form2.formState.errors.password && (
                    <p className="mt-1 text-xs text-danger">{form2.formState.errors.password.message}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Confirmar contraseña</label>
                  <div className="relative">
                    <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      {...form2.register('confirmar')}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      className={INPUT}
                      placeholder="Repite la contraseña"
                    />
                  </div>
                  {form2.formState.errors.confirmar && (
                    <p className="mt-1 text-xs text-danger">{form2.formState.errors.confirmar.message}</p>
                  )}
                </div>

                {form2.formState.errors.root && (
                  <p className="rounded-xl border border-danger/20 bg-danger-light px-3.5 py-2.5 text-sm text-danger">
                    {form2.formState.errors.root.message}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={form2.formState.isSubmitting}
                  className="mt-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary/25 transition-colors hover:bg-primary-600 disabled:opacity-50"
                >
                  {form2.formState.isSubmitting ? 'Restableciendo…' : 'Restablecer contraseña'}
                </button>

                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => setStep('email')}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    ← Cambiar correo
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
              </form>
            </>
          )}
        </div>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          <Link to="/login" className="font-semibold text-primary hover:underline">
            ← Volver a iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
