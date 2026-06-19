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
