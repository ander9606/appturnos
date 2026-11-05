import { isChronological } from '@/lib/dateValidation';
import { bogotaToday, toISODate, formatTimeObj } from '@/lib/formatters';
import type { CrearOfertaPayload } from '@api-client';
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

/** Cuerpo para crear el turno con lo que llenó el asistente. `grupo_id` solo viaja si eligió un grupo. */
export function buildPayload(data: WizardData): CrearOfertaPayload {
  return {
    titulo:            data.titulo.trim(),
    ...(data.grupo ? { grupo_id: data.grupo.id } : {}),
    descripcion:       data.descripcion.trim() || undefined,
    notas_adicionales: data.notas_adicionales.trim() || undefined,
    fecha:             buildFecha(data),
    hora_inicio:       buildTime(data.hora_inicio!),
    hora_fin_estimada: data.hora_fin ? buildTime(data.hora_fin) : undefined,
    fin_dia_siguiente: data.fin_dia_siguiente || undefined,
    lugar:             data.lugar.trim() || undefined,
    latitud:           data.latitud ?? undefined,
    longitud:          data.longitud ?? undefined,
    ubicacion_libre:   data.ubicacion_libre,
    encargado_nombre:   data.encargado_nombre.trim() || undefined,
    encargado_telefono: data.encargado_telefono.trim() || undefined,
    para_quien:        data.para_quien,
    visibilidad:       data.visibilidad,
    trabajador_ids:    data.visibilidad === 'dirigida' ? data.destinatarios.map((d) => d.id) : undefined,
    puestos:           data.puestos.map((p) => ({
      cargo_id:   p.cargo_id,
      plazas:     p.plazas,
      tarifa_dia: parseTarifa(p.tarifa_dia),
    })),
  };
}

export function validateStep1(data: WizardData): string | null {
  if (!data.titulo.trim()) return 'Escribe un título para el turno.';
  if (!data.fecha || toISODate(data.fecha) < bogotaToday()) return 'Ingresa una fecha válida — no puede ser en el pasado.';
  if (!data.hora_inicio) return 'Hora de inicio inválida.';
  if (!data.hora_fin) return 'Hora de fin inválida.';
  const finAntesDelInicio = isChronological(buildTime(data.hora_fin), buildTime(data.hora_inicio));
  if (data.fin_dia_siguiente) {
    if (!finAntesDelInicio) return 'Si el turno termina al día siguiente, la hora de fin debe ser antes (o igual) que la de inicio — si no, pasaría de 24 horas.';
  } else if (finAntesDelInicio) {
    return 'La hora de fin debe ser después de la hora de inicio. Si el turno pasa de la medianoche, activa "Termina al día siguiente".';
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
