import { isChronological } from '@/lib/dateValidation';
import { bogotaToday, toISODate, formatTimeObj } from '@/lib/formatters';
import type { WizardData, PuestoInput } from './types';

export function buildFecha(data: WizardData): string {
  return toISODate(data.fecha!);
}

export function buildTime(d: Date): string {
  return `${formatTimeObj(d)}:00`;
}

export function parseTarifa(s: string): number {
  return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
}

export function calcularPresupuesto(puestos: PuestoInput[]): number {
  return puestos.reduce((sum, p) => sum + parseTarifa(p.tarifa_dia) * p.plazas, 0);
}

export function validateStep1(data: WizardData): string | null {
  if (!data.titulo.trim()) return 'Escribe un título para el turno.';
  if (!data.fecha || toISODate(data.fecha) < bogotaToday()) return 'Ingresa una fecha válida — no puede ser en el pasado.';
  if (!data.hora_inicio) return 'Hora de inicio inválida.';
  if (!data.hora_fin) return 'Hora de fin inválida.';
  if (isChronological(buildTime(data.hora_fin), buildTime(data.hora_inicio))) {
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
