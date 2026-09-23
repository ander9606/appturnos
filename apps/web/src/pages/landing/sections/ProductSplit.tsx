/**
 * El naranja (primary) es la marca de Turnos y el verde (success) la de
 * Nómina — mismo mapeo que THEME_COLORS.nomina en mobile/lib/designTokens.ts
 * y el comentario de apps/web/src/index.css. En escritorio, el producto que
 * no está activo asoma como una pestaña en el borde (derecha si se ve
 * Turnos, izquierda si se ve Nómina); en móvil esa pestaña no cabe, así que
 * dos píldoras arriba cumplen el mismo rol.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  Calendar, MapPin, Wallet, Bell, ShieldCheck, Search,
  ChevronRight, CalendarDays, Wallet as WalletIcon,
} from 'lucide-react';

import { Reveal } from '../Reveal';
import { Phone } from '../simulator/PhoneChrome';
import { GestorTurnosScreen, NominaGestorScreen } from '../simulator/GestorScreens';

type ProductKey = 'turnos' | 'nomina';
type ProductItem = { icon: typeof MapPin; title: string; body: string };
type ProductSide = {
  label: string;
  tagline: string;
  icon: typeof MapPin;
  accentText: string;
  accentBg: string;
  accentBgLight: string;
  border: string;
  screen: ReactNode;
  items: ProductItem[];
};

const PRODUCT_SIDES: Record<ProductKey, ProductSide> = {
  turnos: {
    label: 'Turnos',
    tagline: 'Convoca personal y cubre turnos',
    icon: CalendarDays,
    accentText: 'text-primary',
    accentBg: 'bg-primary',
    accentBgLight: 'bg-primary-50',
    border: 'border-primary',
    screen: <GestorTurnosScreen />,
    items: [
      { icon: Search, title: 'Convoca personal en minutos', body: 'Publica un turno abierto y cualquier trabajador activo en la red de zaturno puede postularse — no dependes solo de tu plantilla fija.' },
      { icon: MapPin, title: 'Geofencing en check-in', body: 'El empleado solo puede marcar entrada si está físicamente en el lugar de trabajo. Validación en el servidor — no se puede falsificar desde el teléfono.' },
      { icon: Bell, title: 'Notificaciones push', body: 'Alertas en tiempo real para cambios de turno, reingresos pendientes y turnos por cubrir. Sin depender de WhatsApp.' },
    ],
  },
  nomina: {
    label: 'Nómina',
    tagline: 'Controla y liquida la nómina',
    icon: WalletIcon,
    accentText: 'text-success',
    accentBg: 'bg-success',
    accentBgLight: 'bg-success-light',
    border: 'border-success',
    screen: <NominaGestorScreen />,
    items: [
      { icon: Wallet, title: 'Recargos automáticos', body: 'Horas nocturnas (19:00–06:00), dominicales y festivos colombianos calculados al centavo con la reforma laboral (Ley 2466 de 2025). Incluye Ley Emiliani y los festivos móviles de Semana Santa.' },
      { icon: Calendar, title: 'Períodos flexibles', body: 'Semanal, quincenal o mensual — configura el esquema que tu empresa usa. Cambiar el período no afecta el histórico de nóminas anteriores.' },
      { icon: ShieldCheck, title: 'Snapshot al cerrar el período', body: 'Al cerrar un período la tarifa de cada hora queda congelada. Si luego cambias el salario de alguien, lo ya liquidado no se recalcula.' },
    ],
  },
};

export function ProductSplit() {
  const [active, setActive] = useState<ProductKey>('turnos');
  const other: ProductKey = active === 'turnos' ? 'nomina' : 'turnos';
  const cur = PRODUCT_SIDES[active];
  const oth = PRODUCT_SIDES[other];

  return (
    <section className="bg-muted/60 px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Funcionalidades</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Convoca personal por turnos o controla tu nómina
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
            Son dos beneficios independientes en la misma app: úsalos por separado según lo que tu
            empresa necesite hoy, o juntos para cubrir todo el ciclo.
          </p>
        </Reveal>

        <Reveal delay={80} className="mt-8 flex justify-center gap-2 md:hidden">
          {(Object.keys(PRODUCT_SIDES) as ProductKey[]).map((key) => {
            const s = PRODUCT_SIDES[key];
            const isActive = key === active;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActive(key)}
                className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                  isActive ? `${s.accentBg} text-white shadow-sm` : 'border border-border bg-card text-muted-foreground'
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </Reveal>

        <Reveal delay={120} className="relative mt-10">
          <div className={`overflow-hidden rounded-3xl border-t-4 bg-card transition-colors duration-300 ${cur.border}`}>
            <div className="grid gap-10 px-8 py-10 sm:px-12 sm:py-12 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex items-center gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${cur.accentBgLight}`}>
                    <cur.icon size={20} className={cur.accentText} />
                  </div>
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-wide ${cur.accentText}`}>{cur.label}</p>
                    <p className="text-sm font-semibold text-muted-foreground">{cur.tagline}</p>
                  </div>
                </div>
                <ul className="mt-8 flex flex-col gap-5">
                  {cur.items.map((it) => (
                    <li key={it.title} className="flex items-start gap-3">
                      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${cur.accentBgLight}`}>
                        <it.icon size={16} className={cur.accentText} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground">{it.title}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{it.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-center lg:justify-end">
                <Phone>{cur.screen}</Phone>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActive(other)}
            aria-label={`Ver ${oth.label}`}
            className={`absolute top-1/2 hidden -translate-y-1/2 flex-col items-center gap-2 rounded-2xl border border-border bg-card px-3 py-5 shadow-lg transition-transform hover:scale-105 md:flex ${
              other === 'nomina' ? 'right-0 translate-x-1/2' : 'left-0 -translate-x-1/2'
            }`}
          >
            <oth.icon size={18} className={oth.accentText} />
            <span
              className={`text-[11px] font-extrabold uppercase tracking-wide [writing-mode:vertical-rl] ${oth.accentText}`}
            >
              {oth.label}
            </span>
            <ChevronRight size={14} className={`text-muted-foreground ${other === 'turnos' ? 'rotate-180' : ''}`} />
          </button>
        </Reveal>
      </div>
    </section>
  );
}
