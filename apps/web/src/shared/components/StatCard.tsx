type StatColor = 'default' | 'warning' | 'success';

const ICON_BG: Record<StatColor, string> = {
  default: 'bg-primary-50 text-primary-600',
  warning: 'bg-warning-light text-warning',
  success: 'bg-success-light text-success',
};

export function StatCard({
  label, value, icon: Icon, color = 'default', valueSmall, onClick, caption, badge,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color?: StatColor;
  valueSmall?: boolean;
  onClick?: () => void;
  /** Línea pequeña bajo el label — ej. "incluye $X en horas extra". */
  caption?: string;
  /** Pastilla junto al label — ej. "Estimado" mientras el período sigue abierto. */
  badge?: string;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      className={`bg-card border border-border rounded-2xl p-4 text-left w-full ${onClick ? 'hover:bg-muted transition-colors' : ''}`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${ICON_BG[color]}`}>
        <Icon size={18} />
      </div>
      <p className={`font-bold text-foreground mb-0.5 ${valueSmall ? 'text-sm' : 'text-2xl'}`}>{value}</p>
      <p className="text-xs text-muted-foreground">
        {label}
        {badge && <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-warning-light text-warning-text">{badge}</span>}
      </p>
      {caption && <p className="text-xs text-warning font-medium mt-1">{caption}</p>}
    </Wrapper>
  );
}
