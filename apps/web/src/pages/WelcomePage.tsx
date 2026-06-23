import { useNavigate } from 'react-router';
import { Calendar, Users, Briefcase, ChevronRight } from 'lucide-react';

export function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero */}
      <div
        className="flex flex-col items-center justify-end pt-20 pb-14 px-6"
        style={{ background: 'linear-gradient(160deg, #FF7150 0%, #FF5A3C 50%, #E83E1F 100%)' }}
      >
        <div className="w-20 h-20 rounded-3xl bg-white/20 flex items-center justify-center mb-5">
          <Calendar size={40} className="text-white" />
        </div>
        <h1 className="text-4xl font-bold text-white tracking-tight mb-2">AppTurnos</h1>
        <p className="text-white/75 text-base text-center max-w-xs">
          Gestión de turnos y nómina para tu empresa
        </p>
        {/* Wave separator */}
        <div className="w-full mt-10 overflow-hidden" style={{ height: 32 }}>
          <svg viewBox="0 0 1440 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 32L1440 32L1440 16C1200 0 960 32 720 32C480 32 240 0 0 16L0 32Z" fill="#F8FAFC"/>
          </svg>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 px-6 py-8 max-w-md mx-auto w-full">
        <h2 className="text-xl font-bold text-foreground text-center mb-6">
          ¿Cómo quieres continuar?
        </h2>

        <div className="flex flex-col gap-3">
          {/* Trabajador */}
          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-4 p-5 rounded-2xl text-left transition-all active:scale-[0.98] hover:shadow-md"
            style={{ backgroundColor: '#FF5A3C' }}
          >
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Users size={24} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-base">Soy trabajador</p>
              <p className="text-white/70 text-sm mt-0.5">Activa tu cuenta o inicia sesión</p>
            </div>
            <ChevronRight size={18} className="text-white/60 flex-shrink-0" />
          </button>

          {/* Empresa / Admin */}
          <button
            onClick={() => navigate('/registro')}
            className="flex items-center gap-4 p-5 rounded-2xl border border-border text-left transition-all active:scale-[0.98] hover:bg-muted"
            style={{ backgroundColor: '#FFFFFF' }}
          >
            <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
              <Briefcase size={24} className="text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-foreground font-bold text-base">Tengo una empresa</p>
              <p className="text-muted-foreground text-sm mt-0.5">
                Registra tu empresa o inicia sesión como admin
              </p>
            </div>
            <ChevronRight size={18} className="text-muted-foreground/60 flex-shrink-0" />
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground mt-8">
          ¿Ya tienes cuenta?{' '}
          <button
            onClick={() => navigate('/login')}
            className="font-semibold text-primary hover:text-primary-600 transition-colors"
          >
            Iniciar sesión →
          </button>
        </p>
      </div>
    </div>
  );
}
