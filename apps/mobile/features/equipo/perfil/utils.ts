import { isValidCalendarDate } from '@/lib/dateValidation';
import { bogotaToday } from '@/lib/formatters';
import type { WizardData } from './types';

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Returns YYYY-MM-DD or null if any part is missing/invalid.
 * `new Date("2024-02-30")` silently rolls over to Mar 1 instead of failing
 * — se valida con isValidCalendarDate en vez de confiar en el constructor.
 */
export function buildFecha(d: string, m: string, a: string): string | null {
  if (!d || !m || !a || a.length < 4) return null;
  if (!isValidCalendarDate(Number(d), Number(m), Number(a))) return null;
  return `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/** Returns YYYY-MM-01 from month + year (day fixed at 1st). */
export function buildMesAnio(m: string, a: string): string | null {
  if (!m || !a || a.length < 4) return null;
  const mm = m.padStart(2, '0');
  const date = new Date(`${a}-${mm}-01`);
  if (isNaN(date.getTime())) return null;
  return `${a}-${mm}-01`;
}

export function validateStep1(d: WizardData): string | null {
  if (!d.nombre.trim()) return 'El nombre es obligatorio';
  if (!d.apellido.trim()) return 'El apellido es obligatorio';
  if (!d.cedula.trim()) return 'La cédula es obligatoria';
  if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim()))
    return 'El correo electrónico no es válido';
  if (d.nac_d || d.nac_m || d.nac_a) {
    const fecha = buildFecha(d.nac_d, d.nac_m, d.nac_a);
    if (!fecha) return 'La fecha de nacimiento no es válida.';
    if (fecha >= bogotaToday()) return 'La fecha de nacimiento no puede ser hoy ni en el futuro.';
  }
  return null;
}

export function validateStep2(_d: WizardData): string | null {
  return null;
}

export function validateStep3(_d: WizardData): string | null {
  for (const e of _d.experiencias) {
    if (!e.empresa_nombre.trim()) return 'Completa el nombre de empresa en la experiencia laboral';
    if (!e.cargo.trim()) return 'Completa el cargo en la experiencia laboral';
    if (!e.inicio_m || !e.inicio_a) return 'Completa la fecha de inicio en la experiencia laboral';
    const inicio = buildMesAnio(e.inicio_m, e.inicio_a);
    if (!inicio) return `Fecha de inicio inválida en la experiencia de "${e.empresa_nombre || 'una empresa'}".`;
    if (e.fin_m || e.fin_a) {
      const fin = buildMesAnio(e.fin_m, e.fin_a);
      if (!fin) return `Fecha de fin inválida en la experiencia de "${e.empresa_nombre || 'una empresa'}".`;
      if (fin < inicio) return `La fecha de fin no puede ser antes que la de inicio en la experiencia de "${e.empresa_nombre || 'una empresa'}".`;
    }
  }
  for (const d of _d.diplomas) {
    if (!d.titulo.trim()) return 'Completa el título del diploma';
    if (!d.institucion.trim()) return 'Completa la institución del diploma';
  }
  if (_d.antj_d || _d.antj_m || _d.antj_a) {
    const f = buildFecha(_d.antj_d, _d.antj_m, _d.antj_a);
    if (!f) return 'La fecha de antecedentes judiciales no es válida.';
    if (f > bogotaToday()) return 'La fecha de antecedentes judiciales no puede ser futura.';
  }
  if (_d.antd_d || _d.antd_m || _d.antd_a) {
    const f = buildFecha(_d.antd_d, _d.antd_m, _d.antd_a);
    if (!f) return 'La fecha de antecedentes disciplinarios no es válida.';
    if (f > bogotaToday()) return 'La fecha de antecedentes disciplinarios no puede ser futura.';
  }
  return null;
}
