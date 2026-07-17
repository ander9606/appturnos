import type { Asignacion } from '@api-client';

const SHORT_MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export interface QuincenaRange {
  inicio: Date;
  fin:    Date;
  label:  string;
}

export function getQuincena(ref: Date): QuincenaRange {
  const day = ref.getDate(), month = ref.getMonth(), year = ref.getFullYear();
  if (day <= 15) {
    return {
      inicio: new Date(year, month, 1),
      fin:    new Date(year, month, 15, 23, 59, 59),
      label:  `1–15 ${SHORT_MONTHS[month]}`,
    };
  }
  const last = new Date(year, month + 1, 0).getDate();
  return {
    inicio: new Date(year, month, 16),
    fin:    new Date(year, month, last, 23, 59, 59),
    label:  `16–${last} ${SHORT_MONTHS[month]}`,
  };
}

export function getPrevQuincena(r: QuincenaRange): QuincenaRange {
  return getQuincena(new Date(r.inicio.getTime() - 24 * 60 * 60 * 1000));
}

export interface TotalesQuincena {
  count: number;
  horas: number;
  pago:  number;
}

/** Turnos completados de `turnos` que caen dentro de la quincena `q`, sumados. */
export function sumarQuincena(turnos: Asignacion[], q: QuincenaRange): TotalesQuincena {
  return turnos.reduce((acc, a) => {
    if (a.estado !== 'completado') return acc;
    const fecha = new Date(`${a.oferta_fecha}T00:00:00`);
    if (fecha < q.inicio || fecha > q.fin) return acc;
    return {
      count: acc.count + 1,
      horas: acc.horas + (Number(a.horas_trabajadas) || 0),
      pago:  acc.pago  + (Number(a.pago_total) || 0),
    };
  }, { count: 0, horas: 0, pago: 0 });
}
