import { useState } from 'react';
import { Apple, PlayCircle } from 'lucide-react';

import { Reveal } from '../Reveal';
import { PhoneSimulator, RolePills } from '../simulator/PhoneSimulator';
import type { Role } from '../simulator/types';

export function Mockups() {
  const [role, setRole] = useState<Role>('trabajador');
  return (
    <section id="app" className="relative overflow-hidden px-6 py-20 sm:py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-24 h-[420px] w-[780px] -translate-x-1/2 rounded-full opacity-[0.07] blur-3xl"
        style={{ background: 'radial-gradient(ellipse, #FF5A3C 0%, transparent 70%)' }}
      />
      <Reveal className="relative mx-auto max-w-3xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">La app</p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground text-balance sm:text-4xl">
          Pantallas reales, no bocetos
        </h2>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Usa este celular para hacerte una idea real de cómo funciona zaturno: elegí qué tipo
          de usuario simular y tocá la pantalla para navegar, igual que en tu propio teléfono.
        </p>
      </Reveal>

      <Reveal delay={100} className="mt-8 flex justify-center">
        <RolePills value={role} onChange={setRole} />
      </Reveal>

      <Reveal delay={150} className="mt-10">
        <PhoneSimulator role={role} />
      </Reveal>

      <Reveal delay={250}>
        <StoreBadges />
      </Reveal>
    </section>
  );
}

function StoreBadges() {
  return (
    <div className="mx-auto mt-16 flex max-w-6xl flex-col items-center gap-4">
      <p className="text-sm font-semibold text-muted-foreground">
        Muy pronto disponible para descargar
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <StoreBadge icon={Apple} eyebrow="Próximamente en" store="App Store" />
        <StoreBadge icon={PlayCircle} eyebrow="Próximamente en" store="Google Play" />
      </div>
    </div>
  );
}

function StoreBadge({
  icon: Icon,
  eyebrow,
  store,
}: {
  icon: typeof Apple;
  eyebrow: string;
  store: string;
}) {
  return (
    <div
      className="flex cursor-default items-center gap-2.5 rounded-xl border border-border bg-foreground px-4 py-2.5 opacity-90"
      aria-label={`${store}: ${eyebrow.toLowerCase()}`}
    >
      <Icon size={22} className="text-white" />
      <div className="text-left leading-tight">
        <div className="text-[9px] font-medium uppercase tracking-wide text-white/60">{eyebrow}</div>
        <div className="text-sm font-bold text-white">{store}</div>
      </div>
    </div>
  );
}
