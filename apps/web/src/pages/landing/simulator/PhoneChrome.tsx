/**
 * Device mockups — pantallas reales de la app, reconstruidas con los mismos
 * tokens de marca (apps/mobile/lib/designTokens.ts) y estructura de
 * apps/mobile/app/(tabs)/*.tsx e (auth)/login.tsx.
 */
import type { ReactNode } from 'react';
import { Home, CalendarDays, Wallet as WalletIcon, Users } from 'lucide-react';
import type { Tab } from './types';

export const GREEN = '#059669';
export const GREEN_LIGHT = '#ECFDF5';
export const ORANGE_LIGHT = '#FFF1EE';
export const BLUE = '#3B82F6';
export const BLUE_LIGHT = '#DBEAFE';
export const VIOLET = '#7C3AED';
export const AQUA = '#1BAF7A';
export const PLACEHOLDER = '#94A3B8';

export function Phone({ size = 'lg', children }: { size?: 'lg' | 'sm'; children: ReactNode }) {
  const isSm = size === 'sm';
  return (
    <div
      className={`relative flex-shrink-0 rounded-[34px] bg-[#12222b] shadow-[0_40px_80px_rgba(0,0,0,0.35)] ${
        isSm ? 'w-[168px] rounded-[26px] p-[7px]' : 'w-[228px] p-[9px]'
      }`}
    >
      <div
        className={`absolute left-1/2 top-[9px] -translate-x-1/2 rounded-b-[10px] bg-[#12222b] ${
          isSm ? 'h-[12px] w-[56px] rounded-b-[8px]' : 'h-[16px] w-[76px]'
        }`}
      />
      <div
        className={`flex flex-col overflow-hidden rounded-[26px] bg-[#F8FAFC] ${
          isSm ? 'min-h-[330px] rounded-[20px]' : 'min-h-[430px]'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export function StatusRow({ dark }: { dark?: boolean }) {
  return (
    <div className={`flex justify-between px-4 pt-2 text-[10px] font-bold ${dark ? 'text-foreground' : 'text-white/90'}`}>
      <span>9:41</span>
      <span>••• ▮▮▮</span>
    </div>
  );
}

export function TabBar({ active, accent = '#FF5A3C', onSelect }: { active: Tab; accent?: string; onSelect?: (t: Tab) => void }) {
  const tabs = [
    { key: 'inicio', icon: Home, label: 'Inicio' },
    { key: 'turnos', icon: CalendarDays, label: 'Turnos' },
    { key: 'nomina', icon: WalletIcon, label: 'Nómina' },
    { key: 'equipo', icon: Users, label: 'Equipo' },
  ] as const;
  return (
    <div className="mt-auto flex border-t border-border bg-white px-1 pb-2 pt-1.5">
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onSelect?.(t.key)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={t.label}
            className="flex flex-1 flex-col items-center gap-0.5"
            style={{ color: isActive ? accent : PLACEHOLDER }}
          >
            <t.icon size={13} />
            <span className="text-[7px] font-bold">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex-1 rounded-lg border border-border bg-white py-1.5 text-center">
      <div className="text-[11px] font-extrabold text-foreground" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="text-[7px] font-bold text-muted-foreground">{label}</div>
    </div>
  );
}
