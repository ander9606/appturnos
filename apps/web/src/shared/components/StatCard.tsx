type StatColor = 'default' | 'warning' | 'success';

const ICON_BG: Record<StatColor, string> = {
  default: 'bg-primary-50 text-primary-600',
  warning: 'bg-warning-light text-warning',
  success: 'bg-success-light text-success',
};

export function StatCard({
  label, value, icon: Icon, color = 'default', valueSmall, onClick,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color?: StatColor;
  valueSmall?: boolean;
  onClick?: () => void;
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
      <p className="text-xs text-muted-foreground">{label}</p>
    </Wrapper>
  );
}
