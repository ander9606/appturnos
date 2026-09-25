import { Reveal } from '../Reveal';

export function Sectors() {
  const sectors = [
    { name: 'Restaurantes y F&B', desc: 'Turnos de cocina, servicio y domicilios con horarios variables' },
    { name: 'Seguridad privada', desc: 'Guardas en múltiples sedes, turnos nocturnos y festivos' },
    { name: 'Manufactura', desc: 'Plantas con tres turnos continuos y rotación de personal' },
    { name: 'Salud y clínicas', desc: 'Enfermeros, auxiliares y turnos de 12 horas en festivos' },
    { name: 'Oficinas y servicios', desc: 'Nómina de horario fijo, sin turnos rotativos — igual de automatizada' },
  ];
  return (
    <section className="bg-primary-900 px-6 py-20 sm:py-24">
      <Reveal className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-200">Industrias</p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white text-balance sm:text-4xl">
          Con turnos rotativos o sin ellos, tu nómina queda al día
        </h2>
        <p className="mt-4 text-base leading-relaxed text-white/60">
          zaturno no es solo para negocios con turnos: es un sistema completo de nómina — también
          sirve para empresas con horario fijo que quieren automatizar sus recargos y liquidaciones.
        </p>
      </Reveal>
      <div className="mx-auto mt-12 grid max-w-6xl grid-cols-1 gap-px sm:grid-cols-2 lg:grid-cols-5">
        {sectors.map((s, i) => (
          <Reveal key={s.name} delay={i * 70}>
            <div className="h-full border border-white/10 bg-white/5 px-6 py-7 text-center transition-all duration-300 hover:-translate-y-1 hover:bg-white/10">
              <div className="text-sm font-bold text-white">{s.name}</div>
              <div className="mt-1.5 text-xs leading-relaxed text-white/50">{s.desc}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
