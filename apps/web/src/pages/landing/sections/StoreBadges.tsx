import { Apple, PlayCircle } from 'lucide-react';

export function StoreBadges() {
  return (
    <div className="flex flex-wrap items-center justify-start gap-3">
      <StoreBadge
        icon={Apple}
        eyebrow="Descargar en"
        store="App Store"
        href="https://apps.apple.com/app/id6813078911"
      />
      <StoreBadge
        icon={PlayCircle}
        eyebrow="Descargar en"
        store="Google Play"
        href="https://play.google.com/store/apps/details?id=com.zaturno.mobile"
      />
    </div>
  );
}

function StoreBadge({
  icon: Icon,
  eyebrow,
  store,
  href,
}: {
  icon: typeof Apple;
  eyebrow: string;
  store: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center gap-2.5 rounded-xl border border-border bg-foreground px-4 py-2.5 opacity-90 transition hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
    >
      <Icon size={22} className="text-white" />
      <div className="text-left leading-tight">
        <div className="text-[9px] font-medium uppercase tracking-wide text-white/60">{eyebrow}</div>
        <div className="text-sm font-bold text-white">{store}</div>
      </div>
    </a>
  );
}
