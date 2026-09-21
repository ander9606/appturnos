import { Reveal } from '../Reveal';

export function HowItWorks() {
  const steps = [
    {
      title: 'Configuras tus turnos y equipo',
      body: 'Crea los períodos de nómina, asigna roles a cada trabajador y define los lugares de trabajo con geofencing. Una vez configurado, el sistema trabaja solo.',
    },
    {
      title: 'Tus empleados fichan desde el celular',
      body: 'El trabajador marca entrada y salida desde su app. Si no está en la ubicación asignada, el sistema lo detecta. Sin tarjetas, sin relojes biométricos.',
    },
    {
      title: 'La nómina se calcula sola',
      body: 'Al cerrar el período, zaturno suma las horas ordinarias, nocturnas, dominicales y festivas de cada empleado aplicando los recargos del Código Sustantivo del Trabajo — con turnos rotativos o con horario fijo.',
    },
    {
      title: 'Liquidás con un toque',
      body: 'Revisas el resumen, aprobás y quedás con el histórico de cada período guardado. Todo trazable, todo auditable.',
    },
  ];

  const week = [
    { name: 'Carlos M.', shifts: ['M', 'M', '', 'M', 'M', 'T'] },
    { name: 'Luisa R.', shifts: ['N', 'N', 'N', '', '', 'N'] },
    { name: 'Pedro V.', shifts: ['T', '', 'T', 'T', 'T', ''] },
    { name: 'Ana G.', shifts: ['✓', '✓', 'M', 'M', '', 'M'] },
  ];
  const shiftStyle: Record<string, string> = {
    M: 'bg-primary text-white',
    N: 'bg-info text-white',
    T: 'bg-[#7B4F9E] text-white',
    '✓': 'bg-warning text-primary-900',
    '': 'bg-muted',
  };

  return (
    <section className="px-6 py-20 sm:py-24" id="como-funciona">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Cómo funciona</p>
          <h2 className="mt-3 max-w-lg text-3xl font-extrabold tracking-tight text-foreground text-balance sm:text-4xl">
            Del turno a la nómina, sin fricción
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-16 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-9">
            {steps.map((s, i) => (
              <Reveal key={s.title} delay={i * 90} className="flex gap-5">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border-2 border-primary text-sm font-extrabold text-primary">
                  {i + 1}
                </div>
                <div>
                  <h4 className="text-base font-bold text-foreground">{s.title}</h4>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={150} className="min-w-0">
            <p className="mb-3.5 text-xs font-bold uppercase tracking-[0.14em] text-primary">
              Vista de turnos — semana actual
            </p>
            <div className="overflow-x-auto rounded-2xl border border-border bg-card p-5">
              <div className="grid min-w-[420px] grid-cols-[80px_repeat(6,1fr)] gap-1">
                <div />
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((d) => (
                  <div key={d} className="py-1 text-center text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    {d}
                  </div>
                ))}
                {week.map((row) => (
                  <div key={row.name} className="contents">
                    <div className="flex items-center truncate pr-2 text-xs font-semibold text-foreground">
                      {row.name}
                    </div>
                    {row.shifts.map((s, i) => (
                      <div
                        key={i}
                        className={`flex h-7 items-center justify-center rounded text-xs font-bold ${shiftStyle[s]}`}
                      >
                        {s}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-4">
                <Legend color="bg-primary" label="Mañana" />
                <Legend color="bg-info" label="Nocturno" />
                <Legend color="bg-[#7B4F9E]" label="Tarde" />
                <Legend color="bg-warning" label="Geoficó" />
                <Legend color="bg-muted" label="Descanso" />
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
      <span className={`h-2.5 w-2.5 rounded-sm ${color}`} />
      {label}
    </div>
  );
}
