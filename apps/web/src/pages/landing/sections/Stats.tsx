import { Reveal } from '../Reveal';

export function Stats() {
  const items = [
    { num: '100%', label: 'Recargos de ley colombiana' },
    { num: '0', label: 'Errores en nómina manual' },
    { num: '∞', label: 'Empresas en un solo sistema' },
  ];
  return (
    <section className="bg-primary-900">
      <div className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-white/15 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {items.map((s, i) => (
          <Reveal key={s.label} delay={i * 100} className="px-8 py-10 text-center">
            <div className="text-4xl font-extrabold tabular-nums tracking-tight text-white sm:text-5xl">
              {s.num}
            </div>
            <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-white/60">
              {s.label}
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
