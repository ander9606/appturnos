import type { WizardData } from './types';

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Returns YYYY-MM-DD or null if any part is missing/invalid. */
export function buildFecha(d: string, m: string, a: string): string | null {
  if (!d || !m || !a || a.length < 4) return null;
  const dd = d.padStart(2, '0');
  const mm = m.padStart(2, '0');
  const date = new Date(`${a}-${mm}-${dd}`);
  if (isNaN(date.getTime())) return null;
  return `${a}-${mm}-${dd}`;
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
  }
  for (const d of _d.diplomas) {
    if (!d.titulo.trim()) return 'Completa el título del diploma';
    if (!d.institucion.trim()) return 'Completa la institución del diploma';
  }
  return null;
}
