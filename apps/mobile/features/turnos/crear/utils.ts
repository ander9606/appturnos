import { isValidCalendarDate, isChronological } from '@/lib/dateValidation';
import { bogotaToday } from '@/lib/formatters';
import type { WizardData, PuestoInput } from './types';

export function pad(s: string, len = 2): string {
  return s.padStart(len, '0');
}

export function buildFecha(data: WizardData): string {
  return `${pad(data.anio, 4)}-${pad(data.mes)}-${pad(data.dia)}`;
}

export function buildTime(h: string, m: string): string {
  return `${pad(h)}:${pad(m)}:00`;
}

/** Fecha real de calendario y no en el pasado — un turno no se puede publicar para ayer */
export function isValidDate(d: string, m: string, y: string): boolean {
  const day = Number(d), month = Number(m), year = Number(y);
  if (!day || !month || !year) return false;
  if (!isValidCalendarDate(day, month, year)) return false;
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}` >= bogotaToday();
}

export function isValidTime(h: string, m: string): boolean {
  const hour = Number(h), min = Number(m);
  if (h === '' || m === '') return false;
  return hour >= 0 && hour <= 23 && min >= 0 && min <= 59;
}

export function parseTarifa(s: string): number {
  return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
}

export function calcularPresupuesto(puestos: PuestoInput[]): number {
  return puestos.reduce((sum, p) => sum + parseTarifa(p.tarifa_dia) * p.plazas, 0);
}

export function validateStep1(data: WizardData): string | null {
  if (!data.titulo.trim()) return 'Escribe un título para el turno.';
  if (!isValidDate(data.dia, data.mes, data.anio)) return 'Ingresa una fecha válida — no puede ser en el pasado.';
  if (!isValidTime(data.hora_inicio_h, data.hora_inicio_m)) return 'Hora de inicio inválida.';
  if (!isValidTime(data.hora_fin_h, data.hora_fin_m)) return 'Hora de fin inválida.';
  if (isChronological(buildTime(data.hora_fin_h, data.hora_fin_m), buildTime(data.hora_inicio_h, data.hora_inicio_m))) {
    return 'La hora de fin debe ser después de la hora de inicio.';
  }
  if (data.visibilidad === 'dirigida' && data.destinatarios.length === 0) {
    return 'Elige al menos una persona para el turno dirigido.';
  }
  return null;
}

export function validateStep2(puestos: PuestoInput[]): string | null {
  if (puestos.length === 0) return 'Agrega al menos un rol al turno.';
  for (const p of puestos) {
    if (p.plazas < 1) return `"${p.cargo_nombre}": mínimo 1 plaza.`;
    if (parseTarifa(p.tarifa_dia) <= 0) return `"${p.cargo_nombre}": ingresa la tarifa por turno.`;
  }
  return null;
}
