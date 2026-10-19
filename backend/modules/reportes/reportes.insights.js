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
        texto: `Las horas extra son el ${entero(pctExtras)}% del costo de nómina (${cop(extras)}). Revisa si hace falta más personal.`,
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
          texto: `${top.length} personas acumulan el ${entero(pctTop)}% de las horas extra: ${nombres}. Repartir la carga reduce costo y desgaste.`,
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

module.exports = { generarInsights, UMBRALES };
