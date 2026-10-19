'use strict';

/**
 * Lecturas en lenguaje natural del resumen del período ("Para mirar").
 * Función pura: recibe números ya calculados y devuelve hasta MAX avisos,
 * los más graves primero. Los umbrales están aquí arriba para ajustarlos
 * sin tocar la lógica.
 */
const UMBRALES = {
  COSTO_SUBE_AVISO: 10,       // % de variación del costo vs el período anterior
  COSTO_SUBE_ALERTA: 25,
  EXTRAS_SOBRE_NOMINA: 15,    // % del costo de nómina que son horas extra
  EXTRAS_CONCENTRADAS: 50,    // % de las horas extra en los 3 trabajadores con más
  EXTRAS_MIN_HORAS: 10,       // por debajo de esto no vale la pena avisar
  NO_PRESENTADOS_AVISO: 5,    // % de turnos convocados
  NO_PRESENTADOS_ALERTA: 10,
  COBERTURA_AVISO: 90,        // % de plazas cubiertas
  COBERTURA_ALERTA: 75,
  // Personas
  JORNADA_SEMANAL: 42,         // horas por semana de la jornada ordinaria (constants.js)
  JORNADA_MARGEN: 1,           // h/semana de holgura: una extra suelta no cuenta como hábito
  MIN_PERSONAS_ROTAR: 4,       // un cargo con menos personas no se puede rotar (jefes, encargados)
  ACAPARA_VECES_JUSTO: 2,      // el que más gana vs su parte justa (1/n del cargo)
  BANCA_AVISO: 1,              // personas del cargo sin turnos para que valga el aviso
};
const MAX = 5;
const ORDEN = { alerta: 0, aviso: 1, info: 2, ok: 3 };

const pct = (parte, total) => (total > 0 ? (parte / total) * 100 : null);
const entero = (n) => Math.round(n);
const cop = (n) => `$${Math.round(n).toLocaleString('es-CO')}`;

function generarInsights({ costo, nomina, turnos, cobertura }) {
  const lista = [];

  if (costo?.delta_pct != null) {
    const d = costo.delta_pct;
    if (d >= UMBRALES.COSTO_SUBE_AVISO) {
      lista.push({
        id: 'costo_sube',
        nivel: d >= UMBRALES.COSTO_SUBE_ALERTA ? 'alerta' : 'aviso',
        texto: `El costo de mano de obra subió ${entero(d)}% frente al período anterior (${cop(costo.total - costo.previo)} más).`,
      });
    } else if (d <= -UMBRALES.COSTO_SUBE_AVISO) {
      lista.push({
        id: 'costo_baja',
        nivel: 'info',
        texto: `El costo de mano de obra bajó ${entero(-d)}% frente al período anterior.`,
      });
    }
  }

  if (nomina) {
    const extras = nomina.desglose.extras;
    const pctExtras = pct(extras, nomina.costo);
    if (pctExtras != null && pctExtras >= UMBRALES.EXTRAS_SOBRE_NOMINA && nomina.horas_extra >= UMBRALES.EXTRAS_MIN_HORAS) {
      lista.push({
        id: 'extras_altas',
        nivel: 'aviso',
        texto: `Las horas extra son el ${entero(pctExtras)}% del costo de nómina (${cop(extras)}).`,
      });
    }
    const top = nomina.top_extras;
    if (top.length >= 2 && nomina.horas_extra >= UMBRALES.EXTRAS_MIN_HORAS) {
      const horasTop = top.reduce((s, t) => s + t.horas_extra, 0);
      const pctTop = pct(horasTop, nomina.horas_extra);
      if (pctTop >= UMBRALES.EXTRAS_CONCENTRADAS) {
        const nombres = top.map((t) => `${t.nombre} ${t.apellido}`.trim()).join(', ');
        lista.push({
          id: 'extras_concentradas',
          nivel: 'aviso',
          texto: `${top.length} personas acumulan el ${entero(pctTop)}% de las horas extra: ${nombres}.`,
        });
      }
    }
  }

  if (turnos) {
    const pctNo = pct(turnos.no_presentados, turnos.convocados);
    if (pctNo != null && pctNo >= UMBRALES.NO_PRESENTADOS_AVISO) {
      lista.push({
        id: 'no_presentados',
        nivel: pctNo >= UMBRALES.NO_PRESENTADOS_ALERTA ? 'alerta' : 'aviso',
        texto: `${turnos.no_presentados} de ${turnos.convocados} personas convocadas no se presentaron (${entero(pctNo)}%).`,
      });
    }
  }

  if (cobertura?.pct != null && cobertura.pct < UMBRALES.COBERTURA_AVISO) {
    lista.push({
      id: 'cobertura_baja',
      nivel: cobertura.pct < UMBRALES.COBERTURA_ALERTA ? 'alerta' : 'aviso',
      texto: `Solo se cubrió el ${entero(cobertura.pct)}% de las plazas de los turnos (${cobertura.cubiertas} de ${cobertura.plazas}).`,
    });
  }

  if (!lista.length) {
    return [{ id: 'todo_bien', nivel: 'ok', texto: 'Nada fuera de lo normal en este período.' }];
  }
  return lista.sort((a, b) => ORDEN[a.nivel] - ORDEN[b.nivel]).slice(0, MAX);
}

/**
 * Avisos de la sección Personas. `horas` es null para quien no ve nómina.
 * `cargos[i].personas[j]` trae { nombre, apellido, turnos, pago }; los que tienen turnos = 0 son "la banca".
 */
function generarInsightsPersonas({ horas, cargos }) {
  const lista = [];
  const nombre = (p) => `${p.nombre} ${p.apellido || ''}`.trim();

  if (horas) {
    const sobre = horas.ranking.filter((h) => h.prom_semana > UMBRALES.JORNADA_SEMANAL + UMBRALES.JORNADA_MARGEN);
    if (sobre.length) {
      lista.push({
        id: 'sobre_jornada',
        nivel: 'aviso',
        texto: `${sobre.length} ${sobre.length === 1 ? 'persona promedia' : 'personas promedian'} más de ${UMBRALES.JORNADA_SEMANAL} h por semana: ${sobre.slice(0, 3).map(nombre).join(', ')}${sobre.length > 3 ? '…' : ''}.`,
      });
    }
  }

  for (const c of cargos) {
    if (!c.rotable) continue;
    const n = c.personas.length;
    const top = c.personas[0]; // vienen ordenadas por pago desc
    const justo = c.total_pago / n;
    if (c.total_pago > 0 && top.pago >= UMBRALES.ACAPARA_VECES_JUSTO * justo) {
      lista.push({
        id: `acapara_${c.cargo_id}`,
        nivel: 'aviso',
        texto: `En ${c.cargo}, ${nombre(top)} se llevó el ${Math.round((top.pago / c.total_pago) * 100)}% de lo pagado en turnos (su parte pareja sería ${Math.round(100 / n)}%).`,
      });
    }
    const banca = c.personas.filter((p) => p.turnos === 0);
    if (banca.length >= UMBRALES.BANCA_AVISO && c.total_pago > 0) {
      lista.push({
        id: `banca_${c.cargo_id}`,
        nivel: 'info',
        texto: `${banca.length} ${banca.length === 1 ? 'persona de' : 'personas de'} ${c.cargo} no tuvo turnos en el período: ${banca.slice(0, 3).map(nombre).join(', ')}${banca.length > 3 ? '…' : ''}.`,
      });
    }
  }
  return lista.sort((a, b) => ORDEN[a.nivel] - ORDEN[b.nivel]).slice(0, MAX);
}

module.exports = { generarInsights, generarInsightsPersonas, UMBRALES };
