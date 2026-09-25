import { Reveal } from '../Reveal';

export function Pain() {
  const items = [
    {
      q: '"¿Cuántos trabajadores llegaron hoy y a qué hora?"',
      a: 'Sin zaturno: llamas uno por uno o esperas que te reporten por WhatsApp. Con zaturno: lo ves en tiempo real, con la ubicación exacta del registro.',
    },
    {
      q: '"¿Cuánto le toca de nocturno a cada trabajador este mes?"',
      a: 'Sin zaturno: calculas manualmente con tablas de Excel, con margen de error. Con zaturno: los recargos nocturnos, dominicales y festivos se calculan solos, al centavo — tengas turnos rotativos o nómina de horario fijo.',
    },
    {
      q: '"¿Cómo le notifico a mi equipo el cambio de turno?"',
      a: 'Sin zaturno: grupos de WhatsApp, llamadas y mensajes que se pierden. Con zaturno: notificaciones push instantáneas a cada empleado, con confirmación de lectura.',
    },
  ];
  return (
    <section className="bg-card px-6 py-20 sm:py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">El problema</p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          ¿Te suena familiar?
        </h2>
      </Reveal>
      <div className="mx-auto mt-14 grid max-w-6xl grid-cols-1 gap-px overflow-hidden rounded-2xl bg-border md:grid-cols-3">
        {items.map((p, i) => (
          <Reveal key={p.q} delay={i * 100}>
            <div className="h-full border-t-[3px] border-primary bg-background px-7 py-9 transition-transform duration-300 hover:-translate-y-1">
              <p className="text-base font-bold leading-snug text-foreground">{p.q}</p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{p.a}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
